import { useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service worker auto-update silencioso.
 *
 * - Registra o SW e checa por novas versões a cada 5 min
 * - Quando há nova versão, atualiza em background sem mostrar modal
 * - O usuário pega o novo código no próximo navigation/reload
 * - Mantém a assinatura antiga (updateAvailable/versionInfo) para
 *   compatibilidade com UpdateNotification, mas sempre retorna falsy
 */

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 min

export function useAppUpdate() {
  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Erro ao registrar service worker:', error);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registration.update().catch(() => {});
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, CHECK_INTERVAL);
    },
    onNeedRefresh() {
      // Auto-aplica em background — sem alarmar o usuário
      updateServiceWorker(true).catch(() => {});
    },
  });

  // Compatibilidade: retorna estado vazio para o UpdateNotification não renderizar
  const applyUpdate = useCallback(() => {}, []);
  const dismiss = useCallback(() => {}, []);

  return {
    updateAvailable: false,
    versionInfo: null,
    applyUpdate,
    dismiss,
  };
}

