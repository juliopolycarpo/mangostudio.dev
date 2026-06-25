/** Language-neutral site constants: URLs, install commands, provider glyphs.
 *  Localized copy lives in src/i18n/{pt,en}.ts. */

import { RELEASE } from './releases.generated';

export const GITHUB_URL = 'https://github.com/juliopolycarpo/mangostudio';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/.github/CONTRIBUTING.md`;
export const REPO = 'juliopolycarpo/mangostudio';
export const STARS = '1.2k';
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
    id: 'brew',
    label: 'brew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'planned',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash',
    status: 'planned',
  },
  {
    id: 'scoop',
    label: 'scoop',
    cmd: 'scoop install mangostudio',
    status: 'planned',
  },
  {
    id: 'cargo',
    label: 'cargo',
    cmd: 'cargo install mangostudio',
    status: 'planned',
  },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 ghcr.io/juliopolycarpo/mangostudio',
    status: 'planned',
  },
];

export interface Channel {
  id: string;
  label: string;
  cmd: string;
  status: ChannelStatus;
}

/** Install grid on the home page. Only `bun` is shipped; the rest are planned. */
export const CHANNELS: Channel[] = [
  { id: 'bun', label: 'npm / bun', cmd: RELEASE.installCmd, status: 'ready' },
  {
    id: 'brew',
    label: 'homebrew',
    cmd: 'brew install juliopolycarpo/tap/mangostudio',
    status: 'planned',
  },
  {
    id: 'curl',
    label: 'shell',
    cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash',
    status: 'planned',
  },
  { id: 'scoop', label: 'scoop', cmd: 'scoop install mangostudio', status: 'planned' },
  { id: 'cargo', label: 'cargo', cmd: 'cargo install mangostudio', status: 'planned' },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 ghcr.io/juliopolycarpo/mangostudio',
    status: 'planned',
  },
  {
    id: 'manual',
    label: 'manual',
    cmd: 'gh release download --pattern "*.tar.gz" && sha256sum -c SHA256SUMS',
    status: 'planned',
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
