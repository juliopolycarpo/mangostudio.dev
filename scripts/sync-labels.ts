import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface LabelDefinition {
  name: string;
  color: string;
  description: string;
}

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const dryRun = process.argv.includes('--dry-run');
const labelsPath = join(process.cwd(), '.github', 'labels.json');

const labels = await readLabels(labelsPath);
validateLabels(labels);

if (dryRun) {
  process.stdout.write(`[ok] ${labels.length} labels are defined in .github/labels.json\n`);
  process.exit(0);
}

for (const label of labels) {
  const edit = await gh([
    'label',
    'edit',
    label.name,
    '--color',
    label.color,
    '--description',
    label.description,
  ]);

  if (edit.code === 0) {
    process.stdout.write(`[ok] updated ${label.name}\n`);
    continue;
  }

  const create = await gh([
    'label',
    'create',
    label.name,
    '--color',
    label.color,
    '--description',
    label.description,
  ]);

  if (create.code !== 0) {
    process.stderr.write(`[fail] could not sync ${label.name}\n`);
    process.stderr.write(create.stderr || edit.stderr);
    process.exitCode = 1;
    continue;
  }

  process.stdout.write(`[ok] created ${label.name}\n`);
}

async function readLabels(filePath: string): Promise<LabelDefinition[]> {
  const text = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error('.github/labels.json must contain an array.');
  }

  return parsed.map((entry) => {
    if (!isLabelDefinition(entry)) {
      throw new Error('.github/labels.json contains an invalid label definition.');
    }

    return entry;
  });
}

function validateLabels(labels: LabelDefinition[]): void {
  const names = new Set<string>();

  for (const label of labels) {
    if (names.has(label.name)) {
      throw new Error(`Duplicate label: ${label.name}`);
    }

    if (!/^[0-9a-f]{6}$/i.test(label.color)) {
      throw new Error(`${label.name} must use a six-character hex color without #.`);
    }

    names.add(label.name);
  }
}

function isLabelDefinition(value: unknown): value is LabelDefinition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.color === 'string' &&
    typeof candidate.description === 'string'
  );
}

function gh(args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
