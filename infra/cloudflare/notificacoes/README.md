# Notificações da homologação no Cloudflare Workers

O Worker `wg-hidraulica-tcc-notificacoes-teste` executa `scheduled` a cada cinco minutos e usa somente `https://zutnvrnsahmwuvlhhcuy.supabase.co`. Ele tem configuração própria, com `workers.dev` e previews desativados. O site `wg-hidraulica-tcc-teste` continua independente. As migrações da fila já aplicadas no banco de teste fornecem todas as RPCs necessárias.

## Validação local

Na raiz do repositório, com as dependências instaladas:

```powershell
node --test tests/notificacoes-worker.test.mjs tests/notificacoes-n8n.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js infra/cloudflare/notificacoes/worker.ts tests/notificacoes-worker.test.mjs

$wrangler = (Resolve-Path -LiteralPath 'node_modules/wrangler/bin/wrangler.js').Path
$cronConfig = 'infra/cloudflare/notificacoes/wrangler.jsonc'
$bootstrapConfig = 'infra/cloudflare/notificacoes/wrangler.bootstrap.jsonc'
$env:WRANGLER_SEND_METRICS = 'false'
$env:CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
node $wrangler deploy --dry-run --config $cronConfig --outdir output/notificacoes-worker/dry-run
```

Interrompa se algum comando falhar. Os testes simulam as duas APIs sem ler configurações reais. Um lote cheio usa uma chamada de reserva, dez de envio e dez de conclusão. Com timeout de cinco segundos por chamada, o pior caso nominal de espera de rede é inferior ao intervalo do cron. Cada envio exige folga antes do fim da reserva. O plano Free permite 50 subrequisições e 10 ms de CPU por execução agendada. Confirme o tempo de CPU nas métricas hospedadas com payloads representativos, incluindo um lote cheio. [Limites do Workers](https://developers.cloudflare.com/workers/platform/limits/)

## Inspeção antes de qualquer envio real

Abra o SQL Editor do projeto de testes `zutnvrnsahmwuvlhhcuy`. A consulta abaixo lista os destinos e a elegibilidade sem expor assunto, descrição, conteúdo do e-mail ou chaves. Se `remetente_persistido` e `destinatarios_persistidos` estiverem vazios porque o payload ainda é nulo, a primeira reserva usará os valores configurados no Worker. Confira separadamente se a solicitação contém apenas dados fictícios.

```sql
begin read only;

select n.solicitacao_id, n.estado, n.tentativas,
       n.proxima_tentativa_em, n.primeira_tentativa_em, n.reservada_ate,
       n.resultado_incerto, n.ultimo_erro, n.resend_id,
       n.payload ->> 'from' as remetente_persistido,
       n.payload -> 'to' as destinatarios_persistidos,
       n.payload is null as usa_destino_do_worker,
       coalesce(
         n.estado in ('pendente', 'falhou')
         and n.proxima_tentativa_em <= now()
         and n.tentativas < 3
         and (n.primeira_tentativa_em is null or n.primeira_tentativa_em > now() - interval '23 hours'),
         false
       ) as elegivel_agora
from private.notificacoes_solicitacao n
where n.estado in ('pendente', 'falhou', 'revisao', 'processando')
order by n.criado_em, n.solicitacao_id;

commit;
```

Confirme que não há outro consumidor ativo para **a fila de testes**. Se uma linha já tiver payload, confira remetente, destino e conta Resend usados anteriormente. A chave de idempotência deve ser reutilizada com o mesmo payload e na mesma conta Resend. Se a conta anterior for desconhecida ou o resultado for incerto, confira primeiro o envio no provedor. O Worker rejeita payloads de outro destinatário e nunca reescreve o destino. [Idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Publicação futura, somente com autorização

Confirme a conta Cloudflare e o destino dos comandos. Use uma chave Resend com permissão de envio de uma conta ou equipe exclusiva de homologação. Com o remetente de teste `onboarding@resend.dev`, o Gmail deve ser o endereço da conta Resend. Para enviar a outro endereço, selecione um remetente de domínio verificado. O Free inclui 100 e-mails por dia e 3.000 por mês. Chaves distintas na mesma equipe compartilham cotas e rate limit. [Erros de envio do Resend](https://resend.com/docs/api-reference/errors), [cotas do Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits)

1. Crie o Worker de notificações **sem cron**, usando a configuração de bootstrap. Os comandos abaixo pressupõem as variáveis PowerShell da seção de validação.

   ```powershell
   $worker = 'wg-hidraulica-tcc-notificacoes-teste'
   node $wrangler whoami
   if ($LASTEXITCODE -ne 0) { throw 'Conta Cloudflare não verificada.' }
   node $wrangler deploy --config $bootstrapConfig --name $worker
   if ($LASTEXITCODE -ne 0) { throw 'Bootstrap falhou. Interrompa a publicação.' }
   ```

2. Preencha os valores nos prompts, sem salvar arquivos de credenciais. `SUPABASE_DASHBOARD_SECRET` é a chave administrativa **do Supabase de homologação**, pois as RPCs existentes validam sua `p_chave`. Ela também autoriza as RPCs do painel do banco de teste. A publishable key precisa pertencer ao mesmo projeto e ter prefixo `sb_publishable_`. O destinatário é exatamente um Gmail autorizado. Mantenha os bindings restritos ao Worker de notificações.

   ```powershell
   $nomes = @('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_DASHBOARD_SECRET', 'RESEND_API_KEY', 'WG_NOTIFICACAO_REMETENTE', 'WG_NOTIFICACAO_DESTINATARIO')
   foreach ($nome in $nomes) {
       node $wrangler secret put $nome --config $bootstrapConfig --name $worker
       if ($LASTEXITCODE -ne 0) { throw "Falha ao cadastrar $nome." }
   }
   node $wrangler secret list --config $bootstrapConfig --name $worker
   ```

3. Confira a consulta de leitura acima, a autorização do Gmail e o saldo do Resend. O comando a seguir publica o Worker de notificações e **ativa o cron**. Aguarde a propagação do gatilho. Depois do primeiro ciclo, confira `enviado`, `resend_id` e a chegada no Gmail. Confira o ciclo seguinte para verificar que o item aceito não voltou a ser enviado. [Propagação do cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

   ```powershell
   node $wrangler deploy --config $cronConfig --name $worker
   if ($LASTEXITCODE -ne 0) { throw 'Publicação do cron falhou.' }
   ```

## Pausa e reprocessamento

Para pausar em uma operação autorizada, publique com `$bootstrapConfig`, que declara a lista de crons vazia. Considere o tempo de propagação e as execuções já iniciadas. Preserve a fila, seus tokens de reserva e as chaves de idempotência.

O banco decide as próximas tentativas. A política atual faz até três tentativas automáticas por ciclo e limita resultados incertos à janela de 23 horas. Se o Resend aceitar e o registro da conclusão falhar, o ciclo seguinte recupera a reserva expirada e usa a mesma chave. `enviado` indica aceite pelo Resend. Rejeições definitivas, incluindo códigos reconhecidos de cota esgotada, exigem correção da causa e revisão antes de reagendar. Use o guia da fila para reprocessamento manual e nunca gere uma chave nova para um resultado incerto. O Worker registra apenas contagens e códigos operacionais.
