import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Auto-update do service worker — silencioso e CONFIÁVEL.
 *
 * O SW usa autoUpdate + skipWaiting + clientsClaim, então o novo SW assume o
 * controle sozinho. O problema clássico: a PÁGINA já aberta não recarrega, e o
 * usuário continua vendo o bundle antigo em cache. Aqui resolvemos isso:
 *
 * 1) Checa por nova versão no launch, a cada 5 min E sempre que o app volta ao
 *    foco (PWA no celular fica em background — sem isso, nunca checa).
 * 2) Quando o novo SW assume (evento 'controllerchange'), recarrega a página UMA
 *    vez para puxar o código novo. Só recarrega em ATUALIZAÇÃO (quando já havia
 *    um controller), nunca no primeiro install, e com guarda contra loop.
 */

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

export function useAppUpdate() {
  const reloadedRef = useRef(false);
  // Havia um SW controlando a página no momento da montagem? Se sim, a próxima
  // troca de controller é uma ATUALIZAÇÃO (deve recarregar). Se não, é o primeiro
  // install (não recarregar — evita reload desnecessário na 1ª visita).
  const hadControllerRef = useRef(
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller,
  );

  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Erro ao registrar service worker:', error);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      check();
      window.setInterval(check, CHECK_INTERVAL);
      // Checa também quando o app volta ao foco (essencial no PWA mobile).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('focus', check);
    },
    onNeedRefresh() {
      // Aplica a nova versão em background (dispara skipWaiting/claim → reload via
      // o listener de controllerchange abaixo).
      updateServiceWorker(true).catch(() => {});
    },
  });

  // Recarrega a página quando o novo SW assume o controle.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      if (reloadedRef.current) return;
      if (!hadControllerRef.current) {
        // Primeiro install desta sessão — apenas registra, não recarrega.
        hadControllerRef.current = true;
        return;
      }
      reloadedRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  // Compatibilidade: UpdateNotification não renderiza (update é silencioso).
  const applyUpdate = useCallback(() => {}, []);
  const dismiss = useCallback(() => {}, []);

  return {
    updateAvailable: false,
    versionInfo: null,
    applyUpdate,
    dismiss,
  };
}
