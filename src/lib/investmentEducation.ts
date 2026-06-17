/**
 * Conteúdo educativo sobre tipos de investimento + referências de mercado.
 * Tudo aqui é informativo/estimativo (não é recomendação de investimento).
 */

/** Taxas de referência (atualize quando o cenário macro mudar). */
export const CDI_ANUAL = 14.40;      // % a.a. — referência atual do CDI
export const SELIC_ANUAL = 14.75;    // % a.a. — referência atual da Selic
/** Poupança: 0,5% a.m. + TR quando Selic > 8,5% a.a. (~6,17% a.a. sem TR). */
export const POUPANCA_MENSAL = 0.005;
export const POUPANCA_ANUAL = (Math.pow(1 + POUPANCA_MENSAL, 12) - 1) * 100; // ~6,17%

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export type InvestmentClass = {
  key: string;
  name: string;
  emoji: string;
  color: string;          // hex
  category: 'Renda fixa' | 'Renda variável' | 'Cripto' | 'Internacional' | 'Reserva';
  risk: RiskLevel;        // 1 = muito baixo, 5 = muito alto
  liquidity: string;      // ex: "Diária", "No vencimento"
  potential: string;      // retorno típico (texto)
  tagline: string;        // frase curta de venda
  forWho: string;         // pra quem é
  pros: string[];
  cons: string[];
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  1: 'Muito baixo',
  2: 'Baixo',
  3: 'Médio',
  4: 'Alto',
  5: 'Muito alto',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  1: '#10b981',
  2: '#22c55e',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
};

export const INVESTMENT_CLASSES: InvestmentClass[] = [
  {
    key: 'tesouro_selic',
    name: 'Tesouro Selic',
    emoji: '🏛️',
    color: '#3b82f6',
    category: 'Reserva',
    risk: 1,
    liquidity: 'Diária (D+1)',
    potential: '~100% da Selic',
    tagline: 'O lugar mais seguro pra sua reserva de emergência.',
    forWho: 'Quem está começando e quer segurança total com liquidez.',
    pros: ['Garantido pelo Tesouro Nacional', 'Resgate rápido', 'Rende todo dia'],
    cons: ['IR regressivo sobre o ganho', 'Rende menos que renda variável no longo prazo'],
  },
  {
    key: 'cdb',
    name: 'CDB',
    emoji: '🏦',
    color: '#10b981',
    category: 'Renda fixa',
    risk: 2,
    liquidity: 'Diária ou no vencimento',
    potential: '100% a 120% do CDI',
    tagline: 'Empresta pro banco e recebe juros — simples e previsível.',
    forWho: 'Quem quer render mais que a poupança com baixo risco.',
    pros: ['Protegido pelo FGC até R$ 250 mil', 'Boa previsibilidade', 'Vários prazos'],
    cons: ['IR regressivo', 'Liquidez varia por título'],
  },
  {
    key: 'lci_lca',
    name: 'LCI / LCA',
    emoji: '🌾',
    color: '#84cc16',
    category: 'Renda fixa',
    risk: 2,
    liquidity: 'No vencimento (carência)',
    potential: '85% a 98% do CDI',
    tagline: 'Renda fixa ISENTA de Imposto de Renda.',
    forWho: 'Quem pode deixar o dinheiro parado e quer fugir do IR.',
    pros: ['Isento de IR', 'Protegido pelo FGC', 'Rende líquido bem'],
    cons: ['Tem carência (baixa liquidez)', 'Aportes mínimos maiores'],
  },
  {
    key: 'tesouro_ipca',
    name: 'Tesouro IPCA+',
    emoji: '🛡️',
    color: '#6366f1',
    category: 'Renda fixa',
    risk: 2,
    liquidity: 'Diária (oscila até o vencimento)',
    potential: 'IPCA + ~6% a.a.',
    tagline: 'Protege seu dinheiro da inflação e ainda paga juro real.',
    forWho: 'Objetivos de longo prazo (aposentadoria, casa).',
    pros: ['Ganho acima da inflação garantido se levar ao vencimento', 'Seguro'],
    cons: ['Preço oscila se resgatar antes', 'IR regressivo'],
  },
  {
    key: 'fii',
    name: 'Fundos Imobiliários',
    emoji: '🏢',
    color: '#8b5cf6',
    category: 'Renda variável',
    risk: 3,
    liquidity: 'Diária (bolsa)',
    potential: 'Dividendos ~0,7%–1% a.m.',
    tagline: 'Seja "dono" de imóveis e receba aluguel todo mês.',
    forWho: 'Quem quer renda passiva mensal isenta de IR nos dividendos.',
    pros: ['Dividendos mensais isentos de IR', 'Diversifica em imóveis', 'Acessível'],
    cons: ['Cotas oscilam', 'Ganho de capital tem IR de 20%'],
  },
  {
    key: 'acoes',
    name: 'Ações',
    emoji: '📈',
    color: '#f59e0b',
    category: 'Renda variável',
    risk: 4,
    liquidity: 'Diária (bolsa)',
    potential: 'Histórico ~12%–15% a.a. (longo prazo)',
    tagline: 'Vire sócio das maiores empresas e cresça junto com elas.',
    forWho: 'Quem pensa no longo prazo e aguenta oscilação.',
    pros: ['Maior potencial de retorno', 'Dividendos', 'Vendas até R$20mil/mês isentas de IR'],
    cons: ['Volátil no curto prazo', 'Exige estudo'],
  },
  {
    key: 'etf',
    name: 'ETFs',
    emoji: '🧺',
    color: '#0ea5e9',
    category: 'Renda variável',
    risk: 3,
    liquidity: 'Diária (bolsa)',
    potential: 'Acompanha o índice (ex: Ibovespa, S&P 500)',
    tagline: 'Compre dezenas de empresas de uma vez, com 1 clique.',
    forWho: 'Quem quer diversificar sem escolher ação por ação.',
    pros: ['Diversificação instantânea', 'Custo baixo', 'Tem ETF global (ex: IVVB11)'],
    cons: ['Oscila com o mercado', 'IR de 15% no ganho'],
  },
  {
    key: 'dolar',
    name: 'Dólar / Internacional',
    emoji: '🌎',
    color: '#14b8a6',
    category: 'Internacional',
    risk: 3,
    liquidity: 'Diária',
    potential: 'Protege contra a desvalorização do real',
    tagline: 'Dolarize parte do patrimônio e pense global.',
    forWho: 'Quem quer proteção cambial e exposição a gigantes (Apple, Nvidia...).',
    pros: ['Protege contra crises locais', 'Acesso ao mercado dos EUA', 'Diversifica moeda'],
    cons: ['Risco cambial', 'Pode ter custos de remessa'],
  },
  {
    key: 'cripto',
    name: 'Criptomoedas',
    emoji: '₿',
    color: '#f7931a',
    category: 'Cripto',
    risk: 5,
    liquidity: 'Diária (24/7)',
    potential: 'Altíssimo — e altíssimo risco',
    tagline: 'A fronteira do dinheiro digital. Alto risco, alta emoção.',
    forWho: 'Quem entende o risco e investe só uma fatia pequena.',
    pros: ['Potencial de valorização enorme', 'Funciona 24/7', 'Descentralizado'],
    cons: ['Muito volátil', 'Sem garantia', 'Exige cautela e estudo'],
  },
  {
    key: 'poupanca',
    name: 'Poupança',
    emoji: '🐷',
    color: '#ec4899',
    category: 'Reserva',
    risk: 1,
    liquidity: 'Diária',
    potential: `~${POUPANCA_ANUAL.toFixed(1)}% a.a. (rende pouco)`,
    tagline: 'Todo mundo conhece — mas quase tudo rende mais que ela.',
    forWho: 'Só pra quem ainda não deu o primeiro passo. Dá pra fazer melhor!',
    pros: ['Isenta de IR', 'Liquidez diária', 'Simples'],
    cons: ['Rende muito pouco', 'Costuma perder pra inflação + CDI'],
  },
];
