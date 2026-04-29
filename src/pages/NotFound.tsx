import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { appLogger } from "@/lib/appLogger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    appLogger.warn("404 — rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 mx-auto">
          <span className="text-primary-foreground font-bold text-2xl">?</span>
        </div>
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Página não encontrada</p>
        <Link
          to="/"
          className="inline-block mt-2 text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
