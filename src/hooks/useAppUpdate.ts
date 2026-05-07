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
const APPLIED_VERSION_KEY = 'financaspro_applied_version';
const CHECK_INTERVAL = 60 * 1000; // 1 min instead of 5
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
    onNeedRefresh() {
      // SW detected new version waiting. Auto-apply silently if user already
      // saw the current version notification (or it's a brand new install).
      const seen = localStorage.getItem(SEEN_VERSION_KEY);
      const applied = localStorage.getItem(APPLIED_VERSION_KEY);
      if (seen && applied === seen) {
        // Already applied this version's notification — nothing to do
        return;
      }
      // Will be handled by useEffect below — just trigger version check
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
    if (version) {
      localStorage.setItem(SEEN_VERSION_KEY, version);
      localStorage.setItem(APPLIED_VERSION_KEY, version);
    }
    versionInfoRef.current = null;
    setVersionInfo(null);

    // Force a hard refresh that bypasses cache — the most reliable way to
    // ensure the user sees the new build even if SW didn't activate yet.
    if (needRefresh) {
      updateServiceWorker(true).catch(() => {});
    }
    // Add cache-bust query so any stale assets get re-requested
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString(36));
      window.location.replace(url.toString());
    }, 100);
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
