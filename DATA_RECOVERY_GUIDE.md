# ðŸ“Š Guia de RecuperaÃ§Ã£o de Dados - Financas Pro Ryan

## ðŸ” O que aconteceu com seus dados?

Se vocÃª usava a aplicaÃ§Ã£o antes e seus dados desapareceram, existem algumas causas possÃ­veis:

1. **Data Reset no Supabase** - O projeto foi deletado e recriado
2. **Novo Login** - Cada usuÃ¡rio novo comeÃ§a sem dados
3. **Cache Limpo** - localStorage foi deletado

---

## âœ… OpÃ§Ã£o 1: Restaurar via Supabase SQL (Recomendado)

### Passo 1: Obter seu User ID

1. FaÃ§a login em: https://financasproryan.vercel.app
2. Abra o navegador DevTools (F12)
3. No Console, execute:
```javascript
localStorage.getItem('supabase.auth.0')
// Procure por "profiles" e encontre seu user_id
```

Ou acesse: https://gashcjenhwamgxrrmbsa.supabase.co
- VÃ¡ atÃ©: Authentication â†’ Users
- Copie o ID do seu usuÃ¡rio

### Passo 2: Executar Script SQL

1. Acesse: https://gashcjenhwamgxrrmbsa.supabase.co
2. SQL Editor â†’ New Query
3. Copie o conteÃºdo do arquivo [supabase/migrations/20260401_seed_initial_data.sql](../supabase/migrations/20260401_seed_initial_data.sql)
4. Substitua `your-user-id-here` pelo seu ID real
5. Execute a query

**Exemplo com User ID real:**
```sql
INSERT INTO public.categories (user_id, name, icon, monthly_budget, color)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'AlimentaÃ§Ã£o', 'ðŸ”', 1000.00, '#ff6b6b'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Transporte', 'ðŸš—', 500.00, '#4ecdc4');
```

---

## âœ… OpÃ§Ã£o 2: Importar via AplicaÃ§Ã£o

1. Abra: https://financasproryan.vercel.app
2. FaÃ§a login
3. VÃ¡ para: **Importar** (Import)
4. Selecione um arquivo CSV com seus dados

**Formato esperado do CSV:**
```csv
data,descriÃ§Ã£o,valor,tipo,categoria,conta
2026-04-01,Supermercado,150.00,expense,AlimentaÃ§Ã£o,Conta Corrente
2026-03-31,SalÃ¡rio,5000.00,income,SalÃ¡rio,Conta Corrente
```

---

## âœ… OpÃ§Ã£o 3: Inserir Manualmente

1. Abra: https://financasproryan.vercel.app
2. FaÃ§a login
3. VÃ¡ para: **Dashboard**
4. Use o formulÃ¡rio de **Nova TransaÃ§Ã£o** para inserir cada item

---

## ðŸ“‹ Dados PrÃ©-carregados

Aqui estÃ£o algumas categorias e contas que vocÃª pode usar:

### ðŸ“ Categorias Sugeridas
```
- ðŸ” AlimentaÃ§Ã£o (OrÃ§amento: R$ 1.000)
- ðŸš— Transporte (OrÃ§amento: R$ 500)
- ðŸ’Š SaÃºde (OrÃ§amento: R$ 300)
- ðŸŽ® Lazer (OrÃ§amento: R$ 200)
- ðŸ  Casa (OrÃ§amento: R$ 800)
- ðŸ’¼ Trabalho (OrÃ§amento: R$ 500)
- ðŸ“š EducaÃ§Ã£o (OrÃ§amento: R$ 300)
```

### ðŸ¦ Contas Sugeridas
```
- ðŸ¦ Conta Corrente (Saldo: R$ 5.000)
- ðŸ’° PoupanÃ§a (Saldo: R$ 2.000)
- ðŸ’³ CartÃ£o (Saldo: R$ 1.500)
- ðŸ’µ Carteira (Saldo: R$ 500)
```

---

## ðŸ” SeguranÃ§a e Privacidade

Todos os seus dados:
- âœ… SÃ£o criptografados no Supabase
- âœ… EstÃ£o protegidos por Row Level Security (RLS)
- âœ… SÃ³ vocÃª pode acessar seus dados
- âœ… Nunca sÃ£o compartilhados com terceiros

---

## ðŸ†˜ Problemas Frequentes

### F.A.Q

**P: Fiz login mas nÃ£o vejo meus dados**
R: Use a OpÃ§Ã£o 1 (SQL) ou OpÃ§Ã£o 2 (Importar) acima para restaurar.

**P: NÃ£o consigo fazer login**
R: Verifique se seu email estÃ¡ confirmado no Supabase:
1. VÃ¡ a: https://gashcjenhwamgxrrmbsa.supabase.co
2. Authentication â†’ Users
3. Procure por seu email
4. Se "email_confirmed_at" estÃ¡ vazio, confirme seu email

**P: Tenho um backup dos dados em Excel/CSV**
R: Use a OpÃ§Ã£o 2 (Importar) - a aplicaÃ§Ã£o aceita CSV!

**P: Ainda nÃ£o funciona**
R: VÃ¡ para Help â†’ Contact Support ou deixe uma issue no GitHub

---

## ðŸš€ PrÃ³ximos Passos

1. âœ… Acesse: https://financasproryan.vercel.app
2. âœ… FaÃ§a login na sua conta
3. âœ… Restaure seus dados usando uma das opÃ§Ãµes acima
4. âœ… Comece a gerenciar suas finanÃ§as!

---

## ðŸ“ž Suporte

| Canal | Link |
|-------|------|
| **GitHub Issues** | https://github.com/RyanStradioto/financasproryan/issues |
| **Supabase Console** | https://gashcjenhwamgxrrmbsa.supabase.co |
| **Vercel Dashboard** | https://vercel.com/ryanstradiotos-projects/financasproryan |

---

*Ãšltima atualizaÃ§Ã£o: 01 Apr 2026*

