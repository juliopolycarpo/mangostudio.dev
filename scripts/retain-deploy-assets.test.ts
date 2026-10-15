import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmDeployment, retainDeployAssets } from './retain-deploy-assets';

class FakeDeployDirectories {
  readonly assets: string;
  readonly cache: string;

  constructor(readonly root: string) {
    this.assets = join(root, 'dist', '_astro');
    this.cache = join(root, 'cache');
  }

  async build(files: Record<string, string>): Promise<void> {
    await rm(this.assets, { recursive: true, force: true });
    await mkdir(this.assets, { recursive: true });
    for (const [file, text] of Object.entries(files))
      await writeFile(join(this.assets, file), text);
  }

  async seedManifest(files: string[]): Promise<void> {
    await mkdir(join(this.cache, 'assets'), { recursive: true });
    await writeFile(
      join(this.cache, 'manifest.json'),
      JSON.stringify({
        version: 1,
        generations: [{ id: 'old', files, deployedAt: 0 }],
      })
    );
  }
}

await run('starts without a cache and stores only hashed assets outside dist', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  const result = await retainDeployAssets(fake.assets, fake.cache, 'first', 0);
  deepStrictEqual(result.generations, [
    { id: 'first', files: ['page.abcdefgh.css'], deployedAt: 0 },
  ]);
  deepStrictEqual(await readdir(join(fake.root, 'dist')), ['_astro']);
  strictEqual(await readFile(join(fake.cache, 'assets', 'page.abcdefgh.css'), 'utf8'), 'current');
});

await run('supports an existing empty cache directory', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await mkdir(fake.cache);
  strictEqual(
    (await retainDeployAssets(fake.assets, fake.cache, 'first', 0)).generations.length,
    1
  );
});

await run(
  'current assets win filename collisions in both publish and cache output',
  async (fake) => {
    await fake.build({ 'page.abcdefgh.css': 'old', 'old.abcdefgh.js': 'old script' });
    await retainDeployAssets(fake.assets, fake.cache, 'first', 0);
    await fake.build({ 'page.abcdefgh.css': 'current' });
    await retainDeployAssets(fake.assets, fake.cache, 'second', 700_000);
    strictEqual(await readFile(join(fake.assets, 'page.abcdefgh.css'), 'utf8'), 'current');
    strictEqual(await readFile(join(fake.cache, 'assets', 'page.abcdefgh.css'), 'utf8'), 'current');
    strictEqual(await readFile(join(fake.assets, 'old.abcdefgh.js'), 'utf8'), 'old script');
  }
);

await run(
  'prunes beyond three generations after grace while preserving reused assets',
  async (fake) => {
    for (let generation = 0; generation < 4; generation++) {
      await fake.build({
        [`page${generation}.abcdefgh.css`]: `build ${generation}`,
        'shared.abcdefgh.woff2': 'font',
      });
      await retainDeployAssets(
        fake.assets,
        fake.cache,
        `build-${generation}`,
        generation * 700_000
      );
    }
    deepStrictEqual((await readdir(fake.assets)).sort(), [
      'page1.abcdefgh.css',
      'page2.abcdefgh.css',
      'page3.abcdefgh.css',
      'shared.abcdefgh.woff2',
    ]);
    deepStrictEqual(
      (await readdir(join(fake.cache, 'assets'))).sort(),
      (await readdir(fake.assets)).sort()
    );
  }
);

await run(
  'retains more than three rapid deploys for 600 seconds after retirement',
  async (fake) => {
    for (let generation = 0; generation < 5; generation++) {
      await fake.build({ [`page${generation}.abcdefgh.css`]: `build ${generation}` });
      // The first build was active for a long time before the rapid deploys.
      const now = generation === 0 ? 0 : 1_000_000 + generation * 1000;
      await retainDeployAssets(fake.assets, fake.cache, `build-${generation}`, now);
    }
    strictEqual((await readdir(fake.assets)).sort().length, 5);
    await fake.build({ 'page5.abcdefgh.css': 'after grace' });
    const result = await retainDeployAssets(fake.assets, fake.cache, 'build-5', 2_000_000);
    deepStrictEqual(
      result.generations.map((generation) => generation.id),
      ['build-5', 'build-4', 'build-3']
    );
    deepStrictEqual((await readdir(fake.assets)).sort(), [
      'page3.abcdefgh.css',
      'page4.abcdefgh.css',
      'page5.abcdefgh.css',
    ]);
  }
);

await run(
  'confirms deployment completion and rejects a mismatched generation or time',
  async (fake) => {
    await fake.build({ 'page.abcdefgh.css': 'current' });
    await retainDeployAssets(fake.assets, fake.cache, 'current', 100);
    await confirmDeployment(fake.cache, 'current', 200);
    const manifest = JSON.parse(await readFile(join(fake.cache, 'manifest.json'), 'utf8'));
    strictEqual(manifest.generations[0].deployedAt, 200);
    await rejects(confirmDeployment(fake.cache, 'other', 300), /expected current generation other/);
    await rejects(confirmDeployment(fake.cache, 'current', 199), /time at or after staging/);
  }
);

await run('rejects manifest traversal before writing to dist', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await fake.seedManifest(['../../outside.abcdefgh.js']);
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /expected a flat hashed static asset filename.*\.\.\/\.\.\/outside/
  );
  deepStrictEqual((await readdir(fake.assets)).sort(), ['page.abcdefgh.css']);
});

await run('rejects symlink cache files and cache asset directories', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await fake.seedManifest(['old.abcdefgh.js']);
  await symlink(
    join(fake.assets, 'page.abcdefgh.css'),
    join(fake.cache, 'assets', 'old.abcdefgh.js')
  );
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /expected a regular file without symlinks/
  );
  await rm(join(fake.cache, 'assets'), { recursive: true });
  await symlink(fake.assets, join(fake.cache, 'assets'));
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /expected a directory without symlinks/
  );
});

await run('rejects malformed manifests and unversioned current files', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await fake.seedManifest([]);
  await writeFile(join(fake.cache, 'manifest.json'), '{"version": 2, "generations": []}');
  await rejects(retainDeployAssets(fake.assets, fake.cache, 'current', 0), /expected version 1/);
  await fake.build({ 'page.css': 'unversioned' });
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /expected a flat hashed static asset filename.*page.css/
  );
});

await run('rejects overlapping directories and invalid arguments', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await rejects(
    retainDeployAssets(fake.assets, fake.assets, 'current', 0),
    /expected separate, non-overlapping paths/
  );
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, '../bad', 0),
    /generation id: expected/
  );
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', -1),
    /deploy time: expected/
  );
});

await run('reports missing retained cache members as invalid asset files', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await fake.seedManifest(['missing.abcdefgh.js']);
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /asset path: expected a regular file without symlinks \| received: .*missing\.abcdefgh\.js/
  );
  deepStrictEqual(await readdir(fake.assets), ['page.abcdefgh.css']);
});

await run('reports a missing manifest in a nonempty cache as an invalid file', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await mkdir(join(fake.cache, 'assets'), { recursive: true });
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /asset path: expected a regular file without symlinks \| received: .*manifest\.json/
  );
});

await run('rejects nested current assets with the flat file contract', async (fake) => {
  await fake.build({ 'page.abcdefgh.css': 'current' });
  await mkdir(join(fake.assets, 'nested'));
  await rejects(
    retainDeployAssets(fake.assets, fake.cache, 'current', 0),
    /asset path: expected a regular file without symlinks \| received: .*nested/
  );
});

async function run(
  name: string,
  test: (fake: FakeDeployDirectories) => Promise<void>
): Promise<void> {
  const fake = new FakeDeployDirectories(
    await mkdtemp(join(tmpdir(), 'fix-retain-deploy-assets-'))
  );
  try {
    await test(fake);
    process.stdout.write(`[ok] ${name}\n`);
  } finally {
    await rm(fake.root, { recursive: true, force: true });
  }
}
