import { strictEqual, throws } from 'node:assert/strict';
import { type ReleaseChannel, releaseChannel } from '../src/data/release-channel';
import { en } from '../src/i18n/en';
import { pt } from '../src/i18n/pt';

const CANARY_VERSION = 'v0.1.0-canary.b7be89c';
const STABLE_VERSION = 'v0.1.1';

const CHANNEL_FIXTURES: Array<{ version: string; channel: ReleaseChannel }> = [
  { version: CANARY_VERSION, channel: 'canary' },
  { version: 'v0.2.0-canary', channel: 'canary' },
  { version: STABLE_VERSION, channel: 'stable' },
  { version: '1.2.3', channel: 'stable' },
];

// Words the badge and intro must use for each channel, per locale.
const CHANNEL_WORDS = {
  en: { canary: /canary/i, stable: /stable/i },
  pt: { canary: /canary/i, stable: /est[áa]vel/i },
} as const;

for (const { version, channel } of CHANNEL_FIXTURES) {
  run(`releaseChannel classifies ${version} as ${channel}`, () => {
    strictEqual(
      releaseChannel(version),
      channel,
      `expected channel for ${version}: ${channel} | received: ${releaseChannel(version)}`
    );
  });
}

run('releaseChannel rejects unknown version shapes', () => {
  for (const version of ['', 'latest', 'v1.0.0-rc.1']) {
    throws(
      () => releaseChannel(version),
      /Unrecognized release version/,
      `expected releaseChannel("${version}") to throw`
    );
  }
});

for (const [lang, content] of [
  ['en', en],
  ['pt', pt],
] as const) {
  for (const version of [CANARY_VERSION, STABLE_VERSION]) {
    run(`${lang} release label matches the channel of ${version}`, () => {
      const channel = releaseChannel(version);
      const other: ReleaseChannel = channel === 'canary' ? 'stable' : 'canary';
      const labels = {
        badge: content.releases.latestBadge[channel],
        intro: content.releases.intro[channel],
      };

      for (const [slot, text] of Object.entries(labels)) {
        strictEqual(
          CHANNEL_WORDS[lang][channel].test(text),
          true,
          `expected ${lang} ${slot} for ${channel} to match ${CHANNEL_WORDS[lang][channel]} | received: "${text}"`
        );
        strictEqual(
          CHANNEL_WORDS[lang][other].test(text),
          false,
          `expected ${lang} ${slot} for ${channel} not to match ${CHANNEL_WORDS[lang][other]} | received: "${text}"`
        );
      }
    });
  }
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
