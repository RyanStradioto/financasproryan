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
