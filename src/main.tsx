import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-reload em erros de chunk antigo apos deploy (stale tab).
// Sem isso o usuario fica preso numa tela de erro ate apertar F5 manual.
const RELOAD_KEY = "financaspro:last-chunk-reload";
function isChunkError(msg: string): boolean {
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}
function maybeAutoReload(msg: string) {
  if (!isChunkError(msg)) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Date.now() - last < 10_000) return; // anti-loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage indisponivel — segue com reload mesmo assim */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_v", Date.now().toString(36));
  window.location.replace(url.toString());
}
window.addEventListener("error", (event) => {
  maybeAutoReload(String(event.message || event.error?.message || ""));
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  maybeAutoReload(msg);
});

createRoot(document.getElementById("root")!).render(<App />);
