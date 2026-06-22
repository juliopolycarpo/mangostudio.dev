const STORAGE_KEY = 'mango.installCh';

export function initInstallTabs(): void {
  const root = document.getElementById('install-tabs');
  const cmdEl = document.getElementById('hero-cmd');
  if (!root || !cmdEl) return;

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-channel]'));
  const copyBtn = document.getElementById('hero-copy');
  if (tabs.length === 0) return;

  function select(id: string): void {
    const tab = tabs.find((t) => t.dataset.channel === id) ?? tabs[0];
    const cmd = tab.dataset.cmd ?? '';
    for (const t of tabs) {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    }
    if (cmdEl) cmdEl.textContent = cmd;
    if (copyBtn) copyBtn.dataset.copy = cmd;
    try {
      localStorage.setItem(STORAGE_KEY, tab.dataset.channel ?? id);
    } catch {
      /* storage may be unavailable */
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => select(t.dataset.channel ?? ''));
  }

  let initial = 'bun';
  try {
    initial = localStorage.getItem(STORAGE_KEY) ?? 'bun';
  } catch {
    /* storage may be unavailable */
  }
  select(initial);
}
