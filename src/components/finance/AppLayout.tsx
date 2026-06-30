import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import UpdateNotification from './UpdateNotification';
import WhatsNewDialog from './WhatsNewDialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import { TutorialProvider } from './AppTutorial';
import { SensitiveDataProvider } from './SensitiveData';
import { cn } from '@/lib/utils';

export type SidebarMode = 'expanded' | 'rail' | 'hidden';
const SIDEBAR_MODE_KEY = 'sidebar-mode';

export default function AppLayout({ children }: { children: ReactNode }) {
  // Estado da sidebar (só afeta lg+; no mobile o menu é o MobileNav). Persistido
  // para a escolha valer entre telas e reloads.
  const [mode, setMode] = useState<SidebarMode>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
      if (saved === 'rail' || saved === 'hidden' || saved === 'expanded') return saved;
    } catch { /* ignore */ }
    return 'expanded';
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_MODE_KEY, mode); }
    catch { /* ignore (modo privado, etc.) */ }
  }, [mode]);

  return (
    <SensitiveDataProvider>
      <TutorialProvider>
        <div className={cn(
          'app-bg min-h-screen transition-[padding] duration-300 ease-in-out',
          mode === 'hidden' ? 'lg:pl-0' : mode === 'rail' ? 'lg:pl-[76px]' : 'lg:pl-[260px]',
        )}>
          <AppSidebar
            mode={mode}
            onCollapse={() => setMode('rail')}
            onExpand={() => setMode('expanded')}
            onHide={() => setMode('hidden')}
          />

          {/* Botão flutuante para reabrir quando a sidebar está escondida (só lg+) */}
          {mode === 'hidden' && (
            <button
              onClick={() => setMode('expanded')}
              title="Mostrar menu"
              aria-label="Mostrar menu"
              className="hidden lg:flex fixed left-3 top-3 z-40 w-9 h-9 items-center justify-center rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          <div className="flex flex-col min-w-0 overflow-x-hidden">
            <MobileHeader />
            <main className="flex-1 w-full mx-auto overflow-x-hidden px-3 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-10 xl:px-14 lg:py-8 lg:pb-10 max-w-[1600px] 2xl:max-w-[1800px]">
              {children}
            </main>
          </div>
          <MobileNav />
          <UpdateNotification />
          <ErrorBoundary label="WhatsNew" fallback={null}>
            <WhatsNewDialog />
          </ErrorBoundary>
        </div>
      </TutorialProvider>
    </SensitiveDataProvider>
  );
}
