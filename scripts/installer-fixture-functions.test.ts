import { ok, strictEqual, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { extractPowerShellFunctions } from './installer-fixture-functions';

const declarations = 'function Install-Archive {}\n';
const main = 'if ($Help) {\n  Show-Usage\n}\nInstall-Archive\n';
strictEqual(extractPowerShellFunctions(declarations + main), declarations);

// A moved/reformatted sentinel must fail before any command can receive main.
for (const source of [
  `${declarations}Install-Archive\n`,
  `${declarations}${main.replace('if ($Help) {', 'if ($Help){')}`,
  `${declarations}${main}${main}`,
  `${declarations}# if ($Help) {\nInstall-Archive\n`,
]) {
  throws(
    () => extractPowerShellFunctions(source),
    /expected exactly one standalone PowerShell Help sentinel; refusing to load main/
  );
}
strictEqual(
  extractPowerShellFunctions((declarations + main).replaceAll('\n', '\r\n')),
  declarations.replaceAll('\n', '\r\n')
);
const commented = '# if ($Help) { is a comment\n';
strictEqual(extractPowerShellFunctions(commented + declarations + main), commented + declarations);

const production = readFileSync(new URL('../public/install.ps1', import.meta.url), 'utf8');
const functions = extractPowerShellFunctions(production);
ok(functions.includes('function Install-Archive('));
ok(functions.includes('function Test-Checksum('));
ok(!functions.includes('$platform = Get-Platform'));
ok(!functions.includes('$pathChanged = Add-UserPath'));
console.warn('[ok] PowerShell fixture loading refuses a missing main boundary');
