import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';
import MobileHeader from './MobileHeader';
import UpdateNotification from './UpdateNotification';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8 max-w-6xl mx-auto w-full">
          {children}
        </main>
      </div>
      <MobileNav />
      <UpdateNotification />
    </div>
  );
}
