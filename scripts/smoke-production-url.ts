export const APEX_URL = 'https://mangostudio.dev/';
export const WWW_REDIRECT_PROBE_URL = 'https://www.mangostudio.dev/docs/quickstart?smoke=1';
export const EXPECTED_WWW_REDIRECT_LOCATION = 'https://mangostudio.dev/docs/quickstart?smoke=1';
export const DOCS_REDIRECT_PROBE_URL = 'https://mangostudio.dev/docs';
export const EXPECTED_DOCS_REDIRECT_LOCATION = '/docs/quickstart/';
export const EN_DOCS_REDIRECT_PROBE_URL = 'https://mangostudio.dev/en/docs';
export const EXPECTED_EN_DOCS_REDIRECT_LOCATION = '/en/docs/quickstart/';

export interface SmokeCheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

export function validateApexResponse(status: number): SmokeCheckResult {
  if (status === 200) {
    return { name: 'Apex serves the site', ok: true };
  }

  return {
    name: 'Apex serves the site',
    ok: false,
    error: `${APEX_URL} returned status ${status}, expected 200`,
  };
}

export function validateWwwRedirectResponse(
  status: number,
  location: string | null,
  expectedLocation: string = EXPECTED_WWW_REDIRECT_LOCATION,
  probeUrl: string = WWW_REDIRECT_PROBE_URL
): SmokeCheckResult {
  return validatePermanentRedirect(
    'www redirects to apex with path and query preserved',
    { status, location },
    expectedLocation,
    probeUrl
  );
}

/**
 * Checks that a bare docs root permanently redirects to its locale's quickstart in one hop.
 *
 * @example validateDocsRedirectResponse(301, '/docs/quickstart/') // { ok: true, ... }
 */
export function validateDocsRedirectResponse(
  status: number,
  location: string | null,
  expectedLocation: string = EXPECTED_DOCS_REDIRECT_LOCATION,
  probeUrl: string = DOCS_REDIRECT_PROBE_URL
): SmokeCheckResult {
  return validatePermanentRedirect(
    `${new URL(probeUrl).pathname} redirects permanently to the quickstart`,
    { status, location },
    expectedLocation,
    probeUrl
  );
}

function validatePermanentRedirect(
  name: string,
  response: { status: number; location: string | null },
  expectedLocation: string,
  probeUrl: string
): SmokeCheckResult {
  const { status, location } = response;

  if (status !== 301 && status !== 308) {
    return {
      name,
      ok: false,
      error: `${probeUrl} returned status ${status}, expected 301 or 308`,
    };
  }

  if (!location) {
    return {
      name,
      ok: false,
      error: `${probeUrl} returned status ${status} but Location header is missing`,
    };
  }

  if (location !== expectedLocation) {
    return {
      name,
      ok: false,
      error:
        `${probeUrl} returned status ${status} with Location ${location}, ` +
        `expected ${expectedLocation}`,
    };
  }

  return { name, ok: true };
}

async function fetchHead(url: string): Promise<{ status: number; location: string | null }> {
  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  return {
    status: response.status,
    location: response.headers.get('location'),
  };
}

async function runProductionSmoke(): Promise<SmokeCheckResult[]> {
  const apex = await fetchHead(APEX_URL);
  const www = await fetchHead(WWW_REDIRECT_PROBE_URL);
  const docs = await fetchHead(DOCS_REDIRECT_PROBE_URL);
  const enDocs = await fetchHead(EN_DOCS_REDIRECT_PROBE_URL);

  return [
    validateApexResponse(apex.status),
    validateWwwRedirectResponse(www.status, www.location),
    validateDocsRedirectResponse(docs.status, docs.location),
    validateDocsRedirectResponse(
      enDocs.status,
      enDocs.location,
      EXPECTED_EN_DOCS_REDIRECT_LOCATION,
      EN_DOCS_REDIRECT_PROBE_URL
    ),
  ];
}

function formatFetchError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  let checks: SmokeCheckResult[];

  try {
    checks = await runProductionSmoke();
  } catch (error) {
    process.stderr.write(
      `[fail] Production URL smoke\n  - request failed: ${formatFetchError(error)}\n`
    );
    process.exit(1);
  }

  let failed = false;

  for (const check of checks) {
    if (check.ok) {
      process.stdout.write(`[ok] ${check.name}\n`);
      continue;
    }

    failed = true;
    process.stderr.write(`[fail] ${check.name}\n`);

    if (check.error) {
      process.stderr.write(`  - ${check.error}\n`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}
