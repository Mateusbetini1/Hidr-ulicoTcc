# Triagem comercial

A rota `/atendimento`, acessível pelo formulário de contato, organiza a solicitação em três etapas. O cliente descreve sua necessidade, informa os dados técnicos disponíveis e revisa o resumo antes de cadastrar nome e contato e confirmar o envio.

Campos: serviço (fabricação, manutenção, reforma ou orientação), aplicação, quantidade, medidas/identificação, problema e prazo desejado. Campos técnicos podem ficar vazios; as pendências acompanham o resumo. A triagem não fornece preços, valida compatibilidade, dimensiona componentes ou confirma prazos e reuniões.

## Persistência e automação

O envio usa `/api/solicitacoes` e a função existente `criar_solicitacao_publica`. O servidor valida os campos e monta a descrição, com origem `site_triagem` e status inicial `novo`. O painel e o workflow existente do n8n conseguem ler a descrição sem migração ou alteração no fluxo de e-mail. Não se persistem rascunhos nem conversas: somente o resumo revisado pelo cliente é enviado. A opção de formulário direto permanece disponível.

## IA opcional

`/api/triagem` usa a Responses API com saída estruturada para extrair os campos da descrição. A interface pede revisão humana. Somente a descrição técnica é enviada ao provedor; os campos de contato não fazem parte da chamada. `store` é definido como `false`. Chaves permanecem no servidor.

Configurar no ambiente local e na hospedagem:

- `OPENAI_API_KEY`: chave autorizada para a API.
- `OPENAI_TRIAGE_MODEL`: identificador de modelo disponível na conta e compatível com Responses e saída estruturada.
- `TRIAGE_AI_ENABLED=true`: ativa explicitamente a função.

Sem configuração, a interface opera como atendimento guiado e não se apresenta como IA. Falhas do provedor não impedem preenchimento manual. A extração foi implementada, mas a avaliação com um modelo real depende da configuração da chave e do modelo.

Há limite de tamanho de entrada, tempo de chamada e dez chamadas por minuto por instância. Esse limite em memória é complementar e não é global: antes de disponibilizar IA publicamente, configurar limites no gateway e no projeto do provedor para controlar uso e custos. A checagem de origem não substitui proteção contra abuso. Não habilitar a opção em produção sem esses controles.

## Verificação

Testar dados incompletos, revisão/edição, preservação dos campos em erro, IA desativada, saída inválida do provedor e envio somente após confirmação. Para teste integrado real, cadastrar uma solicitação claramente fictícia: o fluxo ativo do n8n poderá enviar e-mail. Testes automatizados de contrato usam respostas simuladas e não disparam notificações.

Referência da integração: https://developers.openai.com/api/docs/guides/structured-outputs
