# 📊 Guia de Recuperação de Dados - Financas Pro Ryan

## 🔍 O que aconteceu com seus dados?

Se você usava a aplicação antes e seus dados desapareceram, existem algumas causas possíveis:

1. **Data Reset no Supabase** - O projeto foi deletado e recriado
2. **Novo Login** - Cada usuário novo começa sem dados
3. **Cache Limpo** - localStorage foi deletado

---

## ✅ Opção 1: Restaurar via Supabase SQL (Recomendado)

### Passo 1: Obter seu User ID

1. Faça login em: https://financasproryan.vercel.app
2. Abra o navegador DevTools (F12)
3. No Console, execute:
```javascript
localStorage.getItem('supabase.auth.0')
// Procure por "profiles" e encontre seu user_id
```

Ou acesse: https://eohnperxrykjzoofhfqu.supabase.co
- Vá até: Authentication → Users
- Copie o ID do seu usuário

### Passo 2: Executar Script SQL

1. Acesse: https://eohnperxrykjzoofhfqu.supabase.co
2. SQL Editor → New Query
3. Copie o conteúdo do arquivo [supabase/migrations/20260401_seed_initial_data.sql](../supabase/migrations/20260401_seed_initial_data.sql)
4. Substitua `your-user-id-here` pelo seu ID real
5. Execute a query

**Exemplo com User ID real:**
```sql
INSERT INTO public.categories (user_id, name, icon, monthly_budget, color)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Alimentação', '🍔', 1000.00, '#ff6b6b'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Transporte', '🚗', 500.00, '#4ecdc4');
```

---

## ✅ Opção 2: Importar via Aplicação

1. Abra: https://financasproryan.vercel.app
2. Faça login
3. Vá para: **Importar** (Import)
4. Selecione um arquivo CSV com seus dados

**Formato esperado do CSV:**
```csv
data,descrição,valor,tipo,categoria,conta
2026-04-01,Supermercado,150.00,expense,Alimentação,Conta Corrente
2026-03-31,Salário,5000.00,income,Salário,Conta Corrente
```

---

## ✅ Opção 3: Inserir Manualmente

1. Abra: https://financasproryan.vercel.app
2. Faça login
3. Vá para: **Dashboard**
4. Use o formulário de **Nova Transação** para inserir cada item

---

## 📋 Dados Pré-carregados

Aqui estão algumas categorias e contas que você pode usar:

### 📁 Categorias Sugeridas
```
- 🍔 Alimentação (Orçamento: R$ 1.000)
- 🚗 Transporte (Orçamento: R$ 500)
- 💊 Saúde (Orçamento: R$ 300)
- 🎮 Lazer (Orçamento: R$ 200)
- 🏠 Casa (Orçamento: R$ 800)
- 💼 Trabalho (Orçamento: R$ 500)
- 📚 Educação (Orçamento: R$ 300)
```

### 🏦 Contas Sugeridas
```
- 🏦 Conta Corrente (Saldo: R$ 5.000)
- 💰 Poupança (Saldo: R$ 2.000)
- 💳 Cartão (Saldo: R$ 1.500)
- 💵 Carteira (Saldo: R$ 500)
```

---

## 🔐 Segurança e Privacidade

Todos os seus dados:
- ✅ São criptografados no Supabase
- ✅ Estão protegidos por Row Level Security (RLS)
- ✅ Só você pode acessar seus dados
- ✅ Nunca são compartilhados com terceiros

---

## 🆘 Problemas Frequentes

### F.A.Q

**P: Fiz login mas não vejo meus dados**
R: Use a Opção 1 (SQL) ou Opção 2 (Importar) acima para restaurar.

**P: Não consigo fazer login**
R: Verifique se seu email está confirmado no Supabase:
1. Vá a: https://eohnperxrykjzoofhfqu.supabase.co
2. Authentication → Users
3. Procure por seu email
4. Se "email_confirmed_at" está vazio, confirme seu email

**P: Tenho um backup dos dados em Excel/CSV**
R: Use a Opção 2 (Importar) - a aplicação aceita CSV!

**P: Ainda não funciona**
R: Vá para Help → Contact Support ou deixe uma issue no GitHub

---

## 🚀 Próximos Passos

1. ✅ Acesse: https://financasproryan.vercel.app
2. ✅ Faça login na sua conta
3. ✅ Restaure seus dados usando uma das opções acima
4. ✅ Comece a gerenciar suas finanças!

---

## 📞 Suporte

| Canal | Link |
|-------|------|
| **GitHub Issues** | https://github.com/RyanStradioto/financasproryan/issues |
| **Supabase Console** | https://eohnperxrykjzoofhfqu.supabase.co |
| **Vercel Dashboard** | https://vercel.com/ryanstradiotos-projects/financasproryan |

---

*Última atualização: 01 Apr 2026*
