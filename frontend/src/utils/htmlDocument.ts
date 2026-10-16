/** Resolve local API images without assigning a base URL to the reader script. */
export function resolveSnapshotUrls(html: string, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  if (!base) return html;
  return html.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])(\/api\/snapshots\/[^"']*)\2/gi,
    (_match, prefix: string, quote: string, path: string) => `${prefix}${quote}${base}${path}${quote}`);
}
