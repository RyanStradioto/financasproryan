import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 p-4 lg:p-8 pb-20 lg:pb-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
