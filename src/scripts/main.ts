/** Single client entry. Each initializer is a no-op when its target markup is
 *  absent, so this can be loaded once on every page from the base layout. */
import { initCmdk } from './cmdk';
import { initCopy } from './copy';
import { initInstallTabs } from './install-tabs';
import { initTerminal } from './terminal';
import { initTheme } from './theme';

initTheme();
initCopy();
initInstallTabs();
initTerminal();
initCmdk();
