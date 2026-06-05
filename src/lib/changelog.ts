/**
 * Changelog do app — controla o modal "Novidades" que aparece ao abrir o app
 * depois de uma atualização.
 *
 * COMO ADICIONAR UMA NOVA ATUALIZAÇÃO:
 *   1. Adicione um novo objeto NO TOPO do array CHANGELOG.
 *   2. Use um `id` MAIOR que o anterior (sempre incremental).
 *   3. Pronto — usuários que ainda não viram esse id verão o modal uma vez.
 *
 * O modal nunca trava: qualquer forma de fechar (X, ESC, clique fora, botão)
 * marca o id como visto no localStorage e não reaparece para aquela versão.
 */

export type ChangelogItem = {
  icon: string;   // emoji
  title: string;
  desc: string;
};

export type ChangelogEntry = {
  id: number;       // incremental — o maior é o mais recente
  version: string;  // rótulo amigável (ex: "Junho 2026")
  date: string;     // YYYY-MM-DD
  items: ChangelogItem[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 2,
    version: 'Junho 2026',
    date: '2026-06-04',
    items: [
      {
        icon: '💬',
        title: 'Aba de Feedback & Sugestões',
        desc: 'Mandou um bug ou ideia? Agora você envia direto pelo app, indica em qual página deve entrar e acompanha o status — com a resposta de cada solicitação.',
      },
      {
        icon: '🗓️',
        title: 'Relatórios no seu horário',
        desc: 'Em Configurações → Notificações você escolhe os dias da semana e o horário do resumo semanal, e o dia do mês do relatório mensal.',
      },
      {
        icon: '🏦',
        title: 'Análise por conta',
        desc: 'Escolha de quais contas quer acompanhar e receba um e-mail individual com a análise detalhada de cada conta, além do consolidado.',
      },
    ],
  },
];

/** Maior id do changelog (a versão mais recente). */
export const LATEST_CHANGELOG_ID = CHANGELOG.reduce((max, e) => Math.max(max, e.id), 0);
