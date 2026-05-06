import type { Account } from '@/hooks/useFinanceData';

export type AccountBrand = {
  name: string;
  color: string;
  icon: string;
  logoUrl?: string;
};

const PRESETS: AccountBrand[] = [
  { name: 'nubank', color: '#8A05BE', icon: '🟣', logoUrl: 'https://cdn.simpleicons.org/nubank/8A05BE' },
  { name: 'alelo', color: '#00A551', icon: '🟢' },
  { name: 'vr', color: '#2BB24C', icon: '🟩' },
  { name: 'itau', color: '#EC7000', icon: '🟧', logoUrl: 'https://cdn.simpleicons.org/itau/EC7000' },
  { name: 'bradesco', color: '#CC092F', icon: '🟥', logoUrl: 'https://cdn.simpleicons.org/bradesco/CC092F' },
  { name: 'santander', color: '#EC0000', icon: '🔴', logoUrl: 'https://cdn.simpleicons.org/santander/EC0000' },
  { name: 'caixa', color: '#0066B3', icon: '🔷' },
  { name: 'inter', color: '#FF7A00', icon: '🟠' },
  { name: 'picpay', color: '#21C25E', icon: '🟢' },
];

export function resolveAccountBrand(name: string, fallbackColor?: string, fallbackIcon?: string): AccountBrand {
  const lower = name.toLowerCase();
  const found = PRESETS.find(p => lower.includes(p.name));
  if (found) return found;
  return {
    name: 'custom',
    color: fallbackColor || '#2563eb',
    icon: fallbackIcon || '🏦',
  };
}

export function accountBrandFromRow(account: Pick<Account, 'name' | 'color' | 'icon'>): AccountBrand {
  const preset = resolveAccountBrand(account.name, account.color, account.icon);
  return {
    ...preset,
    color: account.color || preset.color,
    icon: account.icon || preset.icon,
  };
}
