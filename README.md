# ðŸ’° FinanÃ§as Pro Ryan

Uma aplicaÃ§Ã£o moderna e responsiva para gerenciamento de finanÃ§as pessoais, construÃ­da com React, TypeScript, Vite e Supabase.

## ðŸš€ Live Demo

**[Acesse a AplicaÃ§Ã£o â†’](https://financasproryan-gmh1q90yz-ryanstradiotos-projects.vercel.app)**

## ðŸ“š DocumentaÃ§Ã£o

- **[ðŸ“– Guia de RecuperaÃ§Ã£o de Dados](DATA_RECOVERY_GUIDE.md)** - Se seus dados desapareceram
- **[ðŸ”§ Troubleshooting](TROUBLESHOOTING.md)** - Problemas comuns e soluÃ§Ãµes
- **[âœ… VerificaÃ§Ã£o de Deployment](DEPLOYMENT_VERIFICATION.md)** - Status tÃ©cnico da aplicaÃ§Ã£o

## ðŸŽ¯ Funcionalidades

### ðŸ’³ Gerenciamento de TransaÃ§Ãµes
- âœ… Adicionar, editar e deletar despesas
- âœ… Adicionar, editar e deletar receitas
- âœ… Organizar por categorias personalizÃ¡veis
- âœ… MÃºltiplas contas bancÃ¡rias/carteiras
- âœ… Status de transaÃ§Ã£o (concluÃ­do, pendente, agendado)

### ðŸ“Š AnÃ¡lise Financeira
- âœ… Dashboard com resumo de gastos
- âœ… GrÃ¡ficos de despesas por categoria
- âœ… RelatÃ³rios mensal/anual
- âœ… OrÃ§amento por categoria
- âœ… HistÃ³rico de transaÃ§Ãµes

### ðŸ” SeguranÃ§a
- âœ… AutenticaÃ§Ã£o segura com Supabase
- âœ… Row Level Security (RLS) no banco de dados
- âœ… Dados criptografados
- âœ… Apenas vocÃª pode acessar seus dados

### ðŸŽ¨ Interface
- âœ… Design responsivo (mobile, tablet, desktop)
- âœ… Tema claro/escuro
- âœ… Componentes modernos (Shadcn UI + Radix UI)
- âœ… GrÃ¡ficos interativos (Recharts)

## ðŸ› ï¸ Stack TecnolÃ³gico

| Tecnologia | VersÃ£o | PropÃ³sito |
|-----------|--------|----------|
| **React** | 18.x | UI Framework |
| **TypeScript** | Latest | Type Safety |
| **Vite** | 5.4.21 | Build Tool |
| **Tailwind CSS** | 3.x | Styling |
| **Supabase** | Latest | Backend & Database |
| **PostgreSQL** | 15+ | Database |
| **Vercel** | - | Hosting |

## ðŸš€ Como Iniciar (Desenvolvimento)

### PrÃ©-requisitos
- Node.js 18.x ou superior
- npm 10.x ou superior
- Conta no Supabase

### InstalaÃ§Ã£o

```bash
# 1. Clone o repositÃ³rio
git clone https://github.com/RyanStradioto/financasproryan.git
cd financasproryan

# 2. Instale dependÃªncias
npm install

# 3. Configure variÃ¡veis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# 4. Inicie servidor de desenvolvimento
npm run dev
```

A aplicaÃ§Ã£o estarÃ¡ disponÃ­vel em `http://localhost:8080`

## ðŸ“‹ Scripts DisponÃ­veis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produÃ§Ã£o
npm run preview      # Preview do build
npm run lint         # Verifica qualidade do cÃ³digo
npm run test         # Roda testes unitÃ¡rios
npm run test:watch   # Testes em modo watch
```

## ðŸ—„ï¸ Banco de Dados

### Tabelas
- `users` - UsuÃ¡rios autenticados (gerenciado por Supabase)
- `categories` - Categorias de despesas
- `accounts` - Contas bancÃ¡rias/carteiras
- `income` - Receitas/Ganhos
- `expenses` - Despesas/Gastos
- `credit_cards` - CartÃµes de crÃ©dito
- `investments` - Investimentos

### Row Level Security (RLS)
Todas as tabelas possuem RLS ativado:
- Cada usuÃ¡rio vÃª apenas seus prÃ³prios dados
- ImpossÃ­vel acessar dados de outros usuÃ¡rios
- ProteÃ§Ã£o contra SQL injection

## ðŸ”„ Como Restaurar Dados

Se seus dados foram perdidos, veja: **[DATA_RECOVERY_GUIDE.md](DATA_RECOVERY_GUIDE.md)**

TrÃªs opÃ§Ãµes:
1. **SQL Script** (Recomendado)
2. **Importar CSV**
3. **Inserir Manualmente**

## ðŸ› Problemas?

Veja: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

SeÃ§Ãµes tratadas:
- âŒ Deployment has Failed
- âŒ No Production Deployment
- âŒ AplicaÃ§Ã£o nÃ£o carrega
- âŒ Dados desapareceram
- âŒ NÃ£o consigo fazer login
- âŒ Outros erros

## ðŸ“Š Status de ProduÃ§Ã£o

| Componente | Status |
|-----------|--------|
| Build | âœ… Sucesso |
| Testes | âœ… Passan |
| Deployments | âœ… Ativo |
| Supabase | âœ… Online |
| Performance | âœ… Otimizado |

## ðŸ”— Links Ãšteis

| Recurso | Link |
|---------|------|
| **Live App** | https://financasproryan-gmh1q90yz-ryanstradiotos-projects.vercel.app |
| **GitHub** | https://github.com/RyanStradioto/financasproryan |
| **Supabase** | https://gashcjenhwamgxrrmbsa.supabase.co |
| **Vercel** | https://vercel.com/ryanstradiotos-projects/financasproryan |

## ðŸ“ LicenÃ§a

MIT - Sinta-se livre para usar e modificar

## ðŸ‘¤ Autor

Desenvolvido por [Ryan Stradioto](https://github.com/RyanStradioto)

---

**Ãšltima atualizaÃ§Ã£o**: 01 Apr 2026 | **Status**: âœ… Production Ready
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

