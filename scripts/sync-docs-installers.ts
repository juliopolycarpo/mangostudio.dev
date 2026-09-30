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

const POWERSHELL_TABLE_ROW = `| PowerShell (Windows) | \`${POWERSHELL_INSTALL_CMD.replace('|', '\\|')}\` |`;
const POWERSHELL_TABLE_ROW_PRESENT = /^\| PowerShell/m;
const HOMEBREW_TABLE_ROW = /^\| Homebrew \(macOS\/Linux\)/m;

/**
 * Point installer commands at the hosted endpoints owned by this site.
 *
 * Upstream documents `releases/latest/download/install.{sh,ps1}`, which the current release does
 * not publish; `public/install.{sh,ps1}` are canonical. Rewrites those URLs, adds the PowerShell
 * row to the install table, and swaps the upstream Windows paragraph for the hosted command.
 * Text that does not match the upstream wording is left untouched.
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
 * Fail loudly when a quickstart lacks the hosted installers, so an upstream wording change cannot
 * silently drop the site-owned PowerShell instructions.
 */
export function assertHostedInstallers(markdown: string, sourcePath: string): void {
  const missing = [POWERSHELL_INSTALL_CMD, INSTALL_SH_URL].filter(
    (expected) => !markdown.includes(expected)
  );

  if (missing.length > 0) {
    throw new Error(
      `Quickstart ${sourcePath} is missing hosted installer content: ${JSON.stringify(missing)}. Expected the hosted install.sh and install.ps1 commands; update scripts/sync-docs-installers.ts to match the upstream wording.`
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
