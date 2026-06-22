let toastTimer: number | undefined;

function showToast(): void {
  const toast = document.getElementById('copy-toast');
  if (!toast) return;
  toast.classList.add('is-visible');
  if (toastTimer !== undefined) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1500);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast();
  } catch {
    /* clipboard access can be denied; fail silently */
  }
}

export function initCopy(): void {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const btn = event.target.closest('[data-copy]');
    if (!(btn instanceof HTMLElement)) return;
    const text = btn.dataset.copy ?? '';
    if (text) void copyText(text);
  });
}
