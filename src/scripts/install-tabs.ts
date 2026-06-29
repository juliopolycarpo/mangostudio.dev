const CHANNEL_STORAGE_KEY = 'mango.installCh';
const PLATFORM_STORAGE_KEY = 'mango.installPlatform';
const DEFAULT_PLATFORM = 'linux';
const DEFAULT_CHANNEL = 'bun';

export function initInstallTabs(): void {
  const platformRoot = document.getElementById('install-platform-tabs');
  const channelRoot = document.getElementById('install-tabs');
  const cmdElOrNull = document.getElementById('hero-cmd');
  const promptElOrNull = document.getElementById('hero-prompt');
  if (!platformRoot || !channelRoot || !cmdElOrNull || !promptElOrNull) return;
  const cmdEl = cmdElOrNull;
  const promptEl = promptElOrNull;

  const platformTabs = Array.from(
    platformRoot.querySelectorAll<HTMLButtonElement>('[data-platform]')
  );
  const tabs = Array.from(channelRoot.querySelectorAll<HTMLButtonElement>('[data-channel]'));
  const copyBtn = document.getElementById('hero-copy');
  const panel = document.getElementById('install-panel');
  if (platformTabs.length === 0 || tabs.length === 0) return;

  let selectedPlatform = DEFAULT_PLATFORM;

  function navigableTabs(): HTMLButtonElement[] {
    return tabs.filter((tab) => !tab.hidden && tab.getAttribute('aria-disabled') !== 'true');
  }

  function platformForClient(): string | undefined {
    const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();

    if (value.includes('win')) return 'windows';
    if (value.includes('mac')) return 'macos';
    if (value.includes('linux') || value.includes('x11')) return 'linux';

    return undefined;
  }

  function tabSupportsPlatform(tab: HTMLButtonElement, platform: string): boolean {
    return (tab.dataset.platforms ?? '').split(/\s+/).includes(platform);
  }

  function setTabState(tab: HTMLButtonElement, active: boolean): void {
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }

  function select(id: string): void {
    const tab = tabs.find((t) => t.dataset.channel === id);
    if (
      !tab ||
      tab.hidden ||
      tab.getAttribute('aria-disabled') === 'true' ||
      !tabSupportsPlatform(tab, selectedPlatform)
    ) {
      return;
    }

    for (const t of tabs) {
      setTabState(t, t === tab);
    }

    if (panel instanceof HTMLElement && tab.id) {
      panel.setAttribute('aria-labelledby', tab.id);
      panel.setAttribute('data-platform', selectedPlatform);
    }

    if (tab.dataset.status === 'ready') {
      const cmd = tab.dataset.cmd ?? '';
      const prompt = tab.dataset.prompt ?? '$ ';
      promptEl.textContent = prompt;
      cmdEl.textContent = cmd;
      if (copyBtn) copyBtn.dataset.copy = cmd;
      panel?.setAttribute('data-state', 'ready');
      try {
        localStorage.setItem(CHANNEL_STORAGE_KEY, tab.dataset.channel ?? id);
      } catch {
        /* storage may be unavailable */
      }
      return;
    }

    if (copyBtn) copyBtn.removeAttribute('data-copy');
    panel?.setAttribute('data-state', 'planned');
  }

  function defaultChannelForPlatform(platform: string): string {
    const platformTab = platformTabs.find((tab) => tab.dataset.platform === platform);
    return platformTab?.dataset.defaultChannel ?? DEFAULT_CHANNEL;
  }

  function selectPlatform(platform: string, preferredChannel?: string): void {
    const platformTab = platformTabs.find((tab) => tab.dataset.platform === platform);
    if (!platformTab) return;

    selectedPlatform = platform;

    for (const tab of platformTabs) {
      setTabState(tab, tab === platformTab);
    }

    for (const tab of tabs) {
      const available = tabSupportsPlatform(tab, platform);
      tab.hidden = !available;
      if (!available) {
        setTabState(tab, false);
      }
    }

    const nextChannel =
      preferredChannel && tabs.some((tab) => tab.dataset.channel === preferredChannel)
        ? preferredChannel
        : defaultChannelForPlatform(platform);
    const next = tabs.find(
      (tab) =>
        tab.dataset.channel === nextChannel &&
        tabSupportsPlatform(tab, platform) &&
        tab.getAttribute('aria-disabled') !== 'true'
    );
    const fallback = navigableTabs()[0];
    const target = next ?? fallback;
    if (target) select(target.dataset.channel ?? '');

    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
    } catch {
      /* storage may be unavailable */
    }
  }

  for (const t of tabs) {
    t.addEventListener('click', () => {
      if (t.getAttribute('aria-disabled') === 'true') return;
      select(t.dataset.channel ?? '');
    });
  }

  for (const platformTab of platformTabs) {
    platformTab.addEventListener('click', () => {
      selectPlatform(platformTab.dataset.platform ?? DEFAULT_PLATFORM);
    });
  }

  function handleTablistKeydown(
    event: KeyboardEvent,
    items: HTMLButtonElement[],
    activate: (tab: HTMLButtonElement) => void
  ): void {
    if (items.length === 0) return;

    const current = items.find((tab) => tab.classList.contains('is-active'));
    const currentIndex = current ? items.indexOf(current) : 0;

    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = items[nextIndex];
    if (!next) return;
    activate(next);
    next.focus();
  }

  platformRoot.addEventListener('keydown', (event) => {
    handleTablistKeydown(event, platformTabs, (tab) =>
      selectPlatform(tab.dataset.platform ?? DEFAULT_PLATFORM)
    );
  });

  channelRoot.addEventListener('keydown', (event) => {
    handleTablistKeydown(event, navigableTabs(), (tab) => select(tab.dataset.channel ?? ''));
  });

  let initialPlatform = platformForClient() ?? DEFAULT_PLATFORM;
  let initialChannel = defaultChannelForPlatform(initialPlatform);
  try {
    const storedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (storedPlatform && platformTabs.some((tab) => tab.dataset.platform === storedPlatform)) {
      initialPlatform = storedPlatform;
      initialChannel = defaultChannelForPlatform(initialPlatform);
    }

    const storedChannel = localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (storedChannel) {
      const match = tabs.find((t) => t.dataset.channel === storedChannel);
      if (
        match &&
        match.dataset.status === 'ready' &&
        tabSupportsPlatform(match, initialPlatform)
      ) {
        initialChannel = storedChannel;
      }
    }
  } catch {
    /* storage may be unavailable */
  }

  selectPlatform(initialPlatform, initialChannel);
}
