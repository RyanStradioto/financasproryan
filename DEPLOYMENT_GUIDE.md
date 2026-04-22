# ðŸš€ Guia de Deploy e RecuperaÃ§Ã£o de Dados

## AplicaÃ§Ã£o no Vercel
**URL:** https://financasproryan-d7yx8jld7-ryanstradiotos-projects.vercel.app

### Status do Deploy
- âœ… Projeto criado no Vercel
- âš ï¸ Erro em `npm install` (peer dependencies)
- ðŸ”„ SoluÃ§Ã£o: Vercel construirÃ¡ automaticamente na prÃ³xima push

---

## ðŸ“Š RecuperaÃ§Ã£o de Dados Supabase

Seu projeto Supabase: `gashcjenhwamgxrrmbsa`

### Passo 1: Acessar Supabase
1. Acesse https://supabase.com/
2. FaÃ§a login com sua conta
3. Clique no projeto `financasproryan` (ID: gashcjenhwamgxrrmbsa)

### Passo 2: Verificar Dados
**Verifique as tabelas:**
- `transactions` - Procure por transaÃ§Ãµes deletadas
- `expenses` - Gastos
- `income` - Receitas
- `credit_cards` - CartÃµes de crÃ©dito
- `categories` - Categorias

### Passo 3: Restaurar de Backup (se disponÃ­vel)
No Supabase Dashboard:
1. VÃ¡ para **Database** â†’ **Backups**
2. Se houver backups automÃ¡ticos, vocÃª pode restaurar
3. Selecione a data anterior ao problema

### Passo 4: Importar dados manualmente
Se nÃ£o houver backups, vocÃª pode:
1. Exportar dados de um relatÃ³rio/export que vocÃª tem
2. Usar a API do Supabase para reinserir manualmente

---

## ðŸ”§ Resolver erro do npm install no Vercel

O erro Ã© causado por peer dependencies. SoluÃ§Ã£o:

1. **Local** (jÃ¡ feito):
   - âœ… npm audit fix --force
   - âœ… Atualizadas todas as dependÃªncias
   - âœ… MudanÃ§as feitas push para GitHub

2. **No Vercel** (automÃ¡tico):
   - PrÃ³ximo push ou rebuild farÃ¡ npm install com as dependÃªncias corretas

---

## ðŸ“ PrÃ³ximos Passos

1. **Verificar dados no Supabase** (instruÃ§Ãµes acima)
2. **Restaurar backups** se disponÃ­vel
3. **Fazer novo push** se precisar de ajustes:
   ```bash
   git add -A
   git commit -m "fix: atualizar dados/configuraÃ§Ãµes"
   git push origin main
   ```
4. **Acessar app**: https://financasproryan-d7yx8jld7-ryanstradiotos-projects.vercel.app

---

## ðŸ†˜ DÃºvidas?

- **Dados nÃ£o aparecem?** â†’ Verifique Supabase Dashboard (Tabelas â†’ Verificar registros)
- **App nÃ£o carrega?** â†’ Verifique logs: Vercel Dashboard â†’ Deployments â†’ Logs
- **Erro de permissÃ£o?** â†’ Verifique credenciais Supabase no arquivo `.env`

Dashboard Vercel: https://vercel.com/ryanstradiotos-projects/financasproryan
Dashboard Supabase: https://app.supabase.com/

