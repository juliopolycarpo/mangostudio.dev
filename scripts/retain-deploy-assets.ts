import { constants, type Stats } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

interface Generation {
  id: string;
  files: string[];
  deployedAt: number;
}

interface Manifest {
  version: 1;
  generations: Generation[];
}

const ASSET_NAME =
  /^[A-Za-z0-9_-][A-Za-z0-9._-]*\.[A-Za-z0-9_-]{8,}\.(?:css|js|mjs|woff2?|ttf|otf|avif|gif|ico|jpe?g|png|svg|webp)$/;

/**
 * Merges three production builds plus assets retired within 600 seconds; current wins.
 * The cache is staged locally; the caller saves it only after a successful deploy.
 *
 * @example
 * await retainDeployAssets('dist/_astro', '/tmp/deploy-assets', '12345-1');
 */
export async function retainDeployAssets(
  assetsDir: string,
  cacheDir: string,
  generationId: string,
  now = Date.now()
): Promise<Manifest> {
  const { assetsRoot, cacheRoot } = resolveRoots(assetsDir, cacheDir, generationId, now);
  const currentFiles = await readCurrentAssets(assetsRoot);
  const previous = await readManifest(cacheRoot);
  // A build may have been active for days before being superseded. Its grace
  // period starts at its successor's deployment, rather than its own deployment.
  const history = previous.generations.filter((generation) => generation.id !== generationId);
  const generations = [
    { id: generationId, files: currentFiles, deployedAt: now },
    ...history.filter(
      (_, index) => index < 2 || (history[index - 1]?.deployedAt ?? now) + 600_000 >= now
    ),
  ];
  const files = [...new Set(generations.flatMap((generation) => generation.files))].sort();
  const current = new Set(currentFiles);
  // Validate all cache inputs before copying anything into the publish directory.
  for (const file of files.filter((file) => !current.has(file))) {
    await requireDirectory(join(cacheRoot, 'assets'));
    await requireFile(join(cacheRoot, 'assets', file));
  }
  for (const file of files.filter((file) => !current.has(file))) {
    await copyFile(
      join(cacheRoot, 'assets', file),
      join(assetsRoot, file),
      constants.COPYFILE_EXCL
    );
  }
  // Rebuild the cache from the selected files, removing expired and untracked entries.
  await mkdir(cacheRoot, { recursive: true });
  await rm(join(cacheRoot, 'assets'), { recursive: true, force: true });
  await mkdir(join(cacheRoot, 'assets'));
  for (const file of files) {
    await copyFile(join(assetsRoot, file), join(cacheRoot, 'assets', file));
  }
  const manifest: Manifest = { version: 1, generations };
  await writeFile(join(cacheRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Retains recent assets, discarding a restored cache that fails validation so one
 * bad cache entry cannot block every later deploy. Invalid arguments and invalid
 * current-build assets still fail, and the cache is removed only after the
 * arguments pass.
 *
 * @example
 * await retainDeployAssetsOrReset('dist/_astro', '/tmp/deploy-assets', '12345-1');
 */
export async function retainDeployAssetsOrReset(
  assetsDir: string,
  cacheDir: string,
  generationId: string,
  now = Date.now(),
  warn: (message: string) => void = console.warn
): Promise<Manifest> {
  const { assetsRoot, cacheRoot } = resolveRoots(assetsDir, cacheDir, generationId, now);
  // Current-build errors must fail before the restored cache can be discarded.
  await readCurrentAssets(assetsRoot);
  try {
    return await retainDeployAssets(assetsDir, cacheDir, generationId, now);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warn(`asset cache: expected a valid restored cache, discarding it | received: ${reason}`);
    await rm(cacheRoot, { recursive: true, force: true });
    return retainDeployAssets(assetsDir, cacheDir, generationId, now);
  }
}

/**
 * Records when Wrangler finished so the retirement grace starts after deployment.
 *
 * @example
 * await confirmDeployment('/tmp/deploy-assets', '12345-1');
 */
export async function confirmDeployment(
  cacheDir: string,
  generationId: string,
  now = Date.now()
): Promise<void> {
  const manifest = await readManifest(resolve(cacheDir));
  const current = manifest.generations[0];
  if (
    !current ||
    current.id !== generationId ||
    !Number.isSafeInteger(now) ||
    now < current.deployedAt
  ) {
    throw new Error(
      `deployment confirmation: expected current generation ${generationId} and a time at or after staging | received: ${now}`
    );
  }
  current.deployedAt = now;
  await writeFile(join(cacheDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function resolveRoots(
  assetsDir: string,
  cacheDir: string,
  generationId: string,
  now: number
): { assetsRoot: string; cacheRoot: string } {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error(`deploy time: expected non-negative integer milliseconds | received: ${now}`);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(generationId)) {
    throw new Error(
      `generation id: expected letters, digits, underscores or hyphens | received: ${generationId}`
    );
  }
  const assetsRoot = resolve(assetsDir);
  const cacheRoot = resolve(cacheDir);
  if (
    assetsRoot === cacheRoot ||
    assetsRoot.startsWith(`${cacheRoot}/`) ||
    cacheRoot.startsWith(`${assetsRoot}/`)
  ) {
    throw new Error('asset and cache directories: expected separate, non-overlapping paths');
  }
  return { assetsRoot, cacheRoot };
}

async function readCurrentAssets(assetsRoot: string): Promise<string[]> {
  await requireDirectory(assetsRoot);
  const files = (await readdir(assetsRoot)).sort();
  for (const file of files) {
    await requireFile(join(assetsRoot, file));
    validateAssetName(file);
  }
  return files;
}

function validateAssetName(file: string): void {
  if (!ASSET_NAME.test(file)) {
    throw new Error(`asset name: expected a flat hashed static asset filename | received: ${file}`);
  }
}

async function requireFile(path: string): Promise<void> {
  const message = `asset path: expected a regular file without symlinks | received: ${path}`;
  let stats: Stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    throw new Error(message, { cause: error });
  }
  if (!stats.isFile()) throw new Error(message);
}

async function requireDirectory(path: string): Promise<void> {
  if (!(await lstat(path)).isDirectory()) {
    throw new Error(`asset directory: expected a directory without symlinks | received: ${path}`);
  }
}

async function readManifest(cacheRoot: string): Promise<Manifest> {
  try {
    await requireDirectory(cacheRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, generations: [] };
    throw error;
  }
  if ((await readdir(cacheRoot)).length === 0) return { version: 1, generations: [] };
  const path = join(cacheRoot, 'manifest.json');
  await requireFile(path);
  const input: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isManifest(input)) {
    throw new Error(
      'asset manifest: expected version 1 and uniquely named generations with file arrays and deployment times'
    );
  }
  for (const generation of input.generations) {
    for (const file of generation.files) validateAssetName(file);
  }
  return input;
}

function isManifest(value: unknown): value is Manifest {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('generations' in value) ||
    !Array.isArray(value.generations)
  )
    return false;
  const generations = value.generations;
  return (
    generations.every((generation: unknown) => {
      if (
        !generation ||
        typeof generation !== 'object' ||
        !('id' in generation) ||
        typeof generation.id !== 'string' ||
        !/^[A-Za-z0-9_-]+$/.test(generation.id) ||
        !('deployedAt' in generation) ||
        !Number.isSafeInteger(generation.deployedAt) ||
        (generation.deployedAt as number) < 0 ||
        !('files' in generation) ||
        !Array.isArray(generation.files)
      )
        return false;
      return generation.files.every((file: unknown) => typeof file === 'string');
    }) &&
    new Set(generations.map((generation: Generation) => generation.id)).size === generations.length
  );
}

if (import.meta.main) {
  const [assetsDir, cacheDir, generationId, mode] = process.argv.slice(2);
  if (!assetsDir || !cacheDir || !generationId) {
    throw new Error(
      'expected: bun scripts/retain-deploy-assets.ts <assets-dir> <cache-dir> <generation-id>'
    );
  }
  if (mode === '--confirm') {
    await confirmDeployment(cacheDir, generationId);
  } else {
    const manifest = await retainDeployAssetsOrReset(assetsDir, cacheDir, generationId);
    console.warn(`Retained ${manifest.generations.length} deploy generations.`);
  }
}
