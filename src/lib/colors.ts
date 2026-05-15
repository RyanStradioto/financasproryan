/**
 * Paletas centralizadas para gráficos e cartões.
 *
 * Mantém a paleta consistente entre Dashboard, Categorias e CreditCards
 * sem espalhar hex codes pelo código.
 */

export const CHART_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
] as const;

export const CARD_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f97316', // orange
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#0ea5e9', // sky
  '#f59e0b', // amber
] as const;

/**
 * Converte um hex (`#RRGGBB` ou `#RGB`) em rgba() com a opacidade dada.
 * Fallback: rgba azul se o hex for inválido.
 */
export function colorWithOpacity(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '');
  const normalized = cleanHex.length === 3
    ? cleanHex.split('').map((char) => char + char).join('')
    : cleanHex;
  const int = Number.parseInt(normalized, 16);
  if (Number.isNaN(int)) return `rgba(37, 99, 235, ${opacity})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
