import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';
import { useAllFeedback, useUpdateFeedback, type Feedback, type FeedbackStatus } from '@/hooks/useFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, Lightbulb, ShieldAlert, MapPin, Plus, Mail, Inbox, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const STATUSES: { value: FeedbackStatus; label: string; cls: string }[] = [
  { value: 'pending',     label: 'Em análise',         cls: 'bg-muted text-muted-foreground border-border' },
  { value: 'planned',     label: 'Planejado',          cls: 'bg-info/10 text-info border-info/30' },
  { value: 'in_progress', label: 'Em desenvolvimento', cls: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'done',        label: 'Implementado',       cls: 'bg-income/10 text-income border-income/30' },
  { value: 'discarded',   label: 'Descartado',         cls: 'bg-expense/10 text-expense border-expense/30' },
];
const statusMeta = (s: FeedbackStatus) => STATUSES.find(x => x.value === s)!;

function AdminCard({ f }: { f: Feedback }) {
  const update = useUpdateFeedback();
  const [note, setNote] = useState(f.admin_note ?? '');
  const dirtyNote = note !== (f.admin_note ?? '');

  const setStatus = async (status: FeedbackStatus) => {
    try { await update.mutateAsync({ id: f.id, status }); toast.success('Status atualizado'); }
    catch (e) { toast.error((e as Error).message); }
  };
  const saveNote = async () => {
    try { await update.mutateAsync({ id: f.id, admin_note: note.trim() || null }); toast.success('Resposta salva'); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="stat-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {f.type === 'bug'
            ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-expense/10 text-expense"><Bug className="h-4 w-4" /></span>
            : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Lightbulb className="h-4 w-4" /></span>}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{f.title}</p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" />{f.user_email || '—'}</p>
          </div>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', statusMeta(f.status).cls)}>{statusMeta(f.status).label}</span>
      </div>

      {f.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{f.description}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {f.target_page && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.target_page}</span>}
        {f.needs_new_page && <span className="flex items-center gap-1 text-primary"><Plus className="h-3 w-3" />Nova aba{f.new_page_name ? `: ${f.new_page_name}` : ''}</span>}
        <span className={cn('rounded px-1.5 py-0.5 font-semibold',
          f.priority === 'alta' ? 'bg-expense/10 text-expense' : f.priority === 'baixa' ? 'bg-muted text-muted-foreground' : 'bg-info/10 text-info')}>
          urgência {f.priority}
        </span>
        <span>{formatDate(f.created_at.slice(0, 10))}</span>
      </div>

      {/* Status control */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            disabled={f.status === s.value || update.isPending}
            className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-100',
              f.status === s.value ? s.cls : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground')}
          >
            {f.status === s.value && <Check className="mr-1 inline h-3 w-3" />}{s.label}
          </button>
        ))}
      </div>

      {/* Admin note */}
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resposta/anotação para o usuário..." className="text-xs" />
        <Button size="sm" variant="outline" onClick={saveNote} disabled={!dirtyNote || update.isPending} className="shrink-0 gap-1">
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      </div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const admin = isAdminEmail(user?.email);
  const { data: all = [], isLoading } = useAllFeedback();
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUSES) c[s.value] = all.filter(f => f.status === s.value).length;
    return c;
  }, [all]);

  const filtered = filter === 'all' ? all : all.filter(f => f.status === filter);

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">Esta área é exclusiva do administrador.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:rounded-3xl sm:p-7">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/25 to-primary/5 shadow-inner">
            <Inbox className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Central de Feedback</h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">Tudo que os usuários enviaram — gerencie status e responda.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn('rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
            filter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground')}
        >
          Todos <span className="ml-1 opacity-70">{counts.all}</span>
        </button>
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={cn('rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all',
              filter === s.value ? s.cls : 'border-border bg-muted/20 text-muted-foreground hover:text-foreground')}
          >
            {s.label} <span className="ml-1 opacity-70">{counts[s.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma solicitação {filter !== 'all' ? 'nesse status' : 'ainda'}.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map(f => <AdminCard key={f.id} f={f} />)}
        </div>
      )}
    </div>
  );
}
