const JSDELIVR_GH_BASE = "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main";

export function resolveIconUrl(url) {
  if (typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:") || url === "@content") return url;

  try {
    const hostname = window.location?.hostname || "";
    const isJsdelivr = hostname === "cdn.jsdelivr.net" || hostname.endsWith(".jsdelivr.net");
    if (isJsdelivr && url.startsWith("/static/")) {
      return `${JSDELIVR_GH_BASE}${url}`;
    }
  } catch {}

  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      const isJsdelivr = u.hostname === "cdn.jsdelivr.net" || u.hostname.endsWith(".jsdelivr.net");
      if (isJsdelivr && u.pathname.startsWith("/static/")) {
        return `${JSDELIVR_GH_BASE}${u.pathname}${u.search}${u.hash}`;
      }
    } catch {}
  }

  return url;
}
