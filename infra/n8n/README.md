# n8n local

O n8n executa em um contêiner Docker separado da aplicação web. Ele será
responsável pelas automações do atendimento, enquanto o Supabase continua
sendo a fonte oficial dos dados comerciais.

## Iniciar

Na raiz do projeto, execute:

```powershell
pnpm run n8n:up
```

Depois, abra `http://localhost:5678` e crie o usuário administrador solicitado
pelo n8n. Esse cadastro existe somente na instalação local.

## Comandos

```powershell
pnpm run n8n:up     # baixa a imagem e inicia o n8n
pnpm run n8n:logs   # mostra os registros de execução
pnpm run n8n:stop   # interrompe o n8n sem apagar os dados
pnpm run n8n:down   # remove o contêiner sem apagar os dados persistidos
```

Os dados ficam em `D:\Docker\n8n-data`. A pasta não deve ser colocada no Git,
pois pode conter credenciais usadas pelas automações.

## Papel na arquitetura

1. o site registra a solicitação no Supabase;
2. o banco cria uma entrada na fila privada na mesma transação;
3. o n8n reserva até dez notificações a cada cinco minutos, ou por acionamento manual;
4. o Resend recebe o e-mail, e o n8n registra o resultado na fila.

### Notificações de novas solicitações

O arquivo `workflows/nova-solicitacao.json` usa as RPCs de reserva e conclusão
da migração `202609010007_fila_notificacoes_solicitacao.sql`. A reserva impede
que duas execuções escolham a mesma notificação. Um resultado só altera a fila
quando pertence à reserva atual. O status da solicitação e o histórico comercial
permanecem a cargo do fluxo de atendimento.

Respostas temporárias e incertas podem gerar até três tentativas automáticas.
A nova tentativa fica disponível após cinco minutos. Se uma execução parar
sem gravar o resultado, a reserva expira em até dez minutos e a fila trata o
resultado como incerto. O banco reutiliza o conteúdo e a chave de idempotência
nas tentativas do mesmo ciclo. Como o [Resend retém a chave por 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys),
a fila limita o reenvio automático a 23 horas a partir da primeira reserva.
O estado `enviado` indica aceite pelo Resend e armazena o identificador do e-mail.
A confirmação de entrega na caixa de entrada deve ser consultada no provedor.

### Troca do workflow

1. Em homologação, desative o fluxo anterior e aguarde suas execuções em curso.
2. Aplique as migrações pendentes até a `202609010007`. A fila começa com solicitações inseridas após a migração. Revise o histórico e o Resend antes de enfileirar manualmente alguma solicitação anterior.
3. Configure `WG_NOTIFICACAO_REMETENTE` e `WG_NOTIFICACAO_DESTINATARIO` no `.env.local` da aplicação. O Compose carrega os endereços pelo `env_file` do serviço. O `--env-file` dos scripts fornece apenas os valores usados para interpolar o Compose, como `N8N_DATA_PATH`. Recrie somente o contêiner de homologação para carregar a configuração.
4. Importe o workflow canônico e associe a credencial do Resend ao nó de e-mail. Se a interface exigir um objeto JSON em vez do array canônico, extraia o primeiro elemento para a cópia local `nova-solicitacao-importar.json`, em UTF-8 sem BOM. Essa cópia é ignorada pelo Git.
5. Com o fluxo inativo, cadastre uma solicitação fictícia e execute pelo gatilho manual. Confira o e-mail, o registro na fila e o status comercial. Execute de novo e confirme que não houve outro envio. Publique após a validação.

### Consultar e reprocessar

Use o SQL Editor com acesso administrativo. A consulta omite o conteúdo do e-mail.

```sql
select solicitacao_id, estado, tentativas, ultimo_erro, proxima_tentativa_em,
       primeira_tentativa_em, resend_id, enviado_em
from private.notificacoes_solicitacao
order by criado_em desc;
```

Após corrigir a configuração ou investigar a falha, reagende pelo identificador
da solicitação e inicie pelo gatilho. Retomar um nó isolado pode reutilizar dados
antigos da execução.

```sql
select private.reprocessar_notificacao_solicitacao('<uuid-da-solicitacao>');
```

O resultado `true` confirma o reagendamento. Uma rejeição confirmada inicia
novo ciclo com a configuração atual. Um resultado incerto dentro de 23 horas
reutiliza a mesma chave e o mesmo conteúdo. Use a mesma conta Resend durante
esse ciclo. Após o prazo, confira o resultado no Resend pela referência da
solicitação e resolva manualmente. A função recusa reenvio incerto fora da janela,
além de notificações já aceitas ou em processamento.

Para uma solicitação anterior à migração, enfileire pelo UUID apenas depois de
confirmar que ela precisa ser notificada.

```sql
insert into private.notificacoes_solicitacao (solicitacao_id)
values ('<uuid-revisado>') on conflict (solicitacao_id) do nothing;
```

Os testes SQL em `tests/sql` podem ser executados com `psql -v ON_ERROR_STOP=1 -f <arquivo>`.
O teste de concorrência usa `dblink` e requer o banco local descartável
`wg_notificacoes_test`, com as migrações aplicadas, fila e configuração vazias,
e acesso do administrador local pelas duas conexões de teste.

### Chatbot com Gemini

O arquivo `workflows/chatbot-gemini.json` recebe as mensagens técnicas do site
em `POST /webhook/wg-hidraulica-chatbot`, consulta o modelo definido em
`GEMINI_CHATBOT_MODEL` e devolve um objeto validado ao site. O fluxo não recebe
nome, telefone, empresa ou e-mail. Para ativá-lo, configure em `.env.local`:

```env
GEMINI_API_KEY=sua_chave_do_google_ai_studio
GEMINI_CHATBOT_MODEL=gemini-3.5-flash-lite
CHATBOT_N8N_WEBHOOK_URL=http://localhost:5678/webhook/wg-hidraulica-chatbot
CHATBOT_AI_ENABLED=true
```

Depois, recrie o contêiner para carregar as variáveis, importe o workflow e
ative-o. A chave não deve ser gravada no workflow nem enviada ao navegador.

As chaves não ficam no workflow. O contêiner lê os valores do `.env.local`,
que já é ignorado pelo Git.

### Autorizar o Resend

O fluxo usa a API HTTPS do Resend para enviar a notificação. A chave da API não
deve ser adicionada ao workflow, ao `.env.local` da aplicação ou ao Git.

1. crie uma chave com permissão de envio no painel do Resend;
2. no n8n, crie uma credencial do tipo `Header Auth` chamada `Resend API`;
3. informe `Authorization` no campo de nome do cabeçalho;
4. informe `Bearer SUA_CHAVE` no campo de valor e salve a credencial;
5. associe a credencial ao nó `Notificar equipe por e-mail`;
6. durante o desenvolvimento, configure `WG_NOTIFICACAO_REMETENTE` com o remetente
   de teste `WG Hidráulica <onboarding@resend.dev>` e `WG_NOTIFICACAO_DESTINATARIO`
   com o endereço da conta Resend;
7. execute um teste e habilite o nó apenas após confirmar o recebimento.

Para uso real, a equipe deverá validar um domínio próprio no Resend e substituir
o endereço de teste por um remetente desse domínio. Dessa forma, o protótipo e
o cenário de produção ficam claramente separados na documentação do TCC.
