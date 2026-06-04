import { useState } from 'react';
import { useSubmitFeedback, useMyFeedback, type FeedbackType, type FeedbackStatus, type FeedbackPriority } from '@/hooks/useFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, Lightbulb, Send, CheckCircle2, Sparkles, MessageSquarePlus, Clock, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const APP_PAGES = [
  'Dashboard', 'Receitas', 'Despesas', 'Cartões', 'Investimentos',
  'Categorias', 'Contas', 'Calendário', 'Relatório', 'Insights IA',
  'Planejamento', 'Importar', 'Configurações', 'Lixeira', 'Geral / app inteiro',
];

const STATUS_META: Record<FeedbackStatus, { label: string; cls: string }> = {
  pending:     { label: 'Em análise',        cls: 'bg-muted text-muted-foreground border-border' },
  planned:     { label: 'Planejado',         cls: 'bg-info/10 text-info border-info/30' },
  in_progress: { label: 'Em desenvolvimento', cls: 'bg-warning/10 text-warning border-warning/30' },
  done:        { label: 'Implementado',      cls: 'bg-income/10 text-income border-income/30' },
  discarded:   { label: 'Descartado',        cls: 'bg-expense/10 text-expense border-expense/30' },
};

export default function FeedbackPage() {
  const submit = useSubmitFeedback();
  const { data: mine = [] } = useMyFeedback();

  const [type, setType] = useState<FeedbackType>('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetPage, setTargetPage] = useState<string>('Geral / app inteiro');
  const [needsNewPage, setNeedsNewPage] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [priority, setPriority] = useState<FeedbackPriority>('normal');

  const reset = () => {
    setTitle(''); setDescription(''); setTargetPage('Geral / app inteiro');
    setNeedsNewPage(false); setNewPageName(''); setPriority('normal'); setType('feature');
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Dê um título para a sua solicitação'); return; }
    try {
      await submit.mutateAsync({
        type, title, description,
        target_page: targetPage,
        needs_new_page: needsNewPage,
        new_page_name: needsNewPage ? newPageName : null,
        priority,
      });
      toast.success('Enviado para análise! ✅', {
        description: 'Sua solicitação foi registrada e o Ryan vai avaliar. Obrigado!',
        duration: 5000,
      });
      reset();
    } catch (e) {
      toast.error('Erro ao enviar: ' + (e as Error).message);
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/25 to-primary/5 shadow-inner">
            <MessageSquarePlus className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">
              Feedback & Sugestões
              <Sparkles className="h-4 w-4 text-primary opacity-60 shrink-0" />
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              Achou um bug ou tem uma ideia? Conta pra gente — você ainda indica em qual página deve entrar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* Form */}
        <div className="stat-card space-y-5">
          {/* Type toggle */}
          <div>
            <Label className="mb-2 block text-xs text-muted-foreground">O que você quer enviar?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('bug')}
                className={cn('flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all',
                  type === 'bug' ? 'border-expense bg-expense/10 text-expense' : 'border-border bg-muted/30 text-muted-foreground hover:border-expense/40')}
              >
                <Bug className="h-4 w-4" /> Reportar bug
              </button>
              <button
                type="button"
                onClick={() => setType('feature')}
                className={cn('flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all',
                  type === 'feature' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40')}
              >
                <Lightbulb className="h-4 w-4" /> Nova função
              </button>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'bug' ? 'Ex: O valor do cartão aparece dobrado' : 'Ex: Quero exportar o relatório em PDF'}
              maxLength={120}
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Descrição (quanto mais detalhe, melhor)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'bug' ? 'O que aconteceu? Como reproduzir? O que você esperava?' : 'Descreva a ideia e como ela ajudaria você.'}
              rows={4}
            />
          </div>

          {/* Target page */}
          <div>
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Em qual página deve entrar?
            </Label>
            <Select value={targetPage} onValueChange={setTargetPage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APP_PAGES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* New page */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-border/60 bg-muted/20 p-3">
            <input
              type="checkbox"
              checked={needsNewPage}
              onChange={(e) => setNeedsNewPage(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Acho que precisa de uma nova aba</span>
              <span className="block text-[11px] text-muted-foreground">Marque se a sua ideia pede uma página/seção que ainda não existe.</span>
            </span>
          </label>
          {needsNewPage && (
            <div className="-mt-2">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Nome sugerido para a nova aba</Label>
              <Input value={newPageName} onChange={(e) => setNewPageName(e.target.value)} placeholder="Ex: Metas, Assinaturas, Dívidas..." maxLength={60} />
            </div>
          )}

          {/* Priority */}
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Urgência (pra você)</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['baixa', 'normal', 'alta'] as FeedbackPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn('rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-all',
                    priority === p ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/40')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={submit.isPending} className="w-full gap-2">
            <Send className="h-4 w-4" /> {submit.isPending ? 'Enviando...' : 'Enviar para análise'}
          </Button>
        </div>

        {/* My requests */}
        <div className="stat-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" /> Minhas solicitações
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{mine.length}</span>
          </h3>
          {mine.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <MessageSquarePlus className="h-8 w-8 opacity-30" />
              <p className="text-sm">Você ainda não enviou nada.</p>
              <p className="text-xs">Suas solicitações e o status delas aparecem aqui.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {mine.map((f) => {
                const st = STATUS_META[f.status];
                return (
                  <div key={f.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {f.type === 'bug' ? <Bug className="h-3.5 w-3.5 shrink-0 text-expense" /> : <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <p className="truncate text-sm font-semibold">{f.title}</p>
                      </div>
                      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', st.cls)}>{st.label}</span>
                    </div>
                    {f.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      {f.target_page && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.target_page}</span>}
                      {f.needs_new_page && <span className="flex items-center gap-1"><Plus className="h-3 w-3" />Nova aba{f.new_page_name ? `: ${f.new_page_name}` : ''}</span>}
                      <span>{formatDate(f.created_at.slice(0, 10))}</span>
                    </div>
                    {f.admin_note && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 text-[11px] text-foreground">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                        <span><b className="text-primary">Resposta:</b> {f.admin_note}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
