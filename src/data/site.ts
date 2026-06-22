/** Language-neutral site constants: URLs, install commands, provider glyphs.
 *  Localized copy lives in src/i18n/{pt,en}.ts. */

export const GITHUB_URL = 'https://github.com/juliopolycarpo/mangostudio';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const CONTRIBUTING_URL = `${GITHUB_URL}/blob/main/.github/CONTRIBUTING.md`;
export const REPO = 'juliopolycarpo/mangostudio';
export const STARS = '1.2k';
export const VERSION = 'v0.1.0';

export interface InstallTab {
  id: string;
  label: string;
  cmd: string;
}

/** Hero install widget — the tabbed channel switcher. */
export const INSTALL_TABS: InstallTab[] = [
  { id: 'bun', label: 'bun', cmd: 'bun add -g @mangostudio/cli' },
  { id: 'brew', label: 'brew', cmd: 'brew install juliopolycarpo/tap/mangostudio' },
  { id: 'curl', label: 'shell', cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash' },
  { id: 'scoop', label: 'scoop', cmd: 'scoop install mangostudio' },
  { id: 'cargo', label: 'cargo', cmd: 'cargo install mangostudio' },
  {
    id: 'docker',
    label: 'docker',
    cmd: 'docker run -p 3001:3001 ghcr.io/juliopolycarpo/mangostudio',
  },
];

export interface Channel {
  label: string;
  cmd: string;
}

/** "Seven channels" install grid on the home page. */
export const CHANNELS: Channel[] = [
  { label: 'npm / bun', cmd: 'bun add -g @mangostudio/cli' },
  { label: 'homebrew', cmd: 'brew install juliopolycarpo/tap/mangostudio' },
  { label: 'shell', cmd: 'curl -fsSL https://mangostudio.dev/install.sh | bash' },
  { label: 'scoop', cmd: 'scoop install mangostudio' },
  { label: 'cargo', cmd: 'cargo install mangostudio' },
  { label: 'docker', cmd: 'docker run -p 3001:3001 ghcr.io/juliopolycarpo/mangostudio' },
  { label: 'manual', cmd: 'gh release download --pattern "*.tar.gz" && sha256sum -c SHA256SUMS' },
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
