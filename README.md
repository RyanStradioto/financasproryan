# 💰 Finanças Pro Ryan

Uma aplicação moderna e responsiva para gerenciamento de finanças pessoais, construída com React, TypeScript, Vite e Supabase.

## 🚀 Live Demo

**[Acesse a Aplicação →](https://financasproryan-gmh1q90yz-ryanstradiotos-projects.vercel.app)**

## 📚 Documentação

- **[📖 Guia de Recuperação de Dados](DATA_RECOVERY_GUIDE.md)** - Se seus dados desapareceram
- **[🔧 Troubleshooting](TROUBLESHOOTING.md)** - Problemas comuns e soluções
- **[✅ Verificação de Deployment](DEPLOYMENT_VERIFICATION.md)** - Status técnico da aplicação

## 🎯 Funcionalidades

### 💳 Gerenciamento de Transações
- ✅ Adicionar, editar e deletar despesas
- ✅ Adicionar, editar e deletar receitas
- ✅ Organizar por categorias personalizáveis
- ✅ Múltiplas contas bancárias/carteiras
- ✅ Status de transação (concluído, pendente, agendado)

### 📊 Análise Financeira
- ✅ Dashboard com resumo de gastos
- ✅ Gráficos de despesas por categoria
- ✅ Relatórios mensal/anual
- ✅ Orçamento por categoria
- ✅ Histórico de transações

### 🔐 Segurança
- ✅ Autenticação segura com Supabase
- ✅ Row Level Security (RLS) no banco de dados
- ✅ Dados criptografados
- ✅ Apenas você pode acessar seus dados

### 🎨 Interface
- ✅ Design responsivo (mobile, tablet, desktop)
- ✅ Tema claro/escuro
- ✅ Componentes modernos (Shadcn UI + Radix UI)
- ✅ Gráficos interativos (Recharts)

## 🛠️ Stack Tecnológico

| Tecnologia | Versão | Propósito |
|-----------|--------|----------|
| **React** | 18.x | UI Framework |
| **TypeScript** | Latest | Type Safety |
| **Vite** | 5.4.21 | Build Tool |
| **Tailwind CSS** | 3.x | Styling |
| **Supabase** | Latest | Backend & Database |
| **PostgreSQL** | 15+ | Database |
| **Vercel** | - | Hosting |

## 🚀 Como Iniciar (Desenvolvimento)

### Pré-requisitos
- Node.js 18.x ou superior
- npm 10.x ou superior
- Conta no Supabase

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/RyanStradioto/financasproryan.git
cd financasproryan

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais Supabase

# 4. Inicie servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:8080`

## 📋 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Build para produção
npm run preview      # Preview do build
npm run lint         # Verifica qualidade do código
npm run test         # Roda testes unitários
npm run test:watch   # Testes em modo watch
```

## 🗄️ Banco de Dados

### Tabelas
- `users` - Usuários autenticados (gerenciado por Supabase)
- `categories` - Categorias de despesas
- `accounts` - Contas bancárias/carteiras
- `income` - Receitas/Ganhos
- `expenses` - Despesas/Gastos
- `credit_cards` - Cartões de crédito
- `investments` - Investimentos

### Row Level Security (RLS)
Todas as tabelas possuem RLS ativado:
- Cada usuário vê apenas seus próprios dados
- Impossível acessar dados de outros usuários
- Proteção contra SQL injection

## 🔄 Como Restaurar Dados

Se seus dados foram perdidos, veja: **[DATA_RECOVERY_GUIDE.md](DATA_RECOVERY_GUIDE.md)**

Três opções:
1. **SQL Script** (Recomendado)
2. **Importar CSV**
3. **Inserir Manualmente**

## 🐛 Problemas?

Veja: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

Seções tratadas:
- ❌ Deployment has Failed
- ❌ No Production Deployment
- ❌ Aplicação não carrega
- ❌ Dados desapareceram
- ❌ Não consigo fazer login
- ❌ Outros erros

## 📊 Status de Produção

| Componente | Status |
|-----------|--------|
| Build | ✅ Sucesso |
| Testes | ✅ Passan |
| Deployments | ✅ Ativo |
| Supabase | ✅ Online |
| Performance | ✅ Otimizado |

## 🔗 Links Úteis

| Recurso | Link |
|---------|------|
| **Live App** | https://financasproryan-gmh1q90yz-ryanstradiotos-projects.vercel.app |
| **GitHub** | https://github.com/RyanStradioto/financasproryan |
| **Supabase** | https://eohnperxrykjzoofhfqu.supabase.co |
| **Vercel** | https://vercel.com/ryanstradiotos-projects/financasproryan |

## 📝 Licença

MIT - Sinta-se livre para usar e modificar

## 👤 Autor

Desenvolvido por [Ryan Stradioto](https://github.com/RyanStradioto)

---

**Última atualização**: 01 Apr 2026 | **Status**: ✅ Production Ready
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
