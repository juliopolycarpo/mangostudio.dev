import { strictEqual } from 'node:assert/strict';

import {
  EXPECTED_WWW_REDIRECT_LOCATION,
  validateApexResponse,
  validateWwwRedirectResponse,
  WWW_REDIRECT_PROBE_URL,
} from './smoke-production-url';

run('validateApexResponse passes when apex returns 200', () => {
  const result = validateApexResponse(200);
  strictEqual(result.ok, true);
});

run('validateApexResponse fails when apex returns a non-200 status', () => {
  const result = validateApexResponse(404);
  strictEqual(result.ok, false);
  strictEqual(result.error, 'https://mangostudio.dev/ returned status 404, expected 200');
});

run('validateWwwRedirectResponse passes for 301 with preserved path and query', () => {
  const result = validateWwwRedirectResponse(301, EXPECTED_WWW_REDIRECT_LOCATION);
  strictEqual(result.ok, true);
});

run('validateWwwRedirectResponse passes for 308 with preserved path and query', () => {
  const result = validateWwwRedirectResponse(308, EXPECTED_WWW_REDIRECT_LOCATION);
  strictEqual(result.ok, true);
});

run('validateWwwRedirectResponse fails when www serves 200 instead of redirecting', () => {
  const result = validateWwwRedirectResponse(200, EXPECTED_WWW_REDIRECT_LOCATION);
  strictEqual(result.ok, false);
  strictEqual(result.error, `${WWW_REDIRECT_PROBE_URL} returned status 200, expected 301 or 308`);
});

run('validateWwwRedirectResponse fails for temporary 302 redirects', () => {
  const result = validateWwwRedirectResponse(302, EXPECTED_WWW_REDIRECT_LOCATION);
  strictEqual(result.ok, false);
  strictEqual(result.error, `${WWW_REDIRECT_PROBE_URL} returned status 302, expected 301 or 308`);
});

run('validateWwwRedirectResponse fails when Location header is missing', () => {
  const result = validateWwwRedirectResponse(301, null);
  strictEqual(result.ok, false);
  strictEqual(
    result.error,
    `${WWW_REDIRECT_PROBE_URL} returned status 301 but Location header is missing`
  );
});

run('validateWwwRedirectResponse fails when Location points at the wrong apex target', () => {
  const result = validateWwwRedirectResponse(301, 'https://mangostudio.dev/docs/quickstart');
  strictEqual(result.ok, false);
  strictEqual(
    result.error,
    `${WWW_REDIRECT_PROBE_URL} returned status 301 with Location ` +
      'https://mangostudio.dev/docs/quickstart, ' +
      `expected ${EXPECTED_WWW_REDIRECT_LOCATION}`
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
