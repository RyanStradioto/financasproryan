import { useState, useEffect, useCallback, useMemo } from 'react';
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

const VERSION_KEY = 'financaspro_app_version';
const CHECK_INTERVAL = 5 * 60 * 1000;
const GENERIC_CHANGES = [
  'Nova versao disponivel com melhorias de desempenho e estabilidade.',
  'A atualizacao inclui ajustes visuais e correcoes para o app mobile.',
];

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

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
      const storedVersion = localStorage.getItem(VERSION_KEY);
      const latestVersion = manifest.versions.find((entry) => entry.version === manifest.current);

      if (!storedVersion) {
        setUpdateInfo({
          version: manifest.current,
          date: latestVersion?.date || new Date().toISOString().slice(0, 10),
          changes: latestVersion?.changes?.slice(0, 8) || GENERIC_CHANGES,
        });
        return;
      }

      if (storedVersion === manifest.current) {
        if (!needRefresh) {
          setUpdateInfo(null);
        }
        return;
      }

      const storedNumber = parseFloat(storedVersion);
      const newerVersions = manifest.versions.filter((entry) => parseFloat(entry.version) > storedNumber);
      setUpdateInfo({
        version: manifest.current,
        date: latestVersion?.date || new Date().toISOString().slice(0, 10),
        changes: newerVersions.flatMap((entry) => entry.changes).slice(0, 8),
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

  useEffect(() => {
    if (needRefresh && !updateInfo) {
      setUpdateInfo({
        version: localStorage.getItem(VERSION_KEY) || 'nova',
        date: new Date().toISOString().slice(0, 10),
        changes: GENERIC_CHANGES,
      });
    }
  }, [needRefresh, updateInfo]);

  useEffect(() => {
    if (updateInfo && dismissedVersion !== updateInfo.version) {
      setDismissedVersion(null);
    }
  }, [updateInfo, dismissedVersion]);

  const updateAvailable = useMemo(() => {
    if (!updateInfo) return false;
    if (dismissedVersion === updateInfo.version) return false;
    return needRefresh || updateInfo.changes.length > 0;
  }, [dismissedVersion, needRefresh, updateInfo]);

  const applyUpdate = useCallback(async () => {
    if (updateInfo?.version) {
      localStorage.setItem(VERSION_KEY, updateInfo.version);
    }

    if (needRefresh) {
      await updateServiceWorker(true);
      return;
    }

    window.location.reload();
  }, [needRefresh, updateInfo, updateServiceWorker]);

  const dismiss = useCallback(() => {
    if (updateInfo?.version) {
      localStorage.setItem(VERSION_KEY, updateInfo.version);
      setDismissedVersion(updateInfo.version);
    }
  }, [updateInfo]);

  return {
    updateAvailable,
    versionInfo: updateInfo,
    applyUpdate,
    dismiss,
  };
}
