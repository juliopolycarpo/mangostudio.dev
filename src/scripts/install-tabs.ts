const STORAGE_KEY = 'mango.installCh';
const DEFAULT_CHANNEL = 'bun';

export function initInstallTabs(): void {
  const root = document.getElementById('install-tabs');
  const cmdElOrNull = document.getElementById('hero-cmd');
  if (!root || !cmdElOrNull) return;
  const cmdEl = cmdElOrNull;

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-channel]'));
  const copyBtn = document.getElementById('hero-copy');
  const panel = document.getElementById('install-panel');
  if (tabs.length === 0) return;

  function navigableTabs(): HTMLButtonElement[] {
    return tabs.filter((tab) => tab.getAttribute('aria-disabled') !== 'true');
  }

  function select(id: string): void {
    const tab = tabs.find((t) => t.dataset.channel === id);
    if (!tab || tab.getAttribute('aria-disabled') === 'true') return;

    for (const t of tabs) {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    }

    if (panel instanceof HTMLElement && tab.id) {
      panel.setAttribute('aria-labelledby', tab.id);
    }

    if (tab.dataset.status === 'ready') {
      const cmd = tab.dataset.cmd ?? '';
      cmdEl.textContent = cmd;
      if (copyBtn) copyBtn.dataset.copy = cmd;
      panel?.setAttribute('data-state', 'ready');
      try {
        localStorage.setItem(STORAGE_KEY, tab.dataset.channel ?? id);
      } catch {
        /* storage may be unavailable */
      }
      return;
    }

    if (copyBtn) copyBtn.removeAttribute('data-copy');
    panel?.setAttribute('data-state', 'planned');
  }

  for (const t of tabs) {
    t.addEventListener('click', () => {
      if (t.getAttribute('aria-disabled') === 'true') return;
      select(t.dataset.channel ?? '');
    });
  }

  root.addEventListener('keydown', (event) => {
    const navigable = navigableTabs();
    if (navigable.length === 0) return;

    const current = navigable.find((tab) => tab.classList.contains('is-active')) ?? navigable[0];
    const currentIndex = navigable.indexOf(current ?? navigable[0]);
    if (currentIndex === -1) return;

    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % navigable.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + navigable.length) % navigable.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = navigable.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = navigable[nextIndex];
    if (!next) return;
    select(next.dataset.channel ?? '');
    next.focus();
  });

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
