import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label so users know which area failed (e.g. "Dashboard") */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Detecta erros causados por chunk JS antigo apos deploy. */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const name = error.name || '';
  return (
    name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk \d+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/** Recarrega a pagina com cache busting via query param. */
function hardReloadPage() {
  const url = new URL(window.location.href);
  url.searchParams.set('_v', Date.now().toString(36));
  window.location.replace(url.toString());
}

// Limita auto-reloads para nao entrar em loop infinito se algo deu MUITO errado
const RELOAD_KEY = 'financaspro:last-chunk-reload';
function tryAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
    if (Date.now() - last < 10_000) return false; // ja recarregou ha menos de 10s
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.label || 'unlabeled', error, info);

    // Erro de chunk antigo = stale tab apos deploy. Reload automatico.
    if (isChunkLoadError(error) && tryAutoReload()) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorBoundary] ChunkLoadError detectado, recarregando pagina...');
      hardReloadPage();
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  hardReload = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString(36));
    window.location.replace(url.toString());
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const msg = this.state.error?.message || 'Erro inesperado';
    return (
      <div className="rounded-2xl border border-expense/30 bg-expense/5 p-6 m-4 max-w-2xl mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-expense/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-expense" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold">Algo deu errado{this.props.label ? ` em "${this.props.label}"` : ''}</h2>
            <p className="text-sm text-muted-foreground mt-1">{msg}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Isto e um erro recuperavel. O resto do app continua funcionando.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={this.reset}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.hardReload}
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> Recarregar pagina
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
