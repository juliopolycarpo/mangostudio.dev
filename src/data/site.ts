/** Language-neutral site constants: URLs, install commands, provider glyphs.
 *  Localized copy lives in src/i18n/{pt,en}.ts. */

import { RELEASE } from './releases.generated';

export const GITHUB_URL = 'https://github.com/juliopolycarpo/mangostudio';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const CONTRIBUTING_URL =
  'https://github.com/juliopolycarpo/mangostudio.dev/blob/main/CONTRIBUTING.md';
export const REPO = 'juliopolycarpo/mangostudio';
export const VERSION = RELEASE.version;
export const NPM_INSTALL_CMD = 'npm i -g mangostudio';
export const POWERSHELL_INSTALL_CMD = 'irm https://mangostudio.dev/install.ps1 | iex';
export const SHELL_INSTALL_CMD = 'curl -fsSL https://mangostudio.dev/install.sh | bash';

export type ChannelStatus = 'ready' | 'planned';
export type InstallPlatformId = 'windows' | 'linux' | 'macos' | 'docker';

export interface InstallPlatform {
  id: InstallPlatformId;
  label: string;
  defaultChannel: string;
}

export interface InstallTab {
  id: string;
  label: string;
  cmd: string;
  status: ChannelStatus;
  platforms: InstallPlatformId[];
  prompt: string;
}

export const DEFAULT_INSTALL_PLATFORM: InstallPlatformId = 'linux';

/** Hero install widget — the platform switcher shown above install channels. */
export const INSTALL_PLATFORMS: InstallPlatform[] = [
  { id: 'windows', label: 'Windows', defaultChannel: 'powershell' },
  { id: 'linux', label: 'Linux', defaultChannel: 'curl' },
  { id: 'macos', label: 'macOS', defaultChannel: 'curl' },
  { id: 'docker', label: 'Docker', defaultChannel: 'docker' },
];

/** Hero install widget — channel tabs filtered by the selected platform. */
export const INSTALL_TABS: InstallTab[] = [
  {
    id: 'powershell',
    label: 'powershell',
    cmd: POWERSHELL_INSTALL_CMD,
    status: 'ready',
    platforms: ['windows'],
    prompt: 'PS> ',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: SHELL_INSTALL_CMD,
    status: 'ready',
    platforms: ['linux', 'macos'],
    prompt: '$ ',
  },
  {
    id: 'bun',
    label: 'bun',
    cmd: RELEASE.installCmd,
    status: 'ready',
    platforms: ['windows', 'linux', 'macos'],
    prompt: '$ ',
  },
  {
    id: 'npm',
    label: 'npm',
    cmd: NPM_INSTALL_CMD,
    status: 'ready',
    platforms: ['windows', 'linux', 'macos'],
    prompt: '$ ',
  },
  {
    id: 'scoop',
    label: 'scoop',
    cmd: 'scoop bucket add juliopolycarpo https://github.com/juliopolycarpo/scoop-bucket && scoop install mangostudio',
    status: 'ready',
    platforms: ['windows'],
    prompt: 'PS> ',
  },
  {
    id: 'brew',
    label: 'brew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'ready',
    platforms: ['linux', 'macos'],
    prompt: '$ ',
  },
  {
    id: 'cargo',
    label: 'cargo',
    cmd: 'cargo install mangostudio',
    status: 'ready',
    platforms: ['windows', 'linux', 'macos'],
    prompt: '$ ',
  },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio',
    status: 'ready',
    platforms: ['docker'],
    prompt: '$ ',
  },
];

export interface Channel {
  id: string;
  label: string;
  cmd: string;
  status: ChannelStatus;
}

/** Install grid on the home page — every channel ships the same prebuilt binary. */
export const CHANNELS: Channel[] = [
  { id: 'bun', label: 'npm / bun', cmd: RELEASE.installCmd, status: 'ready' },
  { id: 'powershell', label: 'powershell', cmd: POWERSHELL_INSTALL_CMD, status: 'ready' },
  {
    id: 'brew',
    label: 'homebrew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'ready',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: SHELL_INSTALL_CMD,
    status: 'ready',
  },
  {
    id: 'scoop',
    label: 'scoop',
    cmd: 'scoop bucket add juliopolycarpo https://github.com/juliopolycarpo/scoop-bucket && scoop install mangostudio',
    status: 'ready',
  },
  { id: 'cargo', label: 'cargo', cmd: 'cargo install mangostudio', status: 'ready' },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio',
    status: 'ready',
  },
  {
    id: 'manual',
    label: 'manual',
    cmd: 'gh release download -R juliopolycarpo/mangostudio --pattern "*.tar.gz" --pattern SHA256SUMS && sha256sum -c SHA256SUMS',
    status: 'ready',
  },
];

export interface Provider {
  name: string;
  glyph: string;
}

export const PROVIDERS: Provider[] = [
  { name: 'Gemini', glyph: 'G' },
  { name: 'OpenAI', glyph: '◯' },
  { name: 'Anthropic', glyph: 'A' },
  { name: 'DeepSeek', glyph: 'D' },
  { name: 'OpenAI-compatible', glyph: '{}' },
];
