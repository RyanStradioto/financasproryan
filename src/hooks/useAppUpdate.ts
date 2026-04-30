import { useState, useEffect, useCallback, useRef } from 'react';
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
  const versionInfoRef = useRef<UpdateInfo | null>(null);

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
    // Não re-verifica enquanto o modal já está visível
    if (versionInfoRef.current) return;

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const manifest: VersionManifest = await response.json();
      const seenVersion = localStorage.getItem(SEEN_VERSION_KEY);

      if (seenVersion === manifest.current) return;

      const latestVersion = manifest.versions.find((entry) => entry.version === manifest.current);
      const info: UpdateInfo = {
        version: manifest.current,
        date: latestVersion?.date || new Date().toISOString().slice(0, 10),
        changes: latestVersion?.changes?.slice(0, 8) || GENERIC_CHANGES,
      };
      versionInfoRef.current = info;
      setVersionInfo(info);
    } catch (error) {
      console.error('Erro ao verificar atualizacoes:', error);
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL);
    return () => window.clearInterval(interval);
  }, [checkForUpdate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkForUpdate]);

  const applyUpdate = useCallback(() => {
    const version = versionInfoRef.current?.version;
    if (version) localStorage.setItem(SEEN_VERSION_KEY, version);
    versionInfoRef.current = null;
    setVersionInfo(null);

    if (needRefresh) {
      updateServiceWorker(true).catch(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }, [needRefresh, updateServiceWorker]);

  const dismiss = useCallback(() => {
    const version = versionInfoRef.current?.version;
    if (version) localStorage.setItem(SEEN_VERSION_KEY, version);
    versionInfoRef.current = null;
    setVersionInfo(null);
  }, []);

  return {
    updateAvailable: !!versionInfo,
    versionInfo,
    applyUpdate,
    dismiss,
  };
}
