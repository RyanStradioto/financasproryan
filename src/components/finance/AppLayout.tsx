import type { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import UpdateNotification from './UpdateNotification';
import { TutorialProvider } from './AppTutorial';
import { SensitiveDataProvider } from './SensitiveData';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SensitiveDataProvider>
      <TutorialProvider>
        <div className="flex min-h-screen bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
            <MobileHeader />
            <main className="flex-1 w-full mx-auto overflow-x-hidden px-3 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-10 xl:px-14 lg:py-8 lg:pb-10 max-w-[1600px] 2xl:max-w-[1800px]">
              {children}
            </main>
          </div>
          <MobileNav />
          <UpdateNotification />
        </div>
      </TutorialProvider>
    </SensitiveDataProvider>
  );
}
