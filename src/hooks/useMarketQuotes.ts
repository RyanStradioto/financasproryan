import { useQuery } from '@tanstack/react-query';

/**
 * Cotações ao vivo (Dólar, Euro, Bitcoin, Ethereum) via AwesomeAPI — grátis,
 * sem chave e com CORS liberado. Se a rede falhar, retorna [] sem quebrar nada.
 */

export type Quote = {
  code: string;       // USD, EUR, BTC, ETH
  label: string;      // Dólar, Euro...
  emoji: string;
  price: number;      // em BRL
  pctChange: number;  // variação % do dia
};

const SYMBOLS = 'USD-BRL,EUR-BRL,BTC-BRL,ETH-BRL';

const META: Record<string, { label: string; emoji: string }> = {
  USD: { label: 'Dólar', emoji: '🇺🇸' },
  EUR: { label: 'Euro', emoji: '🇪🇺' },
  BTC: { label: 'Bitcoin', emoji: '₿' },
  ETH: { label: 'Ethereum', emoji: 'Ξ' },
};

export function useMarketQuotes() {
  return useQuery<Quote[]>({
    queryKey: ['market-quotes', SYMBOLS],
    staleTime: 5 * 60 * 1000,        // 5 min frescos
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${SYMBOLS}`);
      if (!res.ok) throw new Error('Falha ao buscar cotações');
      const data = (await res.json()) as Record<string, { bid: string; pctChange: string }>;
      const order = ['USD', 'EUR', 'BTC', 'ETH'];
      const quotes: Quote[] = [];
      for (const code of order) {
        const raw = data[`${code}BRL`];
        if (!raw) continue;
        const meta = META[code];
        quotes.push({
          code,
          label: meta?.label ?? code,
          emoji: meta?.emoji ?? '💱',
          price: Number(raw.bid) || 0,
          pctChange: Number(raw.pctChange) || 0,
        });
      }
      return quotes;
    },
  });
}
