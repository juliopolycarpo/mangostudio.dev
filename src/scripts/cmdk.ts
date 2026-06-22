import { toggleTheme } from './theme';

export function initCmdk(): void {
  const el = document.getElementById('cmdk');
  if (!(el instanceof HTMLDialogElement)) return;
  const dialog: HTMLDialogElement = el;

  const input = dialog.querySelector('[data-cmdk-input]');
  const items = Array.from(dialog.querySelectorAll<HTMLElement>('[data-cmdk-item]'));
  const empty = dialog.querySelector('[data-cmdk-empty]');
  const emptyQuery = dialog.querySelector('[data-cmdk-query]');

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
  }

  function open(): void {
    if (!dialog.open) dialog.showModal();
    if (input instanceof HTMLInputElement) {
      input.value = '';
      filter('');
      input.focus();
    }
  }

  function close(): void {
    if (dialog.open) dialog.close();
  }

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
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const first = items.find((item) => !item.hidden);
      if (first) first.click();
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
