import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

interface AuditSection {
  name: string;
  errors: string[];
}

interface LabelDefinition {
  name: string;
  color: string;
  description: string;
}

export interface TextFile {
  relativePath: string;
  text: string;
}

interface LocalizedContent {
  locale: 'pt' | 'en';
  content: Record<string, unknown>;
}

export interface InstallChannelsAuditInput {
  installTabs: readonly unknown[];
  channels: readonly unknown[];
  copyTargets: readonly string[];
}

export interface ReleaseCopyAuditInput {
  release: unknown;
  localizedReleases: readonly { locale: string; releases: unknown }[];
}

const DIST_EXPECTED_FILES = [
  'index.html',
  'en/index.html',
  'releases/index.html',
  'en/releases/index.html',
  'docs/quickstart/index.html',
  'en/docs/quickstart/index.html',
  '404.html',
  'site.webmanifest',
  'sitemap-index.xml',
  '_headers',
];

export interface CacheHeaderRule {
  path: string;
  cacheControl: string;
}

const ONE_YEAR_MAX_AGE_SECONDS = 31_556_952;
const VERSIONED_ASSET_CACHE_CONTROL = `public, max-age=${ONE_YEAR_MAX_AGE_SECONDS}, immutable`;
const SHORT_IMAGE_CACHE_CONTROL = 'public, max-age=86400, must-revalidate';

export const REQUIRED_CACHE_HEADER_RULES: readonly CacheHeaderRule[] = [
  { path: '/_astro/*', cacheControl: VERSIONED_ASSET_CACHE_CONTROL },
  { path: '/favicon.ico', cacheControl: SHORT_IMAGE_CACHE_CONTROL },
  { path: '/site.webmanifest', cacheControl: 'public, max-age=3600, must-revalidate' },
  { path: '/install.sh', cacheControl: 'public, max-age=300, must-revalidate' },
];
const REQUIRED_CACHE_HEADER_PATHS = new Set(REQUIRED_CACHE_HEADER_RULES.map((rule) => rule.path));

const DISALLOWED_WRANGLER_KEYS = [
  'account_id',
  'ai',
  'analytics_engine_datasets',
  'build',
  'd1_databases',
  'durable_objects',
  'hyperdrive',
  'kv_namespaces',
  'main',
  'mtls_certificates',
  'pipelines',
  'placement',
  'queues',
  'r2_buckets',
  'route',
  'secrets_store_secrets',
  'services',
  'tail_consumers',
  'triggers',
  'unsafe',
  'vars',
  'vectorize',
  'workflows',
];

// The Worker must bind the apex domain only; www -> apex is external DNS/Redirect config.
const APEX_ROUTE_PATTERN = 'mangostudio.dev';
const WWW_HOST = 'www.mangostudio.dev';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.sh',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
]);

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);
const ASTRO_ASSET_PATH_PREFIX = '/_astro/';
const HASHED_FILE_NAME_PATTERN = /\.[A-Za-z0-9_-]{8,}\.[^.]+$/;
const UNVERSIONED_APP_IMAGE_PATHS = ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
const VERSIONED_ASSET_REFERENCE_PATTERN =
  /\/_astro\/([A-Za-z0-9._-]+\.(?:avif|gif|ico|jpeg|jpg|png|svg|webp))/gi;

const SECRET_PATTERNS = [
  { label: 'Cloudflare API token variable', pattern: /\bCLOUDFLARE_API_TOKEN\b/ },
  { label: 'Cloudflare account id variable', pattern: /\bCLOUDFLARE_ACCOUNT_ID\b/ },
  { label: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'GitHub token-like value', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
];

const INSTALLER_URL_MARKER = 'mangostudio.dev/install.sh';
const TODO_HTML_ALLOWLIST = new Set<string>();
const INSTALL_PLACEHOLDER_PATTERNS = [
  /\bplaceholder\b/i,
  /performs no installation/i,
  /\bno installation\b/i,
];

const PUBLISHED_CLI_INSTALL_PATTERN =
  /^(?:bun\s+add|npm\s+(?:install|i))\s+-g\s+@mangostudio\/cli(?:@\S+)?$/;

const DISALLOWED_RELEASE_COPY_PATTERNS = [
  { label: 'git-cliff generated highlights', pattern: /git-cliff/i },
  {
    label: 'automatic merge generated highlights',
    pattern: /automaticamente a cada merge|automatically (?:on|after) each merge/i,
  },
  {
    label: 'generated highlights',
    pattern:
      /(?:highlight|highlights|destaque|destaques)[^.!?]*(?:generated|auto-generated|synced|sincronizad|gerad|automat)/i,
  },
];

export function stripJsonComments(input: string): string {
  let output = '';
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? '';
    const next = input[index + 1] ?? '';

    if (inString) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === stringQuote) {
        inString = false;
        stringQuote = '';
      }

      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') {
        index += 1;
      }
      output += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < input.length - 1 && !(input[index] === '*' && input[index + 1] === '/')) {
        index += 1;
      }
      if (index < input.length - 1) {
        index += 1;
      }
      output += ' ';
      continue;
    }

    output += char;
  }

  return output;
}

export function extractLoadedExternalUrls(html: string): string[] {
  const urls = new Set<string>();
  const tagPattern = /<\s*(script|iframe|img|source|video|audio|link)\b[^>]*>/gi;
  let tagMatch = tagPattern.exec(html);

  while (tagMatch !== null) {
    const tag = tagMatch[0] ?? '';
    const tagName = (tagMatch[1] ?? '').toLowerCase();
    const attrs = parseAttributes(tag);

    if (tagName === 'link') {
      const rel = attrs.get('rel')?.toLowerCase() ?? '';
      const loadedRel =
        /\b(stylesheet|preload|modulepreload|icon|manifest|apple-touch-icon)\b/.test(rel);

      if (loadedRel) {
        addRemoteUrl(urls, attrs.get('href'));
        addSrcsetUrls(urls, attrs.get('imagesrcset'));
      }

      tagMatch = tagPattern.exec(html);
      continue;
    }

    addRemoteUrl(urls, attrs.get('src'));
    addRemoteUrl(urls, attrs.get('poster'));
    addSrcsetUrls(urls, attrs.get('srcset'));
    tagMatch = tagPattern.exec(html);
  }

  return [...urls].sort();
}

export function extractRemoteCssUrls(css: string): string[] {
  const urls = new Set<string>();
  const patterns = [
    /url\(\s*(['"]?)((?:https?:)?\/\/[^'")]+)\1\s*\)/gi,
    /@import\s+(['"])((?:https?:)?\/\/[^'"]+)\1/gi,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(css);

    while (match !== null) {
      const url = match[2];

      if (url !== undefined) {
        urls.add(url);
      }

      match = pattern.exec(css);
    }
  }

  return [...urls].sort();
}

export function extractInlineStyleBlocks(html: string): string[] {
  const blocks: string[] = [];
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match = stylePattern.exec(html);

  while (match !== null) {
    blocks.push(match[1] ?? '');
    match = stylePattern.exec(html);
  }

  return blocks;
}

export function extractDataCopyTargets(html: string): string[] {
  const targets = new Set<string>();
  const tagPattern = /<\s*[A-Za-z][^>]*\bdata-copy\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/gi;
  let tagMatch = tagPattern.exec(html);

  while (tagMatch !== null) {
    const attrs = parseAttributes(tagMatch[0] ?? '');
    const target = attrs.get('data-copy');

    if (target !== undefined) {
      targets.add(decodeHtmlAttribute(target));
    }

    tagMatch = tagPattern.exec(html);
  }

  return [...targets].sort();
}

export function isPlaceholderInstallScript(script: string): boolean {
  return INSTALL_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(script));
}

export function isShellInstallerAdvertised(htmlFiles: readonly TextFile[]): boolean {
  return htmlFiles.some((file) => file.text.includes(INSTALLER_URL_MARKER));
}

export function findTodoHtmlFiles(htmlFiles: readonly TextFile[]): string[] {
  return htmlFiles
    .filter((file) => file.text.includes('TODO') && !TODO_HTML_ALLOWLIST.has(file.relativePath))
    .map((file) => file.relativePath)
    .sort();
}

export function validateInstallChannels(input: InstallChannelsAuditInput): string[] {
  const errors: string[] = [];
  const copyTargets = new Set(input.copyTargets);
  const groups = [
    { name: 'INSTALL_TABS', entries: input.installTabs },
    { name: 'CHANNELS', entries: input.channels },
  ];
  let readyCount = 0;

  for (const group of groups) {
    for (const [index, entry] of group.entries.entries()) {
      const label = `${group.name}[${index}]`;

      if (!isRecord(entry)) {
        errors.push(`${label} must be an object.`);
        continue;
      }

      const status = entry.status;
      const cmd = entry.cmd;

      if (status !== 'ready' && status !== 'planned') {
        errors.push(`${label} must declare status "ready" or "planned".`);
        continue;
      }

      if (typeof cmd !== 'string' || cmd.trim() === '') {
        errors.push(`${label} must declare a non-empty command.`);
        continue;
      }

      if (status === 'ready') {
        readyCount += 1;
      }

      if (status === 'planned' && copyTargets.has(cmd)) {
        errors.push(`${label} is planned, but its command is exposed as a copy target.`);
      }
    }
  }

  if (readyCount === 0) {
    errors.push('At least one install channel must be ready.');
  }

  assertPublishedPrimary(errors, 'INSTALL_TABS[0]', input.installTabs[0]);
  assertPublishedPrimary(errors, 'CHANNELS[0]', input.channels[0]);

  return errors;
}

export function validateTruthfulSiteMetrics(siteData: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const stars = siteData.STARS;

  if (
    (typeof stars === 'string' && stars.trim() !== '') ||
    (typeof stars === 'number' && Number.isFinite(stars))
  ) {
    errors.push('src/data/site.ts must not export a hardcoded STARS metric.');
  }

  return errors;
}

export function validateReleaseSource(input: ReleaseCopyAuditInput): string[] {
  const errors: string[] = [];

  if (!isRecord(input.release)) {
    errors.push('src/data/releases.generated.ts must export a RELEASE object.');
  } else {
    for (const field of ['version', 'releaseDate', 'installCmd']) {
      if (typeof input.release[field] !== 'string' || input.release[field].trim() === '') {
        errors.push(`RELEASE.${field} must be non-empty.`);
      }
    }
  }

  for (const { locale, releases } of input.localizedReleases) {
    if (!isRecord(releases)) {
      errors.push(`${locale} release copy must be an object.`);
      continue;
    }

    const strings = collectStrings(releases);

    if (strings.some((text) => text.includes('TODO'))) {
      errors.push(`${locale} release copy must not contain TODO placeholder text.`);
    }

    for (const { label, pattern } of DISALLOWED_RELEASE_COPY_PATTERNS) {
      const match = strings.find((text) => pattern.test(text));

      if (match) {
        errors.push(`${locale} release copy still claims ${label}: "${shorten(match)}".`);
      }
    }
  }

  return errors;
}

export function parseHeadersFile(text: string): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  let currentPath: string | undefined;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    if (!/^\s/.test(line)) {
      currentPath = trimmed;
      rules.set(currentPath, {});
      continue;
    }

    if (currentPath === undefined) {
      continue;
    }

    const colonIndex = line.indexOf(':');

    if (colonIndex <= 0) {
      continue;
    }

    const name = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    const headers = rules.get(currentPath);

    if (headers) {
      headers[name] = value;
    }
  }

  return rules;
}

export function validateCacheHeaders(text: string): string[] {
  const errors: string[] = [];
  const rules = parseHeadersFile(text);

  for (const required of REQUIRED_CACHE_HEADER_RULES) {
    const headers = rules.get(required.path);

    if (!headers) {
      errors.push(`dist/_headers must define cache rules for ${required.path}.`);
      continue;
    }

    const cacheControl = headers['cache-control'];

    if (cacheControl === undefined || cacheControl === '') {
      errors.push(
        `dist/_headers ${required.path} must set Cache-Control: ${required.cacheControl}.`
      );
      continue;
    }

    if (!required.cacheControl.includes('immutable') && cacheControl.includes('immutable')) {
      errors.push(`dist/_headers ${required.path} must not be marked immutable.`);
      continue;
    }

    if (cacheControl !== required.cacheControl) {
      errors.push(
        `dist/_headers ${required.path} must set Cache-Control: ${required.cacheControl}.`
      );
    }
  }

  for (const [path, headers] of rules) {
    const cacheControl = headers['cache-control'];

    if (!cacheControl || REQUIRED_CACHE_HEADER_PATHS.has(path) || !isImageHeaderPath(path)) {
      continue;
    }

    if (isLongLivedCacheControl(cacheControl) && !isVersionedAssetHeaderPath(path)) {
      errors.push(
        `dist/_headers ${path} must not use long-lived immutable caching unless the image URL is versioned.`
      );
    }
  }

  return errors;
}

export function findUnversionedAppImageReferences(file: TextFile): string[] {
  return UNVERSIONED_APP_IMAGE_PATHS.filter((path) => file.text.includes(path)).map(
    (path) =>
      `${file.relativePath} references ${path}; app icons must use src/assets imports so Astro emits hashed URLs.`
  );
}

// A content-hashed `/_astro/...` URL only stays cacheable for a year if it
// actually resolves to an emitted file: an unchanged build re-emits the same
// hash (browser and Cloudflare keep serving the cached image), while changing
// the source bytes mints a new hash that no cache holds. A reference to a hash
// that was never emitted breaks that contract — the browser would request a URL
// that 404s instead of loading the cached image. This flags any such reference
// across the built HTML and the web manifest.
export function findBrokenVersionedAssetReferences(
  files: readonly TextFile[],
  emittedAssetNames: ReadonlySet<string>
): string[] {
  const errors: string[] = [];

  for (const file of files) {
    const seen = new Set<string>();

    for (const match of file.text.matchAll(VERSIONED_ASSET_REFERENCE_PATTERN)) {
      const name = match[1];

      if (name === undefined || seen.has(name)) {
        continue;
      }

      seen.add(name);

      if (!emittedAssetNames.has(name)) {
        errors.push(
          `${file.relativePath} references /_astro/${name}, but no such hashed asset was emitted; the versioned URL would 404 instead of serving the cached image.`
        );
      }
    }
  }

  return errors;
}

export function validateVersionedImageAssetPath(relativePath: string): string | null {
  if (!relativePath.startsWith('dist/_astro/')) {
    return null;
  }

  if (!IMAGE_EXTENSIONS.has(extname(relativePath))) {
    return null;
  }

  if (HASHED_FILE_NAME_PATTERN.test(basename(relativePath))) {
    return null;
  }

  return `${relativePath} must include a content hash before it receives one-year immutable caching.`;
}

function isImageHeaderPath(path: string): boolean {
  if (path.endsWith('/*')) {
    return false;
  }

  return IMAGE_EXTENSIONS.has(extname(path));
}

function isLongLivedCacheControl(cacheControl: string): boolean {
  if (/\bimmutable\b/i.test(cacheControl)) {
    return true;
  }

  const match = /\bmax-age=(\d+)\b/i.exec(cacheControl);

  return match !== null && Number(match[1]) >= ONE_YEAR_MAX_AGE_SECONDS;
}

function isVersionedAssetHeaderPath(path: string): boolean {
  return (
    path === '/_astro/*' ||
    path.startsWith(ASTRO_ASSET_PATH_PREFIX) ||
    HASHED_FILE_NAME_PATTERN.test(basename(path))
  );
}

export function validateApexRoute(routes: unknown): string[] {
  const errors: string[] = [];

  if (!Array.isArray(routes)) {
    errors.push('wrangler.jsonc must declare a routes array binding the apex custom domain.');
    return errors;
  }

  if (routes.length !== 1) {
    errors.push(
      `wrangler.jsonc must declare exactly one route (the apex custom domain); found ${routes.length}.`
    );
    return errors;
  }

  const [route] = routes;

  if (!isRecord(route)) {
    errors.push('wrangler.jsonc route must be an object.');
    return errors;
  }

  if (collectStrings(route).some((value) => value.includes(WWW_HOST))) {
    errors.push(
      `wrangler.jsonc route must not bind ${WWW_HOST}; the www -> apex redirect is external Cloudflare DNS/Redirect Rule config.`
    );
  } else if (route.pattern !== APEX_ROUTE_PATTERN) {
    errors.push(`wrangler.jsonc route pattern must be ${APEX_ROUTE_PATTERN}.`);
  }

  if (route.custom_domain !== true) {
    errors.push('wrangler.jsonc route must set custom_domain: true for the apex domain.');
  }

  return errors;
}

async function runAudit(repoRoot: string): Promise<AuditSection[]> {
  const sections = [
    await auditWrangler(repoRoot),
    await auditWorkflows(repoRoot),
    await auditInstallEndpoint(repoRoot),
    await auditBuiltOutput(repoRoot),
    await auditFirstPublishReadiness(repoRoot),
    await auditLabels(repoRoot),
  ];

  return sections;
}

async function auditWrangler(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const configPath = join(repoRoot, 'wrangler.jsonc');
  const config = await readJsonc(configPath, errors);

  if (!config) {
    return { name: 'Wrangler static-assets config', errors };
  }

  const assets = config.assets;

  if (!isRecord(assets)) {
    errors.push('wrangler.jsonc must define an assets object.');
  } else {
    assertEquals(
      errors,
      assets.directory,
      './dist',
      'wrangler.jsonc assets.directory must stay ./dist.'
    );
    assertEquals(
      errors,
      assets.html_handling,
      'auto-trailing-slash',
      'wrangler.jsonc assets.html_handling must stay auto-trailing-slash.'
    );
    assertEquals(
      errors,
      assets.not_found_handling,
      '404-page',
      'wrangler.jsonc assets.not_found_handling must stay 404-page.'
    );

    if ('binding' in assets) {
      errors.push('wrangler.jsonc assets.binding must stay unset for direct static serving.');
    }
  }

  for (const key of DISALLOWED_WRANGLER_KEYS) {
    if (key in config) {
      errors.push(`wrangler.jsonc must not define ${key}; this site is assets-only.`);
    }
  }

  errors.push(...validateApexRoute(config.routes));

  return { name: 'Wrangler static-assets config', errors };
}

async function auditWorkflows(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const workflowsDir = join(repoRoot, '.github', 'workflows');
  const workflowFiles = (await walkFiles(workflowsDir)).filter(
    (file) => file.endsWith('.yml') || file.endsWith('.yaml')
  );
  const deployPath = join(workflowsDir, 'deploy.yml');
  const deployText = await readFileText(deployPath, errors);

  for (const file of workflowFiles) {
    const relativePath = toPosix(relative(repoRoot, file));
    const text = await readFile(file, 'utf8');

    if (file !== deployPath && /\bCLOUDFLARE_(API_TOKEN|ACCOUNT_ID)\b/.test(text)) {
      errors.push(`${relativePath} must not reference Cloudflare deploy credentials.`);
    }

    if (file !== deployPath && /cloudflare\/wrangler-action/i.test(text)) {
      errors.push(`${relativePath} must not use wrangler-action outside the deploy workflow.`);
    }
  }

  if (deployText) {
    if (/^\s*pull_request:/m.test(deployText)) {
      errors.push('deploy.yml must not run on pull_request events.');
    }

    if (!/branches:\s*\[main\]/.test(deployText)) {
      errors.push('deploy.yml must restrict automatic deploys to main.');
    }

    if (!/environment:\s*\n\s*name:\s*production/m.test(deployText)) {
      errors.push('deploy.yml must deploy through the protected production environment.');
    }

    if (!deployText.includes('secrets.CLOUDFLARE_API_TOKEN')) {
      errors.push('deploy.yml must read CLOUDFLARE_API_TOKEN only from GitHub secrets.');
    }

    if (!deployText.includes('secrets.CLOUDFLARE_ACCOUNT_ID')) {
      errors.push('deploy.yml must read CLOUDFLARE_ACCOUNT_ID only from GitHub secrets.');
    }
  }

  return { name: 'GitHub Actions deploy isolation', errors };
}

async function auditInstallEndpoint(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const installPath = join(repoRoot, 'public', 'install.sh');
  const installScript = await readFileText(installPath, errors);

  if (installScript) {
    if (!installScript.startsWith('#!/usr/bin/env bash')) {
      errors.push('public/install.sh must keep an explicit bash shebang.');
    }

    if (!installScript.includes('set -euo pipefail')) {
      errors.push('public/install.sh must keep strict shell mode.');
    }

    if (
      isPlaceholderInstallScript(installScript) &&
      isShellInstallerAdvertised(await readDistHtmlFiles(repoRoot))
    ) {
      errors.push(
        `public/install.sh is a placeholder, but built pages advertise ${INSTALLER_URL_MARKER}.`
      );
    }
  }

  return { name: 'Public installer endpoint', errors };
}

async function auditBuiltOutput(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const distDir = join(repoRoot, 'dist');

  if (!(await fileExists(distDir))) {
    return { name: 'Static build output', errors: ['dist/ is missing; run bun run build first.'] };
  }

  for (const expectedFile of DIST_EXPECTED_FILES) {
    const absolutePath = join(distDir, expectedFile);

    if (!(await fileExists(absolutePath))) {
      errors.push(`dist/${expectedFile} is missing from the static build.`);
    }
  }

  const headersPath = join(distDir, '_headers');

  if (await fileExists(headersPath)) {
    errors.push(...validateCacheHeaders(await readFile(headersPath, 'utf8')));
  }

  const emittedAstroImageNames = new Set<string>();
  const textFiles: TextFile[] = [];

  for (const file of await walkFiles(distDir)) {
    const relativePath = toPosix(relative(repoRoot, file));
    const fileName = basename(file);
    const extension = extname(file);

    const versionedImageAssetError = validateVersionedImageAssetPath(relativePath);

    if (versionedImageAssetError) {
      errors.push(versionedImageAssetError);
    }

    if (relativePath.startsWith('dist/_astro/') && IMAGE_EXTENSIONS.has(extension)) {
      emittedAstroImageNames.add(fileName);
    }

    if (/^\.env(?:\.|$)/.test(fileName) || fileName === '.dev.vars') {
      errors.push(`${relativePath} must not be published.`);
      continue;
    }

    if (!TEXT_EXTENSIONS.has(extension)) {
      continue;
    }

    const text = await readFile(file, 'utf8');

    textFiles.push({ relativePath, text });

    errors.push(...findUnversionedAppImageReferences({ relativePath, text }));

    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(`${relativePath} contains a ${label}; it must not ship in public assets.`);
      }
    }

    if (extension === '.html') {
      for (const relativeHtmlPath of findTodoHtmlFiles([{ relativePath, text }])) {
        errors.push(`${relativeHtmlPath} contains TODO placeholder copy.`);
      }

      for (const url of extractLoadedExternalUrls(text)) {
        errors.push(`${relativePath} loads a remote asset (${url}); ship audited assets locally.`);
      }

      for (const styleBlock of extractInlineStyleBlocks(text)) {
        for (const url of extractRemoteCssUrls(styleBlock)) {
          errors.push(`${relativePath} inlines a remote CSS asset (${url}); ship assets locally.`);
        }
      }
    }

    if (extension === '.css') {
      for (const url of extractRemoteCssUrls(text)) {
        errors.push(`${relativePath} loads a remote CSS asset (${url}); ship assets locally.`);
      }
    }
  }

  errors.push(...findBrokenVersionedAssetReferences(textFiles, emittedAstroImageNames));

  return { name: 'Static build output', errors };
}

async function auditFirstPublishReadiness(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const htmlFiles = await readDistHtmlFiles(repoRoot);
  const copyTargets = htmlFiles.flatMap((file) => extractDataCopyTargets(file.text));
  const siteData = await importSiteData(errors);

  if (siteData) {
    errors.push(...validateTruthfulSiteMetrics(siteData));

    const installTabs = siteData.INSTALL_TABS;
    const channels = siteData.CHANNELS;

    if (!Array.isArray(installTabs)) {
      errors.push('src/data/site.ts must export INSTALL_TABS as an array.');
    }

    if (!Array.isArray(channels)) {
      errors.push('src/data/site.ts must export CHANNELS as an array.');
    }

    if (Array.isArray(installTabs) && Array.isArray(channels)) {
      errors.push(...validateInstallChannels({ installTabs, channels, copyTargets }));
    }
  }

  const releasePath = join(repoRoot, 'src', 'data', 'releases.generated.ts');
  let release: unknown;

  if (!(await fileExists(releasePath))) {
    errors.push('src/data/releases.generated.ts must exist.');
  } else {
    const releaseModule = await importGeneratedRelease(errors);
    release = releaseModule?.RELEASE;
  }

  const localizedContent = await importLocalizedContent(errors);
  const localizedReleases = localizedContent.map(({ locale, content }) => ({
    locale,
    releases: content.releases,
  }));

  if (release !== undefined || localizedReleases.length > 0) {
    errors.push(...validateReleaseSource({ release, localizedReleases }));
  }

  return { name: 'First-publish static promises', errors };
}

async function auditLabels(repoRoot: string): Promise<AuditSection> {
  const errors: string[] = [];
  const labelsPath = join(repoRoot, '.github', 'labels.json');
  const labelsText = await readFileText(labelsPath, errors);

  if (!labelsText) {
    return { name: 'GitHub label configuration', errors };
  }

  let labels: LabelDefinition[] = [];

  try {
    const parsed = JSON.parse(labelsText);

    if (Array.isArray(parsed)) {
      labels = parsed;
    } else {
      errors.push('.github/labels.json must be an array.');
    }
  } catch (error) {
    errors.push(`.github/labels.json is invalid JSON: ${formatError(error)}`);
  }

  const names = new Set<string>();

  for (const label of labels) {
    if (!isLabelDefinition(label)) {
      errors.push('.github/labels.json contains an invalid label entry.');
      continue;
    }

    if (!/^[0-9a-f]{6}$/i.test(label.color)) {
      errors.push(`${label.name} must use a six-character hex color without #.`);
    }

    if (names.has(label.name)) {
      errors.push(`${label.name} is duplicated in .github/labels.json.`);
    }

    names.add(label.name);
  }

  const labelerPath = join(repoRoot, '.github', 'labeler.yml');
  const labelerText = await readFileText(labelerPath, errors);
  const labelerLabels = [...labelerText.matchAll(/^"([^"]+)":/gm)].map((match) => match[1] ?? '');

  for (const label of labelerLabels) {
    if (!names.has(label)) {
      errors.push(
        `${labelerPath} references ${label}, but .github/labels.json does not define it.`
      );
    }
  }

  return { name: 'GitHub label configuration', errors };
}

async function readDistHtmlFiles(repoRoot: string): Promise<TextFile[]> {
  const distDir = join(repoRoot, 'dist');

  if (!(await fileExists(distDir))) {
    return [];
  }

  const htmlFiles: TextFile[] = [];

  for (const file of await walkFiles(distDir)) {
    if (extname(file) !== '.html') {
      continue;
    }

    htmlFiles.push({
      relativePath: toPosix(relative(repoRoot, file)),
      text: await readFile(file, 'utf8'),
    });
  }

  return htmlFiles;
}

async function importSiteData(errors: string[]): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import('../src/data/site')) as Record<string, unknown>;
  } catch (error) {
    errors.push(`Could not import src/data/site.ts: ${formatError(error)}`);
    return undefined;
  }
}

async function importGeneratedRelease(
  errors: string[]
): Promise<Record<string, unknown> | undefined> {
  try {
    return (await import('../src/data/releases.generated')) as Record<string, unknown>;
  } catch (error) {
    errors.push(`Could not import src/data/releases.generated.ts: ${formatError(error)}`);
    return undefined;
  }
}

async function importLocalizedContent(errors: string[]): Promise<LocalizedContent[]> {
  const modules = [
    { locale: 'pt' as const, modulePath: '../src/i18n/pt', exportName: 'pt' },
    { locale: 'en' as const, modulePath: '../src/i18n/en', exportName: 'en' },
  ];
  const localizedContent: LocalizedContent[] = [];

  for (const { locale, modulePath, exportName } of modules) {
    try {
      const module = (await import(modulePath)) as Record<string, unknown>;
      const content = module[exportName];

      if (isRecord(content)) {
        localizedContent.push({ locale, content });
      } else {
        errors.push(`src/i18n/${locale}.ts must export ${exportName} content.`);
      }
    } catch (error) {
      errors.push(`Could not import src/i18n/${locale}.ts: ${formatError(error)}`);
    }
  }

  return localizedContent;
}

async function readJsonc(
  filePath: string,
  errors: string[]
): Promise<Record<string, unknown> | undefined> {
  const text = await readFileText(filePath, errors);

  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stripJsonComments(text));

    if (isRecord(parsed)) {
      return parsed;
    }

    errors.push(`${filePath} must parse to an object.`);
  } catch (error) {
    errors.push(`${filePath} is invalid JSONC: ${formatError(error)}`);
  }

  return undefined;
}

async function readFileText(filePath: string, errors: string[]): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    errors.push(`Could not read ${filePath}: ${formatError(error)}`);
    return '';
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolutePath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(root);
  return files.sort();
}

function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrPattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(tag);

  while (match !== null) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? '';

    if (name) {
      attrs.set(name, value);
    }

    match = attrPattern.exec(tag);
  }

  return attrs;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 16), match)
    )
    .replace(/&#(\d+);/g, (match: string, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 10), match)
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function decodeCodePoint(codePoint: number, original: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return original;
  }

  return String.fromCodePoint(codePoint);
}

function addRemoteUrl(urls: Set<string>, value: string | undefined): void {
  if (!value) {
    return;
  }

  if (value.startsWith('//') || /^https?:\/\//i.test(value)) {
    urls.add(value);
  }
}

function addSrcsetUrls(urls: Set<string>, value: string | undefined): void {
  if (!value) {
    return;
  }

  for (const candidate of value.split(',')) {
    addRemoteUrl(urls, candidate.trim().split(/\s+/)[0]);
  }
}

function assertEquals(
  errors: string[],
  actual: unknown,
  expected: string,
  errorMessage: string
): void {
  if (actual !== expected) {
    errors.push(errorMessage);
  }
}

function assertPublishedPrimary(errors: string[], label: string, entry: unknown): void {
  if (!isRecord(entry)) {
    errors.push(`${label} must be the ready npm/bun install command.`);
    return;
  }

  if (
    entry.status !== 'ready' ||
    typeof entry.cmd !== 'string' ||
    !PUBLISHED_CLI_INSTALL_PATTERN.test(entry.cmd.trim())
  ) {
    errors.push(`${label} must be the ready npm/bun install command.`);
  }
}

function collectStrings(value: unknown): string[] {
  const strings: string[] = [];

  function visit(current: unknown): void {
    if (typeof current === 'string') {
      strings.push(current);
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    if (isRecord(current)) {
      for (const item of Object.values(current)) {
        visit(item);
      }
    }
  }

  visit(value);
  return strings;
}

function shorten(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();

  if (compact.length <= 96) {
    return compact;
  }

  return `${compact.slice(0, 93)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLabelDefinition(value: unknown): value is LabelDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === 'string' &&
    typeof value.color === 'string' &&
    typeof value.description === 'string'
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

async function main(): Promise<void> {
  const sections = await runAudit(process.cwd());
  let errorCount = 0;

  for (const section of sections) {
    if (section.errors.length === 0) {
      process.stdout.write(`[ok] ${section.name}\n`);
      continue;
    }

    errorCount += section.errors.length;
    process.stderr.write(`[fail] ${section.name}\n`);

    for (const error of section.errors) {
      process.stderr.write(`  - ${error}\n`);
    }
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entrypoint) {
  await main();
}
