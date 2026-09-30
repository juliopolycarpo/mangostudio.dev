import { strictEqual, throws } from 'node:assert/strict';
import { fillCopyLabel } from './copy-label';

run('fillCopyLabel puts the target into the template', () => {
  const label = fillCopyLabel('Copiar comando: {target}', 'brew');
  strictEqual(label, 'Copiar comando: brew', `expected: Copiar comando: brew | received: ${label}`);
});

run('fillCopyLabel rejects a template without the placeholder', () => {
  throws(
    () => fillCopyLabel('Copiar', 'brew'),
    /must contain "\{target\}" \| received: "Copiar"/,
    'expected an error naming the placeholder and the invalid template'
  );
});

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}
