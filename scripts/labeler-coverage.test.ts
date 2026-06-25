import { ok, strictEqual } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const labelerPath = join(process.cwd(), '.github', 'labeler.yml');

const dependencyManifestPaths = ['package.json', 'bun.lock', '.github/dependabot.yml'] as const;

const labelerText = await readFile(labelerPath, 'utf8');
const labelGlobs = parseLabelerConfig(labelerText);

run('dependency manifest paths match at least one area: label', () => {
  for (const filePath of dependencyManifestPaths) {
    const areaLabels = matchingLabels(filePath, (label) => label.startsWith('area: '));
    ok(
      areaLabels.length > 0,
      `${filePath} is not covered by any area: label in ${labelerPath} (matched: ${areaLabels.join(', ') || 'none'})`
    );
  }
});

run('dependency manifest paths match at least one type: label', () => {
  for (const filePath of dependencyManifestPaths) {
    const typeLabels = matchingLabels(filePath, (label) => label.startsWith('type: '));
    ok(
      typeLabels.length > 0,
      `${filePath} is not covered by any type: label in ${labelerPath} (matched: ${typeLabels.join(', ') || 'none'})`
    );
  }
});

run('package.json-only changes resolve to area: tooling and type: dependencies', () => {
  const filePath = 'package.json';
  const areaLabels = matchingLabels(filePath, (label) => label.startsWith('area: '));
  const typeLabels = matchingLabels(filePath, (label) => label.startsWith('type: '));

  ok(areaLabels.includes('area: tooling'), `expected area: tooling, got ${areaLabels.join(', ')}`);
  ok(
    typeLabels.includes('type: dependencies'),
    `expected type: dependencies, got ${typeLabels.join(', ')}`
  );
});

run('bun.lock-only changes resolve to area: tooling and type: dependencies', () => {
  const filePath = 'bun.lock';
  const areaLabels = matchingLabels(filePath, (label) => label.startsWith('area: '));
  const typeLabels = matchingLabels(filePath, (label) => label.startsWith('type: '));

  ok(areaLabels.includes('area: tooling'), `expected area: tooling, got ${areaLabels.join(', ')}`);
  ok(
    typeLabels.includes('type: dependencies'),
    `expected type: dependencies, got ${typeLabels.join(', ')}`
  );
});

function matchingLabels(filePath: string, predicate: (label: string) => boolean): string[] {
  const matches: string[] = [];

  for (const [label, globs] of labelGlobs) {
    if (!predicate(label)) {
      continue;
    }

    if (globs.some((glob) => globMatches(filePath, glob))) {
      matches.push(label);
    }
  }

  return matches;
}

function parseLabelerConfig(text: string): Map<string, string[]> {
  const configs = new Map<string, string[]>();
  const blocks = text.split(/^"([^"]+)":/m);

  for (let index = 1; index < blocks.length; index += 2) {
    const label = blocks[index];
    const block = blocks[index + 1] ?? '';

    if (!label) {
      continue;
    }

    configs.set(label, extractGlobsFromBlock(block));
  }

  return configs;
}

function extractGlobsFromBlock(block: string): string[] {
  const marker = 'any-glob-to-any-file';
  const markerIndex = block.indexOf(marker);

  if (markerIndex === -1) {
    return [];
  }

  const section = block.slice(markerIndex);
  const globs: string[] = [];
  const inline = section.match(/^any-glob-to-any-file:\s*"([^"]+)"/m);

  if (inline?.[1]) {
    globs.push(inline[1]);
  }

  for (const match of section.matchAll(/^\s+-\s+"([^"]+)"/gm)) {
    if (match[1]) {
      globs.push(match[1]);
    }
  }

  return globs;
}

function globMatches(filePath: string, pattern: string): boolean {
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return filePath === pattern;
  }

  const segments = pattern.split('/');
  let regexSource = '';

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;

    if (segment === '**') {
      // Trailing `**` matches everything beneath the parent directory; a middle
      // `**/` matches zero or more leading path segments (including none).
      regexSource += isLast ? '.*' : '(?:.*/)?';
      if (!isLast) {
        return;
      }
    } else {
      regexSource += segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
    }

    if (!isLast) {
      regexSource += '/';
    }
  });

  return new RegExp(`^${regexSource}$`).test(filePath);
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}

strictEqual(labelGlobs.size > 0, true, `${labelerPath} did not parse any label rules`);
