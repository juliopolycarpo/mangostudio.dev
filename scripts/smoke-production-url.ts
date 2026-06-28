export const APEX_URL = 'https://mangostudio.dev/';
export const WWW_REDIRECT_PROBE_URL = 'https://www.mangostudio.dev/docs/quickstart?smoke=1';
export const EXPECTED_WWW_REDIRECT_LOCATION = 'https://mangostudio.dev/docs/quickstart?smoke=1';

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
  const name = 'www redirects to apex with path and query preserved';

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

  return [validateApexResponse(apex.status), validateWwwRedirectResponse(www.status, www.location)];
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
    process.exitCode = 1;
    process.exit();
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
