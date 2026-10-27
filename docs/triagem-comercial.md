# Triagem comercial e chatbot

A rota `/atendimento`, acessível pelo formulário de contato, oferece uma conversa de triagem. O chatbot faz uma pergunta por vez, organiza a solicitação e apresenta um resumo para revisão antes de cadastrar nome e contato e confirmar o envio.

Campos: serviço (fabricação, manutenção, reforma ou orientação), aplicação, quantidade, medidas/identificação, problema e prazo desejado. Campos técnicos podem ficar vazios; as pendências acompanham o resumo. A triagem não fornece preços, valida compatibilidade, dimensiona componentes ou confirma prazos e reuniões.

## Persistência e automação

O envio usa `/api/solicitacoes` e a função existente `criar_solicitacao_publica`. O servidor valida os campos e monta a descrição, com origem `site_triagem` e status inicial `novo`. O painel e o workflow existente do n8n conseguem ler a descrição sem migração ou alteração no fluxo de e-mail. Não se persistem rascunhos nem conversas: somente o resumo revisado pelo cliente é enviado. A opção de formulário direto permanece disponível.

## IA opcional

`/api/chatbot` valida a origem, os tamanhos e o estado da conversa e encaminha a requisição ao webhook local do n8n. O workflow `WG Hidráulica - Chatbot Gemini` consulta o Gemini 3.5 Flash-Lite com JSON Schema, valida novamente a resposta e a devolve ao site. O histórico é limitado a 14 mensagens e não é persistido pelo sistema. Somente a conversa técnica é enviada ao provedor; nome, telefone, empresa e e-mail são coletados depois e não fazem parte da chamada. A chave permanece no servidor. A rota `/api/triagem` continua disponível para a extração de uma descrição em um único passo com a integração anterior, quando configurada.

Configurar no ambiente local e na hospedagem:

- `GEMINI_API_KEY`: chave criada no Google AI Studio; é lida pelo contêiner do n8n.
- `GEMINI_CHATBOT_MODEL=gemini-3.5-flash-lite`: modelo usado pelo workflow.
- `CHATBOT_N8N_WEBHOOK_URL=http://localhost:5678/webhook/wg-hidraulica-chatbot`: webhook chamado pelo servidor do site.
- `CHATBOT_AI_ENABLED=true`: ativa explicitamente o chatbot.
- `OPENAI_API_KEY`, `OPENAI_TRIAGE_MODEL` e `TRIAGE_AI_ENABLED`: permanecem opcionais e pertencem somente à rota legada `/api/triagem`.

Sem configuração, a interface informa que o assistente está indisponível e oferece o formulário direto. Falhas do provedor não apagam o histórico que permanece no navegador. A integração precisa ser avaliada com um modelo real antes da publicação.

Há limite de tamanho de entrada, tempo de chamada e vinte chamadas por minuto por instância. Esse limite em memória é complementar e não é global: antes de disponibilizar IA publicamente, configurar limites no gateway e no projeto do provedor para controlar uso e cotas. A checagem de origem não substitui proteção contra abuso. Não habilitar a opção em produção sem esses controles.

## Verificação

Testar dados incompletos, revisão/edição, preservação dos campos em erro, IA desativada, saída inválida do provedor e envio somente após confirmação. Para teste integrado real, cadastrar uma solicitação claramente fictícia: o fluxo ativo do n8n poderá enviar e-mail. Testes automatizados de contrato usam respostas simuladas e não disparam notificações.

Referências da integração:

- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/gemini-api/docs/pricing
