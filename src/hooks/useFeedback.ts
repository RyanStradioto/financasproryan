import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isAdminEmail } from '@/lib/admin';

export type FeedbackType = 'bug' | 'feature';
export type FeedbackStatus = 'pending' | 'planned' | 'in_progress' | 'done' | 'discarded';
export type FeedbackPriority = 'baixa' | 'normal' | 'alta';

export interface Feedback {
  id: string;
  user_id: string;
  user_email: string | null;
  type: FeedbackType;
  title: string;
  description: string;
  target_page: string | null;
  needs_new_page: boolean;
  new_page_name: string | null;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewFeedback {
  type: FeedbackType;
  title: string;
  description: string;
  target_page?: string | null;
  needs_new_page?: boolean;
  new_page_name?: string | null;
  priority?: FeedbackPriority;
}

/** Envia um novo feedback (o usuário logado). */
export function useSubmitFeedback() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: NewFeedback) => {
      if (!user) throw new Error('Você precisa estar logado.');
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email ?? null,
        type: data.type,
        title: data.title.trim(),
        description: data.description.trim(),
        target_page: data.target_page ?? null,
        needs_new_page: data.needs_new_page ?? false,
        new_page_name: data.new_page_name?.trim() || null,
        priority: data.priority ?? 'normal',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback', 'mine'] });
      qc.invalidateQueries({ queryKey: ['feedback', 'all'] });
    },
  });
}

/** Lista os feedbacks do próprio usuário. */
export function useMyFeedback() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['feedback', 'mine', user?.id],
    enabled: !!user,
    // Refaz ao voltar para o app: garante que a resposta/atualização do admin
    // apareça logo para o usuário (sem precisar de realtime).
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) {
        if (/relation .*feedback.* does not exist/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Feedback[];
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Notificações de status: marca quais solicitações tiveram resposta/mudança
// que o usuário ainda não viu. Persistimos em localStorage o updated_at já
// "visto" de cada feedback; se o updated_at atual for diferente e houver
// atividade do admin (status != pending ou resposta), conta como não lido.
// ──────────────────────────────────────────────────────────────
const FEEDBACK_SEEN_KEY = 'financaspro:feedback:seen:v1';
const FEEDBACK_SEEN_EVENT = 'financaspro:feedback-seen-changed';

function readSeenMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_SEEN_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}
function writeSeenMap(map: Record<string, string>) {
  try {
    localStorage.setItem(FEEDBACK_SEEN_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(FEEDBACK_SEEN_EVENT));
  } catch {
    /* ignore */
  }
}

/** map reativo de "visto" (atualiza ao marcar como lido, inclusive entre abas). */
function useSeenMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(readSeenMap);
  useEffect(() => {
    const refresh = () => setMap(readSeenMap());
    window.addEventListener(FEEDBACK_SEEN_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(FEEDBACK_SEEN_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return map;
}

/** Um feedback tem "atualização" relevante quando saiu de pendente ou ganhou resposta. */
function hasAdminUpdate(f: Feedback): boolean {
  return f.status !== 'pending' || !!(f.admin_note && f.admin_note.trim());
}

/** Solicitações do usuário com novidade não lida (status/resposta do admin). */
export function useFeedbackUnread() {
  const { data: mine = [] } = useMyFeedback();
  const seen = useSeenMap();

  const unreadIds = useMemo(() => {
    const s = new Set<string>();
    for (const f of mine) {
      if (hasAdminUpdate(f) && seen[f.id] !== f.updated_at) s.add(f.id);
    }
    return s;
  }, [mine, seen]);

  const markAllSeen = useCallback(() => {
    const map = readSeenMap();
    for (const f of mine) map[f.id] = f.updated_at;
    writeSeenMap(map);
  }, [mine]);

  return { unreadIds, unreadCount: unreadIds.size, markAllSeen };
}

/** Só a contagem de não lidos — para os badges da navegação. */
export function useFeedbackUnreadCount(): number {
  return useFeedbackUnread().unreadCount;
}

/** Lista TODOS os feedbacks (admin). */
export function useAllFeedback() {
  const { user } = useAuth();
  const admin = isAdminEmail(user?.email);
  return useQuery({
    queryKey: ['feedback', 'all'],
    enabled: !!user && admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (/relation .*feedback.* does not exist/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []) as Feedback[];
    },
  });
}

/** Atualiza status / anotação de um feedback (admin). */
export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<Feedback, 'status' | 'admin_note' | 'priority'>>) => {
      const { error } = await supabase.from('feedback').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback', 'all'] });
      qc.invalidateQueries({ queryKey: ['feedback', 'mine'] });
    },
  });
}
