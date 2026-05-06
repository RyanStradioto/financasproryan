import type { Account } from '@/hooks/useFinanceData';

export type AccountBrand = {
  name: string;
  color: string;
  icon: string;
  logoUrl?: string;
};

type BrandPreset = AccountBrand & {
  aliases: string[];
};

const PRESETS: BrandPreset[] = [
  {
    name: 'nubank',
    aliases: ['nubank', 'nu'],
    color: '#6D2177',
    icon: '🟣',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Nubank_logo.svg',
  },
  {
    name: 'alelo',
    aliases: ['alelo'],
    color: '#0A8E69',
    icon: '🟢',
  },
  {
    name: 'vr',
    aliases: ['vr', 'vr beneficios', 'vr benefícios'],
    color: '#00C853',
    icon: '🟩',
    logoUrl: 'https://www.vr.com.br/sites/default/files/VR%20Benef%C3%ADcios.png',
  },
  {
    name: 'caju',
    aliases: ['caju'],
    color: '#F43A59',
    icon: '🟥',
    logoUrl: 'https://cdn.prod.website-files.com/68b6fa277e5c017395008330/68b9a0dfba97ba0c2b7d7503_logo-caju.svg',
  },
  {
    name: 'itau',
    aliases: ['itau', 'itaú'],
    color: '#EC7000',
    icon: '🟧',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Banco_Ita%C3%BA_logo.svg',
  },
  {
    name: 'bradesco',
    aliases: ['bradesco'],
    color: '#CC092F',
    icon: '🟥',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Banco_Bradesco_logo.svg',
  },
  {
    name: 'santander',
    aliases: ['santander'],
    color: '#EC0000',
    icon: '🔴',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Banco_Santander_Logotipo.svg',
  },
  { name: 'caixa', aliases: ['caixa'], color: '#0066B3', icon: '🔷' },
  { name: 'inter', aliases: ['inter'], color: '#FF7A00', icon: '🟠' },
  { name: 'picpay', aliases: ['picpay'], color: '#21C25E', icon: '🟢' },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function hasAlias(normalizedName: string, alias: string) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;

  if (normalizedAlias.length <= 2) {
    const tokens = normalizedName.split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.includes(normalizedAlias);
  }

  return normalizedName.includes(normalizedAlias);
}

export function resolveAccountBrand(name: string, fallbackColor?: string, fallbackIcon?: string): AccountBrand {
  const normalizedName = normalizeText(name);
  const found = PRESETS.find((preset) => preset.aliases.some((alias) => hasAlias(normalizedName, alias)));
  if (found) return found;

  return {
    name: 'custom',
    color: fallbackColor || '#2563eb',
    icon: fallbackIcon || '🏦',
  };
}

export function accountBrandFromRow(account: Pick<Account, 'name' | 'color' | 'icon'>): AccountBrand {
  const preset = resolveAccountBrand(account.name, account.color, account.icon);
  // For known brands, always use the preset's canonical color and logo.
  // Only use the DB color for unknown/custom accounts.
  if (preset.name !== 'custom') {
    return preset;
  }
  return {
    ...preset,
    color: account.color || preset.color,
    icon: account.icon || preset.icon,
  };
}
