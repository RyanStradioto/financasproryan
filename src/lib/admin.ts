/**
 * Emails do dono do app (acesso à Central de Feedback / administração).
 * O dono usa a conta amaralstradiotoryan@gmail.com no app; mantemos também
 * o e-mail corporativo por segurança. Qualquer um destes vê o painel de admin.
 */
export const ADMIN_EMAILS = [
  'amaralstradiotoryan@gmail.com',
  'ryan.stradioto@biasiengenharia.com.br',
] as const;

/** Primeiro e-mail (compatibilidade com usos antigos de ADMIN_EMAIL). */
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === e);
}
