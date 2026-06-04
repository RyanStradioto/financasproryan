/** Email do dono do app (acesso à aba de administração de feedback). */
export const ADMIN_EMAIL = 'ryan.stradioto@biasiengenharia.com.br';

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
