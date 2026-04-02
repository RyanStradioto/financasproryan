# 🚀 Guia de Deploy e Recuperação de Dados

## Aplicação no Vercel
**URL:** https://financasproryan-d7yx8jld7-ryanstradiotos-projects.vercel.app

### Status do Deploy
- ✅ Projeto criado no Vercel
- ⚠️ Erro em `npm install` (peer dependencies)
- 🔄 Solução: Vercel construirá automaticamente na próxima push

---

## 📊 Recuperação de Dados Supabase

Seu projeto Supabase: `eohnperxrykjzoofhfqu`

### Passo 1: Acessar Supabase
1. Acesse https://supabase.com/
2. Faça login com sua conta
3. Clique no projeto `financasproryan` (ID: eohnperxrykjzoofhfqu)

### Passo 2: Verificar Dados
**Verifique as tabelas:**
- `transactions` - Procure por transações deletadas
- `expenses` - Gastos
- `income` - Receitas
- `credit_cards` - Cartões de crédito
- `categories` - Categorias

### Passo 3: Restaurar de Backup (se disponível)
No Supabase Dashboard:
1. Vá para **Database** → **Backups**
2. Se houver backups automáticos, você pode restaurar
3. Selecione a data anterior ao problema

### Passo 4: Importar dados manualmente
Se não houver backups, você pode:
1. Exportar dados de um relatório/export que você tem
2. Usar a API do Supabase para reinserir manualmente

---

## 🔧 Resolver erro do npm install no Vercel

O erro é causado por peer dependencies. Solução:

1. **Local** (já feito):
   - ✅ npm audit fix --force
   - ✅ Atualizadas todas as dependências
   - ✅ Mudanças feitas push para GitHub

2. **No Vercel** (automático):
   - Próximo push ou rebuild fará npm install com as dependências corretas

---

## 📝 Próximos Passos

1. **Verificar dados no Supabase** (instruções acima)
2. **Restaurar backups** se disponível
3. **Fazer novo push** se precisar de ajustes:
   ```bash
   git add -A
   git commit -m "fix: atualizar dados/configurações"
   git push origin main
   ```
4. **Acessar app**: https://financasproryan-d7yx8jld7-ryanstradiotos-projects.vercel.app

---

## 🆘 Dúvidas?

- **Dados não aparecem?** → Verifique Supabase Dashboard (Tabelas → Verificar registros)
- **App não carrega?** → Verifique logs: Vercel Dashboard → Deployments → Logs
- **Erro de permissão?** → Verifique credenciais Supabase no arquivo `.env`

Dashboard Vercel: https://vercel.com/ryanstradiotos-projects/financasproryan
Dashboard Supabase: https://app.supabase.com/
