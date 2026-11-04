/** Extract the PowerShell declarations without running the installer's main flow. */
export function extractPowerShellFunctions(source: string): string {
  const markers = [...source.matchAll(/^if \(\$Help\) \{\r?$/gm)];
  const boundary = markers[0]?.index;
  if (markers.length !== 1 || boundary === undefined) {
    throw new Error(
      'expected exactly one standalone PowerShell Help sentinel; refusing to load main'
    );
  }
  return source.slice(0, boundary);
}
