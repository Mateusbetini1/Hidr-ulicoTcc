# Arquitetura e fluxo da aplicação

## Objetivo

O sistema transforma uma solicitação enviada no site em uma oportunidade acompanhada pela equipe comercial. A interface pública e o painel usam a mesma aplicação, mas possuem responsabilidades e níveis de acesso diferentes.

## Visão geral

```mermaid
flowchart LR
    Cliente[Cliente no site] --> Formulario[Formulário de orçamento]
    Formulario --> API1[API pública]
    API1 --> RPC1[Função criar_solicitacao_publica]
    RPC1 --> Banco[(Supabase)]
    Banco --> RPC2[Funções protegidas do painel]
    RPC2 --> API2[API administrativa]
    API2 --> Painel[Painel comercial]
    Painel --> Status[Alteração de status]
    Status --> Banco
    Painel --> Atividade[Observação ou evento comercial]
    Atividade --> Banco
```

## Fluxo de uma nova solicitação

1. O cliente preenche o formulário em `/contato`.
2. `QuoteForm` converte os campos em JSON e envia uma requisição para `/api/solicitacoes`.
3. A API limita o tamanho dos textos, verifica campos obrigatórios e aplica uma proteção simples contra robôs.
4. A API chama a função `criar_solicitacao_publica` do Supabase.
5. A função cria ou atualiza o cliente pelo WhatsApp, registra a solicitação com status `novo` e grava o primeiro item do histórico.
6. O painel consulta novamente os dados e apresenta a solicitação para a equipe.

## Fluxo de atualização do status

1. O administrador escolhe um status no painel.
2. O componente envia o identificador e o novo status à API administrativa.
3. A API confirma a identidade do usuário e valida se o status é permitido.
4. A função protegida do banco atualiza a solicitação.
5. O status anterior, o novo status e uma observação são registrados em `historico_status`.
6. A interface atualiza os cartões e o funil sem recarregar a página inteira.

## Fluxo de criação do orçamento

1. A equipe abre os detalhes de uma solicitação e informa descrição, quantidade e valor unitário.
2. A API administrativa valida os números e chama `salvar_item_orcamento_painel`.
3. A função cria ou atualiza o item garantindo que ele pertença à solicitação correta.
4. Ao salvar o primeiro item, uma solicitação nova ou em atendimento passa para `orcamento`.
5. Essa transição também é registrada no histórico de status.
6. A interface consulta os itens novamente e calcula subtotais e total para exibição.

## Fluxo de geração da proposta

1. A equipe registra validade, prazo de entrega, condições de pagamento e observações.
2. Esses dados são persistidos em `orcamentos`, vinculados à solicitação.
3. O endpoint protegido consulta solicitação, itens e condições comerciais.
4. O backend calcula o valor total e monta um documento A4 com identidade visual da WG.
5. O navegador recebe o arquivo com tipo `application/pdf` para download.

O PDF é gerado no servidor. Assim, dados protegidos e regras comerciais não precisam ser enviados a uma biblioteca externa.

## Fluxo do histórico comercial

1. Mudanças de status continuam sendo gravadas automaticamente em `historico_status`.
2. A equipe pode registrar observações, contatos, medidas recebidas e propostas enviadas.
3. A API identifica o responsável pelo e-mail autenticado e não aceita essa identidade do navegador.
4. A função protegida persiste a atividade em `atividades_comerciais`.
5. A linha do tempo combina os dois conjuntos de eventos em ordem cronológica.

Essa separação mantém fatos do fluxo, como uma mudança de etapa, distintos das anotações de acompanhamento feitas pela equipe.

## Divisão de responsabilidades

| Camada | Responsabilidade | Exemplos |
|---|---|---|
| Interface | Coletar dados e mostrar resultados | formulário e painel |
| API | Validar entradas e controlar acesso | rotas em `app/api` |
| Regras do banco | Executar operações consistentes e protegidas | funções RPC |
| Banco de dados | Armazenar clientes, solicitações e histórico | tabelas PostgreSQL |
| Hospedagem | Executar a aplicação e identificar o usuário | Sites/Cloudflare |

Essa separação facilita a manutenção: a tela não acessa as tabelas diretamente, e as regras críticas permanecem no backend e no banco.
