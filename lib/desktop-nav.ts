/** Desktop builds are a static export inside the Tauri webview.
 *  Next's client router fetches `/route/index.txt`, then suspends forever
 *  when that response is not a flight payload. Use a real document load.
 */

export function inDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

export function routeHref(path: string): string {
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = beforeHash.indexOf("?");
  const query = queryAt >= 0 ? beforeHash.slice(queryAt) : "";
  let base = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  if (!base || base === "/") return `/${query}${hash}`;
  if (!base.endsWith("/")) base += "/";
  return `${base}${query}${hash}`;
}

export function hardNavigate(path: string): void {
  window.location.replace(routeHref(path));
}
