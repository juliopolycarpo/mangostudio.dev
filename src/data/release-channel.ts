export type ReleaseChannel = 'canary' | 'stable';

const CANARY_VERSION = /^v?\d+\.\d+\.\d+-canary(?:[.-][0-9A-Za-z.-]+)?$/;
const STABLE_VERSION = /^v?\d+\.\d+\.\d+(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Derives the release channel from a release version string.
 *
 * A `-canary` prerelease is `canary`; a plain `MAJOR.MINOR.PATCH` version is `stable`.
 * Any other shape throws, so a new prerelease kind is labelled on purpose, not by accident.
 *
 * @example
 * releaseChannel('v0.1.0-canary.b7be89c'); // 'canary'
 * releaseChannel('v0.1.1'); // 'stable'
 */
export function releaseChannel(version: string): ReleaseChannel {
  if (CANARY_VERSION.test(version)) return 'canary';
  if (STABLE_VERSION.test(version)) return 'stable';

  throw new Error(
    `Unrecognized release version: "${version}" | expected vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-canary[.id]`
  );
}
