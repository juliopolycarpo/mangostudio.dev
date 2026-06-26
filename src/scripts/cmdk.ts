import { toggleTheme } from './theme';

export function initCmdk(): void {
  const el = document.getElementById('cmdk');
  if (!(el instanceof HTMLDialogElement)) return;
  const dialog: HTMLDialogElement = el;

  const input = dialog.querySelector('[data-cmdk-input]');
  const items = Array.from(dialog.querySelectorAll<HTMLElement>('[data-cmdk-item]'));
  const empty = dialog.querySelector('[data-cmdk-empty]');
  const emptyQuery = dialog.querySelector('[data-cmdk-query]');

  let activeIndex = -1;

  function visibleItems(): HTMLElement[] {
    return items.filter((item) => !item.hidden);
  }

  function setActiveIndex(index: number): void {
    const visible = visibleItems();
    if (visible.length === 0) {
      activeIndex = -1;
      for (const item of items) {
        item.classList.remove('is-active');
        item.setAttribute('aria-selected', 'false');
      }
      if (input instanceof HTMLInputElement) input.removeAttribute('aria-activedescendant');
      return;
    }

    activeIndex = ((index % visible.length) + visible.length) % visible.length;
    const active = visible[activeIndex];

    for (const item of items) {
      const isActive = item === active;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-selected', String(isActive));
    }

    if (input instanceof HTMLInputElement && active?.id) {
      input.setAttribute('aria-activedescendant', active.id);
    }

    active?.scrollIntoView({ block: 'nearest' });
  }

  function resetActiveIndex(): void {
    setActiveIndex(0);
  }

  function activateActiveItem(): void {
    const visible = visibleItems();
    if (visible.length === 0) return;
    const target =
      activeIndex >= 0 && activeIndex < visible.length ? visible[activeIndex] : visible[0];
    target?.click();
  }

  function filter(query: string): void {
    const q = query.trim().toLowerCase();
    let visible = 0;
    for (const item of items) {
      const match = q === '' || (item.dataset.search ?? '').toLowerCase().includes(q);
      item.hidden = !match;
      if (match) visible += 1;
    }
    if (empty instanceof HTMLElement) empty.hidden = visible !== 0;
    if (emptyQuery instanceof HTMLElement) emptyQuery.textContent = query;
    resetActiveIndex();
  }

  function open(): void {
    if (!dialog.open) dialog.showModal();
    if (input instanceof HTMLInputElement) {
      input.value = '';
      input.setAttribute('aria-expanded', 'true');
      filter('');
      input.focus();
    }
  }

  function close(): void {
    if (dialog.open) dialog.close();
  }

  // Reset combobox state on every close path, including native Escape, which
  // bypasses close() entirely but still fires the dialog's `close` event.
  dialog.addEventListener('close', () => {
    if (input instanceof HTMLInputElement) input.setAttribute('aria-expanded', 'false');
  });

  for (const trigger of document.querySelectorAll('[data-cmdk-open]')) {
    trigger.addEventListener('click', () => open());
  }

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) close();
      else open();
    }
  });

  if (input instanceof HTMLInputElement) {
    input.addEventListener('input', () => filter(input.value));
    input.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex(activeIndex + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex(activeIndex - 1);
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          break;
        case 'End': {
          event.preventDefault();
          const visible = visibleItems();
          setActiveIndex(visible.length - 1);
          break;
        }
        case 'Enter':
          event.preventDefault();
          activateActiveItem();
          break;
        default:
          break;
      }
    });
  }

  for (const item of items) {
    if (item.dataset.action === 'theme') {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        toggleTheme();
        close();
      });
    }
  }

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
}
