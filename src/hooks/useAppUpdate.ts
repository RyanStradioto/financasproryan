import { useState, useEffect, useCallback } from 'react';

interface VersionInfo {
  current: string;
  versions: Array<{
    version: string;
    date: string;
    changes: string[];
  }>;
}

const VERSION_KEY = 'financaspro_app_version';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data: VersionInfo = await res.json();
      const storedVersion = localStorage.getItem(VERSION_KEY);

      if (!storedVersion) {
        // Primeira vez — salva a versão atual sem mostrar notificação
        localStorage.setItem(VERSION_KEY, data.current);
        return;
      }

      if (storedVersion !== data.current) {
        // Accumulate changes from versions newer than stored
        const newerVersions = data.versions.filter(v => v.version > storedVersion);
        const accumulatedChanges = newerVersions.flatMap(v => v.changes);
        const latestVersion = data.versions.find(v => v.version === data.current);

        setVersionInfo({
          version: data.current,
          date: latestVersion?.date || data.versions[data.versions.length - 1].date,
          changes: accumulatedChanges
        });
        setUpdateAvailable(true);
      }
    } catch {
      // Silencioso — sem rede ou erro de fetch
    }
  }, []);

  useEffect(() => {
    // Verifica ao montar
    checkForUpdate();

    // Verifica periodicamente
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkForUpdate]);

  // Também verifica quando o app volta ao foco (usuário voltou pra aba/app)
  useEffect(() => {
    const onFocus = () => checkForUpdate();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [checkForUpdate]);

  const applyUpdate = useCallback(() => {
    if (versionInfo) {
      localStorage.setItem(VERSION_KEY, versionInfo.version);
    }
    window.location.reload();
  }, [versionInfo]);

  const dismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, versionInfo, applyUpdate, dismiss };
}
