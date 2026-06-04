# ✅ Deploy aplicado

Tudo abaixo **já foi aplicado** no projeto Supabase `gashcjenhwamgxrrmbsa`
em 04/06/2026 (via token de acesso). Nada pendente do seu lado — exceto o
item opcional de IA no final.

## O que foi feito

| Item | Status |
|------|--------|
| Tabela **feedback** (+ RLS + índices + trigger) | ✅ criada e visível na API REST |
| Colunas de agendamento em `profiles` (`email_weekly_days`, `email_monthly_day`, `email_hour`, `email_per_account_enabled`, `email_account_ids`) | ✅ criadas |
| Secret `BREVO_API_KEY` (provedor de e-mail real) | ✅ configurado |
| Edge function `weekly-summary` (Brevo + por conta + agendamento) | ✅ deployada |
| Edge function `monthly-summary` (Brevo + por conta + agendamento) | ✅ deployada |
| Edge function `financial-insights` (sem Lovable) | ✅ deployada |
| Edge function `suggest-category` (sem Lovable) | ✅ deployada |
| Cron semanal + mensal → **de hora em hora** (a função filtra dia/horário) | ✅ ajustado |
| Schema cache do PostgREST recarregado | ✅ feito |
| Painel de admin liberado para `amaralstradiotoryan@gmail.com` (app + RLS) | ✅ feito |
| E-mail de novidades enviado para **todos os 7 usuários** (via Brevo) | ✅ enviado |

O erro **"Could not find the table 'public.feedback'"** está resolvido —
`GET /rest/v1/feedback` agora responde `200`.

> **E-mail via Brevo:** o remetente verificado é `amaralstradiotoryan@gmail.com` e o
> envio alcança **todos** os usuários. O plano gratuito do Brevo permite ~300 e-mails/dia
> — suficiente para os resumos. Para trocar o remetente, defina os secrets
> `BREVO_SENDER_NAME` / `BREVO_SENDER_EMAIL` (precisa ser um sender verificado no Brevo).

## ✅ Como testar

1. **Feedback:** App → **Feedback** → envie um item (toast "Enviado para análise ✅").
   Como Ryan: **Administração → Central de Feedback** para mudar status/responder.
2. **E-mails:** **Configurações → Notificações** → escolha dias/horário/contas →
   **Salvar** → **Testar Resumo Semanal** e **Testar Relatório Mensal**. Deve chegar
   o consolidado **+ um e-mail por conta** selecionada. (O teste envia na hora,
   ignorando o agendamento.)
3. **Agendamento automático:** já ativo. Cada e-mail sai no dia/horário escolhido
   (padrão: semanal seg 9h, mensal dia 1 9h, fuso de Brasília).

---

## ⏳ Único item opcional pendente: chave de IA (Google Gemini)

As features **Insights IA** e **sugestão automática de categoria** foram migradas
para fora da Lovable. Sem chave, elas **não quebram** — os Insights caem no modo
local (cálculos do próprio app) e a sugestão de categoria fica desativada.

Para ligar a IA de verdade:
1. Gere uma chave grátis em **https://aistudio.google.com/app/apikey**.
2. Me mande a chave (ou defina o secret `AI_API_KEY` no Supabase).

Pronto — não precisa mexer em mais nada. `AI_BASE_URL`/`AI_MODEL` já têm padrão Gemini.
