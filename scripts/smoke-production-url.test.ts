import { strictEqual } from 'node:assert/strict';

import {
  DOCS_REDIRECT_PROBE_URL,
  EN_DOCS_REDIRECT_PROBE_URL,
  EXPECTED_DOCS_REDIRECT_LOCATION,
  EXPECTED_EN_DOCS_REDIRECT_LOCATION,
  EXPECTED_WWW_REDIRECT_LOCATION,
  validateApexResponse,
  validateDocsRedirectResponse,
  validateLiveScripts,
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

run('validateDocsRedirectResponse passes for a 301 to the slash quickstart', () => {
  const result = validateDocsRedirectResponse(301, EXPECTED_DOCS_REDIRECT_LOCATION);
  strictEqual(result.ok, true, `expected ok | received: ${result.error}`);
});

run('validateDocsRedirectResponse checks the English docs root against its own target', () => {
  const result = validateDocsRedirectResponse(
    301,
    EXPECTED_DOCS_REDIRECT_LOCATION,
    EXPECTED_EN_DOCS_REDIRECT_LOCATION,
    EN_DOCS_REDIRECT_PROBE_URL
  );
  strictEqual(
    result.error,
    `${EN_DOCS_REDIRECT_PROBE_URL} returned status 301 with Location /docs/quickstart/, ` +
      `expected ${EXPECTED_EN_DOCS_REDIRECT_LOCATION}`
  );
});

run('validateDocsRedirectResponse fails for a temporary 302', () => {
  const result = validateDocsRedirectResponse(302, EXPECTED_DOCS_REDIRECT_LOCATION);
  strictEqual(result.error, `${DOCS_REDIRECT_PROBE_URL} returned status 302, expected 301 or 308`);
});

run('validateDocsRedirectResponse fails for a slashless target', () => {
  const result = validateDocsRedirectResponse(301, '/docs/quickstart');
  strictEqual(
    result.error,
    `${DOCS_REDIRECT_PROBE_URL} returned status 301 with Location /docs/quickstart, ` +
      `expected ${EXPECTED_DOCS_REDIRECT_LOCATION}`
  );
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

run('validateLiveScripts passes build scripts and inline scripts', () => {
  const html = [
    '<script>document.documentElement.classList.add("js")</script>',
    '<script type="module" src="/_astro/main.BzxX4PTW.js"></script>',
  ].join('');
  const result = validateLiveScripts('https://mangostudio.dev/', html);
  strictEqual(result.ok, true, `expected ok | received: ${result.error}`);
});

run('validateLiveScripts rejects the WebMCP bridge now that the zone injection is off', () => {
  const html = '<script type="module" src="https://mangostudio.dev/.webmcp/bridge.js"></script>';
  const result = validateLiveScripts('https://mangostudio.dev/', html);
  strictEqual(result.ok, false, 'expected the default allowlist to reject /.webmcp/bridge.js');
  strictEqual(
    result.error,
    'https://mangostudio.dev/ loads unexpected scripts: https://mangostudio.dev/.webmcp/bridge.js | ' +
      'expected: same-origin /_astro/*'
  );
});

run('validateLiveScripts fails on an unknown edge script and a third-party script', () => {
  const html = [
    "<script defer src='/cdn-cgi/scripts/beacon.min.js'></script>",
    '<script src="https://cdn.example.com/_astro/tracker.js"></script>',
    '<script async src=/cdn-cgi/unquoted.js></script>',
  ].join('');
  const result = validateLiveScripts('https://mangostudio.dev/', html, ['/edge/allowed.js']);
  strictEqual(result.ok, false);
  strictEqual(
    result.error,
    'https://mangostudio.dev/ loads unexpected scripts: ' +
      'https://mangostudio.dev/cdn-cgi/scripts/beacon.min.js, https://cdn.example.com/_astro/tracker.js, ' +
      'https://mangostudio.dev/cdn-cgi/unquoted.js | ' +
      'expected: same-origin /_astro/* or /edge/allowed.js'
  );
});

run('validateLiveScripts passes a same-origin script on an explicit allowlist', () => {
  const html = '<script src="https://mangostudio.dev/edge/allowed.js"></script>';
  const result = validateLiveScripts('https://mangostudio.dev/', html, ['/edge/allowed.js']);
  strictEqual(result.ok, true, `expected ok | received: ${result.error}`);
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
