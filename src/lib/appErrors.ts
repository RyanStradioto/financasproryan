/**
 * appErrors — mensagens de erro amigáveis centralizadas.
 *
 * Converte códigos de erro técnicos do Supabase/rede em mensagens
 * legíveis para o usuário final (pt-BR).
 *
 * Uso:
 *   import { getFriendlyError } from '@/lib/appErrors';
 *   toast.error(getFriendlyError(error));
 */

import { appLogger } from './appLogger';

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string;
  status?: number;
}

/** Mapa de códigos Postgres / Supabase → mensagem amigável. */
const CODE_MAP: Record<string, string> = {
  // Auth
  'invalid_credentials':    'E-mail ou senha incorretos.',
  'user_not_found':         'Usuário não encontrado.',
  'email_not_confirmed':    'Confirme seu e-mail antes de entrar.',
  'over_email_send_rate_limit': 'Muitas tentativas. Aguarde um momento e tente novamente.',

  // Postgres
  '23505': 'Registro duplicado. Verifique se já existe um cadastro igual.',
  '23503': 'Não é possível remover este item pois ele está em uso por outros registros.',
  '42501': 'Sem permissão para realizar esta ação.',
  '42P01': 'Tabela não encontrada. Entre em contato com o suporte.',
  '42703': 'Campo não encontrado. Pode ser necessário atualizar o app.',
  'PGRST116': 'Nenhum registro encontrado.',
  'PGRST204': 'Campo opcional não disponível nesta versão do banco.',

  // Rede / fetch
  'Failed to fetch':  'Sem conexão com o servidor. Verifique sua internet.',
  'NetworkError':     'Erro de rede. Tente novamente.',
  'AbortError':       'A operação foi cancelada.',
};

/**
 * Retorna uma mensagem amigável para o usuário a partir de um erro.
 * @param error  Qualquer objeto de erro (Supabase, JS nativo, string, etc.)
 * @param fallback  Mensagem padrão caso nenhum padrão seja reconhecido.
 */
export function getFriendlyError(
  error: ErrorLike | Error | string | unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.'
): string {
  appLogger.error('getFriendlyError →', error);

  if (!error) return fallback;

  if (typeof error === 'string') {
    return CODE_MAP[error] ?? (error.length < 120 ? error : fallback);
  }

  const err = error as ErrorLike & { name?: string };

  // Código Supabase / Postgres
  if (err.code && CODE_MAP[err.code]) return CODE_MAP[err.code];

  // Mensagem de erro do JS nativo (name)
  if (err.name && CODE_MAP[err.name]) return CODE_MAP[err.name];

  // Parcial na mensagem (ex: "Failed to fetch")
  const msg = err.message ?? '';
  for (const [key, friendly] of Object.entries(CODE_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return friendly;
  }

  // HTTP status
  if (err.status === 401) return 'Sessão expirada. Faça login novamente.';
  if (err.status === 403) return 'Sem permissão para esta ação.';
  if (err.status === 404) return 'Recurso não encontrado.';
  if (err.status === 429) return 'Muitas requisições. Aguarde e tente novamente.';
  if (err.status != null && err.status >= 500) return 'Erro no servidor. Tente novamente em instantes.';

  // Mensagem curta legível como fallback
  if (msg && msg.length < 120) return msg;

  return fallback;
}
