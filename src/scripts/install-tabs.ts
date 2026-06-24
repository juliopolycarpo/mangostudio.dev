const STORAGE_KEY = 'mango.installCh';
const DEFAULT_CHANNEL = 'bun';

export function initInstallTabs(): void {
  const root = document.getElementById('install-tabs');
  const cmdElOrNull = document.getElementById('hero-cmd');
  if (!root || !cmdElOrNull) return;
  const cmdEl = cmdElOrNull;

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-channel]'));
  const copyBtn = document.getElementById('hero-copy');
  const cmdContainer = document.getElementById('install-cmd');
  if (tabs.length === 0) return;

  function select(id: string): void {
    const tab = tabs.find((t) => t.dataset.channel === id) ?? tabs[0];
    if (!tab) return;

    for (const t of tabs) {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    }

    if (tab.dataset.status === 'ready') {
      const cmd = tab.dataset.cmd ?? '';
      cmdEl.textContent = cmd;
      if (copyBtn) copyBtn.dataset.copy = cmd;
      cmdContainer?.setAttribute('data-state', 'ready');
      try {
        localStorage.setItem(STORAGE_KEY, tab.dataset.channel ?? id);
      } catch {
        /* storage may be unavailable */
      }
      return;
    }

    if (copyBtn) copyBtn.removeAttribute('data-copy');
    cmdContainer?.setAttribute('data-state', 'planned');
  }

  for (const t of tabs) {
    t.addEventListener('click', () => select(t.dataset.channel ?? ''));
  }

  let initial = DEFAULT_CHANNEL;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const match = tabs.find((t) => t.dataset.channel === stored);
      if (match && match.dataset.status === 'ready') initial = stored;
    }
  } catch {
    /* storage may be unavailable */
  }
  select(initial);
}
