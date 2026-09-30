import { INSTALL_PS1_URL, INSTALL_SH_URL, POWERSHELL_INSTALL_CMD } from '../src/data/site';
import type { Lang } from '../src/i18n/types';

/** Upstream release-asset installer URLs that the current release does not publish. */
const UPSTREAM_INSTALLER_URLS: ReadonlyArray<readonly [string, string]> = [
  [
    'https://github.com/juliopolycarpo/mangostudio/releases/latest/download/install.sh',
    INSTALL_SH_URL,
  ],
  [
    'https://github.com/juliopolycarpo/mangostudio/releases/latest/download/install.ps1',
    INSTALL_PS1_URL,
  ],
];

const RELEASES_LATEST_URL = 'https://github.com/juliopolycarpo/mangostudio/releases/latest';

/** Upstream Windows paragraph (release-asset download) and its hosted replacement, per locale. */
const WINDOWS_PARAGRAPH: Record<Lang, { upstream: RegExp; hosted: string }> = {
  en: {
    upstream: new RegExp(
      `On Windows, download and run \`install\\.ps1\` from the\\s+\\[latest release\\]\\(${escapeRegExp(RELEASES_LATEST_URL)}\\),\\s+(?=or use Scoop)`
    ),
    hosted: `On Windows, run the hosted PowerShell installer:\n\n\`\`\`powershell\n${POWERSHELL_INSTALL_CMD}\n\`\`\`\n\n`,
  },
  pt: {
    upstream: new RegExp(
      `No Windows, baixe e execute \`install\\.ps1\` na\\s+\\[release mais recente\\]\\(${escapeRegExp(RELEASES_LATEST_URL)}\\),\\s+(?=ou use Scoop)`
    ),
    hosted: `No Windows, execute o instalador PowerShell hospedado:\n\n\`\`\`powershell\n${POWERSHELL_INSTALL_CMD}\n\`\`\`\n\n`,
  },
};

const POWERSHELL_TABLE_ROW = `| PowerShell (Windows) | \`${POWERSHELL_INSTALL_CMD.replaceAll('|', '\\|')}\` |`;
const POWERSHELL_TABLE_ROW_PRESENT = /^\| PowerShell/m;
/** Any URL that fetches an installer script, wherever it is hosted. */
const INSTALLER_URL = /https?:\/\/[^\s`'")|\\]+\/install\.(?:sh|ps1)\b/g;
/** Old upstream prose that sends Windows users to download `install.ps1` from the releases page. */
const RELEASE_DOWNLOAD_PROSE = /`install\.ps1`[^`]{0,120}?\]\([^)]*\/releases\/latest\)/;
const HOMEBREW_TABLE_ROW = /^\| Homebrew \(macOS\/Linux\)/m;

/**
 * Point installer commands at the hosted endpoints owned by this site.
 *
 * Upstream documents `releases/latest/download/install.{sh,ps1}`, which the current release does
 * not publish; `public/install.{sh,ps1}` are canonical. Rewrites those URLs, then adds whatever
 * the upstream shape lacks: the PowerShell table row (only when no PowerShell row exists) and, for
 * the older upstream wording that sent Windows users to the releases page, the hosted PowerShell
 * block. Current upstream already carries both, so they are never duplicated, and already-hosted
 * text passes through unchanged.
 *
 * @example
 * applyHostedInstallers('curl -fsSL https://github.com/juliopolycarpo/mangostudio/releases/latest/download/install.sh | bash', 'en');
 * // 'curl -fsSL https://mangostudio.dev/install.sh | bash'
 */
export function applyHostedInstallers(markdown: string, lang: Lang): string {
  let output = markdown;

  for (const [upstreamUrl, hostedUrl] of UPSTREAM_INSTALLER_URLS) {
    output = output.replaceAll(upstreamUrl, hostedUrl);
  }

  const windows = WINDOWS_PARAGRAPH[lang];
  output = output.replace(windows.upstream, () => windows.hosted);

  if (!POWERSHELL_TABLE_ROW_PRESENT.test(output) && HOMEBREW_TABLE_ROW.test(output)) {
    output = output.replace(HOMEBREW_TABLE_ROW, (row) => `${POWERSHELL_TABLE_ROW}\n${row}`);
  }

  return output;
}

/**
 * Fail loudly when a quickstart lacks the hosted installers or still tells readers to fetch an
 * installer from anywhere else. Prose that merely names `install.ps1` next to the hosted URL is
 * fine; an installer URL other than the hosted ones, or the old "download from the releases
 * page" instruction, is not.
 *
 * @example
 * assertHostedInstallers(applyHostedInstallers(readme, 'en'), 'README.md');
 */
export function assertHostedInstallers(markdown: string, sourcePath: string): void {
  const hosted = [INSTALL_SH_URL, INSTALL_PS1_URL];
  const missing = [
    INSTALL_SH_URL,
    POWERSHELL_INSTALL_CMD,
    `\`\`\`powershell\n${POWERSHELL_INSTALL_CMD}\n\`\`\``,
  ].filter((expected) => !markdown.includes(expected));
  const leftover = [
    ...(markdown.match(INSTALLER_URL) ?? []).filter((url) => !hosted.includes(url)),
    ...(RELEASE_DOWNLOAD_PROSE.test(markdown)
      ? ['`install.ps1` download from the releases page']
      : []),
  ];

  if (missing.length > 0 || leftover.length > 0) {
    throw new Error(
      `Quickstart ${sourcePath} has unexpected installer content | missing: ${JSON.stringify(missing)} | unhosted installer text: ${JSON.stringify(leftover)} | expected: only the hosted ${hosted.join(' and ')} installers; update scripts/sync-docs-installers.ts to match the upstream wording.`
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
