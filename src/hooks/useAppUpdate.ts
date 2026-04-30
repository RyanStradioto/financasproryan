import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface ReleaseInfo {
  version: string;
  date: string;
  changes: string[];
}

interface VersionManifest {
  current: string;
  versions: ReleaseInfo[];
}

interface UpdateInfo {
  version: string;
  date: string;
  changes: string[];
}

const SEEN_VERSION_KEY = 'financaspro_seen_update_version';
const CHECK_INTERVAL = 5 * 60 * 1000;
const GENERIC_CHANGES = [
  'Nova versao disponivel com melhorias de desempenho e estabilidade.',
  'A atualizacao inclui ajustes importantes no app mobile e no comportamento do PWA.',
];

export function useAppUpdate() {
  const [versionInfo, setVersionInfo] = useState<UpdateInfo | null>(null);

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
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
  });

  const checkForUpdate = useCallback(async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const manifest: VersionManifest = await response.json();
      const seenVersion = localStorage.getItem(SEEN_VERSION_KEY);
      const latestVersion = manifest.versions.find((entry) => entry.version === manifest.current);

      if (seenVersion === manifest.current) {
        setVersionInfo(null);
        return;
      }

      setVersionInfo({
        version: manifest.current,
        date: latestVersion?.date || new Date().toISOString().slice(0, 10),
        changes: latestVersion?.changes?.slice(0, 8) || GENERIC_CHANGES,
      });
    } catch (error) {
      console.error('Erro ao verificar atualizacoes:', error);
    }
  }, [needRefresh]);

  useEffect(() => {
    checkForUpdate();

    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL);
    return () => window.clearInterval(interval);
  }, [checkForUpdate]);

  useEffect(() => {
    const handleFocus = () => checkForUpdate();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    if (versionInfo?.version) {
      localStorage.setItem(SEEN_VERSION_KEY, versionInfo.version);
    }

    if (needRefresh) {
      await updateServiceWorker(true);
      return;
    }

    window.location.reload();
  }, [needRefresh, updateServiceWorker, versionInfo]);

  const dismiss = useCallback(() => {
    if (versionInfo?.version) {
      localStorage.setItem(SEEN_VERSION_KEY, versionInfo.version);
    }
    setVersionInfo(null);
  }, [versionInfo]);

  return {
    updateAvailable: !!versionInfo,
    versionInfo,
    applyUpdate,
    dismiss,
  };
}
