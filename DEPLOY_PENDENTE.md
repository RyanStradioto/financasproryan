# 🚀 Passos finais de deploy (Supabase)

O **front-end já está no ar** (Vercel faz deploy automático a cada push na `main`).
Os itens abaixo precisam ser feitos **uma vez** no seu projeto Supabase
(`gashcjenhwamgxrrmbsa`) — eles não saem no deploy do Vercel.

> ⚠️ Faça login na conta Supabase **dona deste projeto** (a pessoal, não a
> `biasiengenharia`). No terminal: `npx supabase login` e cole o token da conta
> certa, ou rode tudo pelo painel web do Supabase.

---

## 1) Aplicar as 3 migrations (SQL Editor do Supabase)

Abra **Supabase → SQL Editor** e cole o conteúdo de cada arquivo, na ordem:

| Ordem | Arquivo | O que faz |
|------|---------|-----------|
| 1 | `supabase/migrations/20260604120000_feedback.sql` | Cria a tabela **feedback** (necessária para a aba Feedback e a Central de Feedback do admin) |
| 2 | `supabase/migrations/20260604130000_email_schedule_prefs.sql` | Colunas de agendamento de e-mail em `profiles` (dias/horário/contas) |
| 3 | `supabase/migrations/20260604130100_email_cron_hourly.sql` | Faz o cron rodar **de hora em hora** (necessário pro horário/dia escolhido valer) |

> No arquivo **#3**, troque `{{CRON_SECRET}}` pelo mesmo valor que está salvo no
> secret `CRON_SECRET` (o mesmo usado pelos crons antigos).

Se preferir CLI (na conta certa): `npx supabase db push`.

---

## 2) Configurar os secrets

No painel: **Supabase → Project Settings → Edge Functions → Secrets**
(ou via CLI: `npx supabase secrets set NOME=valor`).

| Secret | Valor | Pra quê |
|--------|-------|---------|
| `RESEND_API_KEY` | *(sua chave Resend `re_...`)* | Envio de todos os e-mails (semanal + mensal) |
| `AI_API_KEY` | *(sua chave do Google Gemini)* | Insights IA + sugestão automática de categoria |
| `RESEND_FROM` *(opcional)* | `FinancasPro <seu@dominio.com>` | Remetente. Sem isso usa `onboarding@resend.dev` |

**Gerar a chave Gemini (grátis):** https://aistudio.google.com/app/apikey → "Create API key".
Opcionais de IA: `AI_BASE_URL` e `AI_MODEL` já têm padrão Gemini, não precisa mexer.

> 💡 **Resend em modo teste:** com `onboarding@resend.dev` o Resend só entrega
> para o e-mail dono da conta Resend. Para enviar pra qualquer endereço, verifique
> um domínio no Resend e defina `RESEND_FROM` com ele.

---

## 3) Fazer deploy das Edge Functions

Estas 4 funções mudaram e precisam ser republicadas (na conta Supabase certa):

```bash
npx supabase functions deploy weekly-summary
npx supabase functions deploy monthly-summary
npx supabase functions deploy financial-insights
npx supabase functions deploy suggest-category
```

(ou todas de uma vez: `npx supabase functions deploy`)

---

## ✅ Como testar

1. **E-mails:** App → **Configurações → Notificações**. Escolha dias/horário e as
   contas, clique **Salvar Configurações**, depois **Testar Resumo Semanal** e
   **Testar Relatório Mensal**. Você deve receber o consolidado **+ um e-mail por
   conta** (das contas selecionadas). O teste ignora o agendamento e envia na hora.
2. **Feedback:** App → **Feedback** → envie um item (toast "Enviado para análise ✅").
   Depois entre como Ryan em **Administração → Central de Feedback** e mude o status.
3. **IA:** App → **Insights IA**. Com `AI_API_KEY` configurada, os insights vêm da IA
   (`source: "ai"`); sem ela, caem no modo local automático (nada quebra).

---

## ℹ️ Observações

- **Sem aplicar nada**, o app continua funcionando: e-mails seguem no horário antigo
  (seg 9h / dia 1 9h) e a aba Feedback mostra lista vazia sem erro.
- O **horário/dia personalizado** só passa a valer depois da migration **#3** (cron
  de hora em hora). Antes disso, o padrão é seg 9h / dia 1 9h.
- **Lovable foi 100% removido** do projeto (build, AI gateway, lockfiles e README).
