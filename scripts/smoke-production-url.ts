export const APEX_URL = 'https://mangostudio.dev/';
export const WWW_REDIRECT_PROBE_URL = 'https://www.mangostudio.dev/docs/quickstart?smoke=1';
export const EXPECTED_WWW_REDIRECT_LOCATION = 'https://mangostudio.dev/docs/quickstart?smoke=1';
export const DOCS_REDIRECT_PROBE_URL = 'https://mangostudio.dev/docs';
export const EXPECTED_DOCS_REDIRECT_LOCATION = '/docs/quickstart/';
export const EN_DOCS_REDIRECT_PROBE_URL = 'https://mangostudio.dev/en/docs';
export const EXPECTED_EN_DOCS_REDIRECT_LOCATION = '/en/docs/quickstart/';
export const LIVE_SCRIPT_PROBE_URLS = [APEX_URL, 'https://mangostudio.dev/docs/quickstart/'];
/** Build output scripts live under this same-origin prefix. */
export const BUILD_SCRIPT_PREFIX = '/_astro/';
/**
 * Same-origin script paths the Cloudflare zone is allowed to inject at the edge.
 * Empty: the WebMCP injection is off, so any edge-injected script fails the smoke check.
 */
export const EDGE_INJECTED_SCRIPTS: readonly string[] = [];

export interface SmokeCheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

export function validateApexResponse(status: number): SmokeCheckResult {
  if (status === 200) {
    return { name: 'Apex serves the site', ok: true };
  }

  return {
    name: 'Apex serves the site',
    ok: false,
    error: `${APEX_URL} returned status ${status}, expected 200`,
  };
}

export function validateWwwRedirectResponse(
  status: number,
  location: string | null,
  expectedLocation: string = EXPECTED_WWW_REDIRECT_LOCATION,
  probeUrl: string = WWW_REDIRECT_PROBE_URL
): SmokeCheckResult {
  return validatePermanentRedirect(
    'www redirects to apex with path and query preserved',
    { status, location },
    expectedLocation,
    probeUrl
  );
}

/**
 * Checks that a bare docs root permanently redirects to its locale's quickstart in one hop.
 *
 * @example validateDocsRedirectResponse(301, '/docs/quickstart/') // { ok: true, ... }
 */
export function validateDocsRedirectResponse(
  status: number,
  location: string | null,
  expectedLocation: string = EXPECTED_DOCS_REDIRECT_LOCATION,
  probeUrl: string = DOCS_REDIRECT_PROBE_URL
): SmokeCheckResult {
  return validatePermanentRedirect(
    `${new URL(probeUrl).pathname} redirects permanently to the quickstart`,
    { status, location },
    expectedLocation,
    probeUrl
  );
}

/**
 * Checks that a live page loads only build scripts and the known edge-injected
 * scripts, so a new Cloudflare injection or third-party script fails the deploy.
 *
 * @example validateLiveScripts(APEX_URL, '<script src="/_astro/main.js"></script>') // { ok: true, ... }
 */
export function validateLiveScripts(
  pageUrl: string,
  html: string,
  allowed: readonly string[] = EDGE_INJECTED_SCRIPTS
): SmokeCheckResult {
  const name = `${new URL(pageUrl).pathname} loads only build and known edge scripts`;
  const unexpected = extractScriptSrcs(html)
    .map((src) => new URL(src, pageUrl))
    .filter((url) => !isAllowedScript(url, pageUrl, allowed))
    .map((url) => url.href);

  if (unexpected.length === 0) {
    return { name, ok: true };
  }

  return {
    name,
    ok: false,
    error:
      `${pageUrl} loads unexpected scripts: ${unexpected.join(', ')} | ` +
      `expected: ${[`same-origin ${BUILD_SCRIPT_PREFIX}*`, ...allowed].join(' or ')}`,
  };
}

function extractScriptSrcs(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(
    (match) => match[1] ?? match[2] ?? match[3] ?? ''
  );
}

function isAllowedScript(url: URL, pageUrl: string, allowed: readonly string[]): boolean {
  if (url.origin !== new URL(pageUrl).origin) return false;
  return url.pathname.startsWith(BUILD_SCRIPT_PREFIX) || allowed.includes(url.pathname);
}

function validatePermanentRedirect(
  name: string,
  response: { status: number; location: string | null },
  expectedLocation: string,
  probeUrl: string
): SmokeCheckResult {
  const { status, location } = response;

  if (status !== 301 && status !== 308) {
    return {
      name,
      ok: false,
      error: `${probeUrl} returned status ${status}, expected 301 or 308`,
    };
  }

  if (!location) {
    return {
      name,
      ok: false,
      error: `${probeUrl} returned status ${status} but Location header is missing`,
    };
  }

  if (location !== expectedLocation) {
    return {
      name,
      ok: false,
      error:
        `${probeUrl} returned status ${status} with Location ${location}, ` +
        `expected ${expectedLocation}`,
    };
  }

  return { name, ok: true };
}

async function fetchHead(url: string): Promise<{ status: number; location: string | null }> {
  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  return {
    status: response.status,
    location: response.headers.get('location'),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'manual' });
  if (response.status !== 200) {
    throw new Error(`${url} returned status ${response.status}, expected 200`);
  }
  return response.text();
}

async function runProductionSmoke(): Promise<SmokeCheckResult[]> {
  const apex = await fetchHead(APEX_URL);
  const www = await fetchHead(WWW_REDIRECT_PROBE_URL);
  const docs = await fetchHead(DOCS_REDIRECT_PROBE_URL);
  const enDocs = await fetchHead(EN_DOCS_REDIRECT_PROBE_URL);
  const livePages = await Promise.all(
    LIVE_SCRIPT_PROBE_URLS.map(async (url) => ({ url, html: await fetchHtml(url) }))
  );

  return [
    validateApexResponse(apex.status),
    validateWwwRedirectResponse(www.status, www.location),
    validateDocsRedirectResponse(docs.status, docs.location),
    validateDocsRedirectResponse(
      enDocs.status,
      enDocs.location,
      EXPECTED_EN_DOCS_REDIRECT_LOCATION,
      EN_DOCS_REDIRECT_PROBE_URL
    ),
    ...livePages.map((page) => validateLiveScripts(page.url, page.html)),
  ];
}

function formatFetchError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  let checks: SmokeCheckResult[];

  try {
    checks = await runProductionSmoke();
  } catch (error) {
    process.stderr.write(
      `[fail] Production URL smoke\n  - request failed: ${formatFetchError(error)}\n`
    );
    process.exit(1);
  }

  let failed = false;

  for (const check of checks) {
    if (check.ok) {
      process.stdout.write(`[ok] ${check.name}\n`);
      continue;
    }

    failed = true;
    process.stderr.write(`[fail] ${check.name}\n`);

    if (check.error) {
      process.stderr.write(`  - ${check.error}\n`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
