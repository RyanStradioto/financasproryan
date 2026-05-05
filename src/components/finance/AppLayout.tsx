import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import UpdateNotification from './UpdateNotification';
import { TutorialProvider } from './AppTutorial';
import { SensitiveDataProvider } from './SensitiveData';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SensitiveDataProvider>
      <TutorialProvider>
        <div className="flex min-h-screen bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
            <MobileHeader />
            <main className="flex-1 w-full max-w-6xl mx-auto overflow-x-hidden px-3 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-8 lg:py-8 lg:pb-8">
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
