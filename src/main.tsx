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

// PWA stale-cache killer: quando um novo Service Worker assume o controle
// (apos um deploy, com skipWaiting+clientsClaim), recarrega a pagina UMA vez
// para que o usuario veja imediatamente a versao nova. Sem isso o PWA fica
// preso na versao antiga ate fechar o app — causa principal de "ja arrumei
// mas continua igual" no celular.
if ("serviceWorker" in navigator) {
  // Captura se ja havia um SW controlando ANTES de qualquer mudanca.
  // Se havia (visita recorrente) e o controller troca = deploy novo -> reload.
  // Se nao havia (primeira visita), o clientsClaim dispara controllerchange
  // sem ser deploy -> NAO recarrega.
  const hadControllerAtStart = !!navigator.serviceWorker.controller;
  let swReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swReloaded || !hadControllerAtStart) return;
    swReloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
