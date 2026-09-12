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
2. o n8n recebe um evento ou consulta as solicitações pendentes;
3. o fluxo valida os dados e executa a automação configurada;
4. o resultado é registrado novamente no sistema para manter o histórico.

O primeiro fluxo será uma integração de teste com o Supabase. Depois dessa
validação, ele poderá enviar notificações e apoiar as demais etapas descritas
no TCC.

### Primeiro fluxo

O arquivo `workflows/nova-solicitacao.json` representa o fluxo inicial. Ele:

1. pode ser iniciado manualmente durante os testes;
2. possui um agendamento preparado para verificar o banco a cada cinco minutos;
3. consulta a função segura já utilizada pelo painel comercial;
4. seleciona somente solicitações com o status `novo`;
5. tenta enviar a notificação por e-mail até três vezes;
6. registra no histórico se o envio funcionou ou falhou;
7. muda a solicitação para `em atendimento`, evitando processamento duplicado.

Entre a seleção e a mudança de status existe o nó `Notificar equipe por
e-mail`. Ele prepara uma mensagem em texto simples com os dados comerciais e
usa a API do Resend. Falhas temporárias são repetidas até três vezes, com cinco
segundos entre as tentativas.

No caminho de sucesso, o histórico informa que a notificação foi enviada. Se
as três tentativas falharem, o fluxo registra a falha e encaminha a solicitação
para atendimento manual. Nos dois casos o item sai do estado `novo`, impedindo
novos envios automáticos e registros duplicados.

O fluxo permanece inativo após a importação. Ele só deve ser publicado depois
que a equipe definir o canal que receberá a notificação comercial.

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
6. durante o desenvolvimento, mantenha o remetente
   `WG Hidráulica <onboarding@resend.dev>` e envie somente para o endereço da
   conta Resend;
7. execute um teste e habilite o nó apenas após confirmar o recebimento.

Para uso real, a equipe deverá validar um domínio próprio no Resend e substituir
o endereço de teste por um remetente desse domínio. Dessa forma, o protótipo e
o cenário de produção ficam claramente separados na documentação do TCC.
