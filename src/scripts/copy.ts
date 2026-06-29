let toastTimer: number | undefined;

type ToastKind = 'success' | 'error';

function showToast(kind: ToastKind): void {
  const toast = document.getElementById('copy-toast');
  if (!(toast instanceof HTMLElement)) return;

  const message = toast.querySelector('.copy-toast-message');
  const successIcon = toast.querySelector('.copy-toast-icon--success');
  const errorIcon = toast.querySelector('.copy-toast-icon--error');

  const text =
    kind === 'success' ? (toast.dataset.copySuccess ?? '') : (toast.dataset.copyError ?? '');

  if (message instanceof HTMLElement) message.textContent = text;

  toast.classList.toggle('is-error', kind === 'error');
  if (successIcon instanceof HTMLElement) successIcon.hidden = kind !== 'success';
  if (errorIcon instanceof HTMLElement) errorIcon.hidden = kind !== 'error';

  toast.classList.add('is-visible');
  if (toastTimer !== undefined) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1500);
}

async function copyText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard API unavailable');
    }

    await navigator.clipboard.writeText(text);
    showToast('success');
  } catch {
    showToast('error');
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
