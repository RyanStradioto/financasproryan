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

      console.log('📌 Verificando atualizações:', { stored: storedVersion, current: data.current });

      if (!storedVersion) {
        // Primeira vez — salva a versão atual
        localStorage.setItem(VERSION_KEY, data.current);
        console.log('✅ Primeira vez - versão armazenada:', data.current);
        return;
      }

      if (storedVersion !== data.current) {
        // Encontra versões mais novas
        const storedNum = parseFloat(storedVersion);
        const currentNum = parseFloat(data.current);
        
        console.log('🔍 Comparação de versões:', { stored: storedNum, current: currentNum });
        
        if (currentNum > storedNum) {
          const newerVersions = data.versions.filter(v => parseFloat(v.version) > storedNum);
          const accumulatedChanges = newerVersions.flatMap(v => v.changes);
          const latestVersion = data.versions.find(v => v.version === data.current);

          if (accumulatedChanges.length > 0) {
            setVersionInfo({
              version: data.current,
              date: latestVersion?.date || data.versions[data.versions.length - 1].date,
              changes: accumulatedChanges
            });
            setUpdateAvailable(true);
            console.log('🔔 NOVA ATUALIZAÇÃO DETECTADA:', { version: data.current, changes: accumulatedChanges.length });
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
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
