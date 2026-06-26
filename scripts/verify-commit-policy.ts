import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const zeroOidPattern = /^0{40}$/;
const signatureHeaderPattern = /^gpgsig(?:-sha256)?(?: |$)/;
const trailerPattern = /^[A-Za-z0-9-]+:\s+\S/;
const signoffPattern = /^Signed-off-by:\s*(?<name>[^<]+?)\s*<(?<email>[^<>\s@]+@[^<>\s@]+)>$/i;
const scissorsPattern = /^# ------------------------ >8 ------------------------/;

export interface Identity {
  name: string;
  email: string;
}

export interface CommitRecord {
  sha: string;
  message: string;
  author: Identity | null;
  committer: Identity | null;
  hasSignature: boolean;
}

export interface CommitPolicyResult {
  scope: string;
  errors: string[];
}

interface MessageValidationOptions {
  identities?: Identity[];
}

interface TrailerBlock {
  start: number;
  end: number;
}

interface PushUpdate {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

if (import.meta.main) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}

export async function main(args: string[]): Promise<number> {
  const results = await runFromArgs(args);
  const failures = results.filter((result) => result.errors.length > 0);

  if (failures.length === 0) {
    return 0;
  }

  for (const failure of failures) {
    for (const error of failure.errors) {
      process.stderr.write(`${failure.scope}: ${error}\n`);
    }
  }

  return 1;
}

export async function runFromArgs(args: string[]): Promise<CommitPolicyResult[]> {
  const [command, value, ...rest] = args;

  switch (command) {
    case '--message':
      return [await validateMessageFile(value)];
    case '--commit':
      return validateExistingCommits(requireValues('--commit', [value, ...rest]));
    case '--range':
      return validateExistingCommits(listCommitsInRange(requireValue('--range', value)));
    case '--head':
      return validateExistingCommits(['HEAD']);
    case '--pre-push':
      return validatePrePush(await readStdin(), value);
    case '--rewritten':
      return validateRewrittenCommits(await readStdin());
    default:
      return [
        {
          scope: 'usage',
          errors: [
            'expected --message <path>, --commit <sha...>, --range <base..head>, --head, --pre-push [remote], or --rewritten',
          ],
        },
      ];
  }
}

export function validateCommitMessage(
  rawMessage: string,
  options: MessageValidationOptions = {}
): string[] {
  const message = stripGitMessageComments(rawMessage);
  const lines = message.split('\n');
  const errors: string[] = [];
  const subjectIndex = lines.findIndex((line) => line.trim() !== '');

  if (subjectIndex === -1) {
    return ['commit message must have a subject'];
  }

  const trailerBlock = findFinalTrailerBlock(lines);
  const trailerLines = trailerBlock ? lines.slice(trailerBlock.start, trailerBlock.end + 1) : [];
  const trailerSignoffs = parseSignoffs(trailerLines.join('\n'));

  const expectedIdentities = options.identities ?? [];

  if (trailerSignoffs.length === 0) {
    errors.push('commit message must end with a DCO Signed-off-by trailer');
  } else if (
    expectedIdentities.length > 0 &&
    !trailerSignoffs.some((signoff) => identityListIncludesEmail(expectedIdentities, signoff.email))
  ) {
    errors.push('DCO Signed-off-by trailer must match the author or committer email');
  }

  const afterSubjectStart = subjectIndex + 1;
  const firstLineAfterSubject = lines[afterSubjectStart];

  if (firstLineAfterSubject !== undefined && firstLineAfterSubject.trim() !== '') {
    errors.push('commit subject and body must be separated by a blank line');
  }

  const bodyEnd = trailerBlock
    ? trimBlankLineBeforeTrailer(lines, trailerBlock.start)
    : lines.length;
  const bodyLines = lines.slice(afterSubjectStart, bodyEnd);
  const hasBody = bodyLines.some((line) => isBodyContent(line));

  if (!hasBody) {
    errors.push('commit message must include a non-empty body before trailers');
  }

  return errors;
}

export function commitHasSignature(rawCommit: string): boolean {
  const headerEnd = rawCommit.indexOf('\n\n');
  const header = headerEnd === -1 ? rawCommit : rawCommit.slice(0, headerEnd);

  return header.split('\n').some((line) => signatureHeaderPattern.test(line));
}

export function parsePrePushInput(input: string): PushUpdate[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);

      if (!localRef || !localSha || !remoteRef || !remoteSha) {
        throw new Error(`invalid pre-push line: ${line}`);
      }

      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export function parseSignoffs(message: string): Identity[] {
  return message
    .split('\n')
    .map((line) => signoffPattern.exec(line.trim()))
    .filter((match): match is RegExpExecArray & { groups: { name: string; email: string } } =>
      Boolean(match?.groups)
    )
    .map((match) => ({
      name: match.groups.name.trim(),
      email: match.groups.email.trim(),
    }));
}

async function validateMessageFile(path: string | undefined): Promise<CommitPolicyResult> {
  const messagePath = requireValue('--message', path);
  const message = await readFile(messagePath, 'utf8');

  return {
    scope: messagePath,
    errors: validateCommitMessage(message, { identities: currentGitIdentities() }),
  };
}

function validateExistingCommits(shas: string[]): CommitPolicyResult[] {
  const uniqueShas = [...new Set(shas)].filter(Boolean);

  return uniqueShas.map((sha) => {
    const commit = readCommit(sha);
    const identities = [commit.author, commit.committer].filter((identity): identity is Identity =>
      Boolean(identity)
    );
    const errors = validateCommitMessage(commit.message, { identities });

    if (!commit.hasSignature) {
      errors.push('commit must include a GPG or SSH signature (-S)');
    }

    return {
      scope: shortSha(commit.sha),
      errors,
    };
  });
}

function validatePrePush(input: string, remoteName = 'origin'): CommitPolicyResult[] {
  const shas = parsePrePushInput(input).flatMap((update) =>
    listCommitsForPushUpdate(update, remoteName)
  );

  return validateExistingCommits(shas);
}

function validateRewrittenCommits(input: string): CommitPolicyResult[] {
  const shas = input
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1])
    .filter((sha): sha is string => Boolean(sha) && !zeroOidPattern.test(sha));

  return validateExistingCommits(shas);
}

function listCommitsForPushUpdate(update: PushUpdate, remoteName: string): string[] {
  if (zeroOidPattern.test(update.localSha)) {
    return [];
  }

  if (zeroOidPattern.test(update.remoteSha)) {
    return gitLines([
      'rev-list',
      '--reverse',
      update.localSha,
      '--not',
      `--remotes=${remoteName || 'origin'}`,
    ]);
  }

  return listCommitsInRange(`${update.remoteSha}..${update.localSha}`);
}

function listCommitsInRange(range: string): string[] {
  return gitLines(['rev-list', '--reverse', range]);
}

function readCommit(rev: string): CommitRecord {
  const rawCommit = gitOutput(['cat-file', 'commit', rev]);
  const messageStart = rawCommit.indexOf('\n\n');
  const header = messageStart === -1 ? rawCommit : rawCommit.slice(0, messageStart);
  const message = messageStart === -1 ? '' : rawCommit.slice(messageStart + 2);
  const sha = gitOutput(['rev-parse', rev]).trim();

  return {
    sha,
    message,
    author: parseIdentityHeader(header, 'author'),
    committer: parseIdentityHeader(header, 'committer'),
    hasSignature: commitHasSignature(rawCommit),
  };
}

function parseIdentityHeader(header: string, field: 'author' | 'committer'): Identity | null {
  const line = header.split('\n').find((candidate) => candidate.startsWith(`${field} `));
  const match = line?.match(/^[a-z]+ (?<name>.+) <(?<email>[^<>]+)> \d+ [+-]\d{4}$/);

  if (!match?.groups) {
    return null;
  }

  return {
    name: match.groups.name.trim(),
    email: match.groups.email.trim(),
  };
}

function currentGitIdentities(): Identity[] {
  return ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']
    .map((variable) => {
      try {
        return parseGitVarIdentity(gitOutput(['var', variable]));
      } catch {
        return null;
      }
    })
    .filter((identity): identity is Identity => Boolean(identity));
}

function parseGitVarIdentity(value: string): Identity | null {
  const match = value.trim().match(/^(?<name>.+) <(?<email>[^<>]+)> \d+ [+-]\d{4}$/);

  if (!match?.groups) {
    return null;
  }

  return {
    name: match.groups.name.trim(),
    email: match.groups.email.trim(),
  };
}

function findFinalTrailerBlock(lines: string[]): TrailerBlock | null {
  let end = lines.length - 1;

  while (end >= 0 && lines[end]?.trim() === '') {
    end -= 1;
  }

  if (end < 0) {
    return null;
  }

  let start = end;
  while (start >= 0 && trailerPattern.test(lines[start]?.trim() ?? '')) {
    start -= 1;
  }

  const trailerStart = start + 1;
  if (trailerStart > end) {
    return null;
  }

  return { start: trailerStart, end };
}

function trimBlankLineBeforeTrailer(lines: string[], trailerStart: number): number {
  let bodyEnd = trailerStart;

  while (bodyEnd > 0 && lines[bodyEnd - 1]?.trim() === '') {
    bodyEnd -= 1;
  }

  return bodyEnd;
}

function isBodyContent(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed !== '---------';
}

function stripGitMessageComments(message: string): string {
  const lines: string[] = [];

  for (const line of message.replace(/\r\n?/g, '\n').split('\n')) {
    if (scissorsPattern.test(line)) {
      break;
    }

    if (!line.startsWith('#')) {
      lines.push(line.trimEnd());
    }
  }

  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function identityListIncludesEmail(identities: Identity[], email: string): boolean {
  const normalized = email.toLowerCase();
  return identities.some((identity) => identity.email.toLowerCase() === normalized);
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function requireValues(flag: string, values: string[]): string[] {
  const filtered = values.filter(Boolean);

  if (filtered.length === 0) {
    throw new Error(`${flag} requires at least one value`);
  }

  return filtered;
}

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function gitLines(args: string[]): string[] {
  return gitOutput(args)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function shortSha(sha: string): string {
  return sha.slice(0, 12);
}

async function readStdin(): Promise<string> {
  let input = '';

  for await (const chunk of process.stdin) {
    input += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
  }

  return input;
}
