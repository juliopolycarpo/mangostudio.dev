/** Language-neutral site constants: URLs, install commands, provider glyphs.
 *  Localized copy lives in src/i18n/{pt,en}.ts. */

import { RELEASE } from './releases.generated';

export const GITHUB_URL = 'https://github.com/juliopolycarpo/mangostudio';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const CONTRIBUTING_URL =
  'https://github.com/juliopolycarpo/mangostudio.dev/blob/main/CONTRIBUTING.md';
export const REPO = 'juliopolycarpo/mangostudio';
export const VERSION = RELEASE.version;

export type ChannelStatus = 'ready' | 'planned';

export interface InstallTab {
  id: string;
  label: string;
  cmd: string;
  status: ChannelStatus;
}

/** Hero install widget — the tabbed channel switcher. */
export const INSTALL_TABS: InstallTab[] = [
  {
    id: 'bun',
    label: 'bun',
    cmd: RELEASE.installCmd,
    status: 'ready',
  },
  {
    id: 'npm',
    label: 'npm',
    cmd: 'npm i -g mangostudio',
    status: 'ready',
  },
  {
    id: 'brew',
    label: 'brew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'ready',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash',
    status: 'ready',
  },
  {
    id: 'scoop',
    label: 'scoop',
    cmd: 'scoop bucket add juliopolycarpo https://github.com/juliopolycarpo/scoop-bucket && scoop install mangostudio',
    status: 'ready',
  },
  {
    id: 'cargo',
    label: 'cargo',
    cmd: 'cargo install mangostudio',
    status: 'ready',
  },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 -v mango-data:/data ghcr.io/juliopolycarpo/mangostudio',
    status: 'ready',
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
  {
    id: 'brew',
    label: 'homebrew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'ready',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash',
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
