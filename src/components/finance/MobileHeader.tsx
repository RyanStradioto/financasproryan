import { Wallet, Moon, Sun, Download, Share, PlusSquare, Smartphone } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type InstallMode = 'native' | 'ios' | 'unsupported';

export default function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const deferredPrompt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState({ ios: false, safari: false, android: false });

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const safari = /safari/.test(ua) && !/crios|fxios|edgios|opr\//.test(ua);
    const android = /android/.test(ua);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setPlatform({ ios, safari, android });
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event;
      setCanInstall(true);
    };

    const handleInstalled = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsStandalone(true);
      setInstallOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installMode = useMemo<InstallMode>(() => {
    if (canInstall) return 'native';
    if (platform.ios && platform.safari) return 'ios';
    return 'unsupported';
  }, [canInstall, platform.ios, platform.safari]);

  const showInstallButton = !isStandalone && (canInstall || platform.ios || platform.android);

  const handleInstall = async () => {
    if (!deferredPrompt.current) {
      setInstallOpen(true);
      return;
    }

    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
      deferredPrompt.current = null;
    }
  };

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
            <Wallet className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm tracking-tight truncate">FinancasPro</span>
        </div>
        <div className="flex items-center gap-1">
          {showInstallButton && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar app
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Instalar FinancasPro
            </DialogTitle>
            <DialogDescription>
              O app pode ser salvo na tela inicial para abrir em tela cheia e ficar com cara de aplicativo.
            </DialogDescription>
          </DialogHeader>

          {installMode === 'ios' ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="font-medium">No iPhone ou iPad, a instalacao e feita pelo Safari.</p>
              </div>
              <div className="space-y-2 text-muted-foreground">
                <p className="flex items-start gap-2">
                  <Share className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Toque no botao <strong className="text-foreground">Compartilhar</strong> no Safari.
                </p>
                <p className="flex items-start gap-2">
                  <PlusSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Escolha <strong className="text-foreground">Adicionar a Tela de Inicio</strong>.
                </p>
                <p className="flex items-start gap-2">
                  <Download className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  Confirme em <strong className="text-foreground">Adicionar</strong>.
                </p>
              </div>
            </div>
          ) : installMode === 'native' ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <p className="font-medium">Seu navegador ja liberou a instalacao.</p>
                <p className="text-muted-foreground mt-1">Toque no botao abaixo para concluir.</p>
              </div>
              <Button onClick={handleInstall} className="w-full">
                <Download className="w-4 h-4" />
                Instalar agora
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <p className="font-medium">A instalacao depende do navegador.</p>
                <p className="text-muted-foreground mt-1">
                  No Android, prefira abrir no Chrome ou Edge. No iPhone, use o Safari para aparecer a opcao de adicionar na tela inicial.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
