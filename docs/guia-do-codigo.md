# Guia de leitura do código

## Como explicar a implementação

O melhor caminho é acompanhar uma solicitação do início ao fim. Assim, cada arquivo aparece dentro de uma finalidade de negócio, e não como uma tecnologia isolada.

### 1. Formulário público

`app/components/quote-form.tsx` controla os campos e os estados de envio, sucesso e erro. A função `handleSubmit` impede o envio tradicional da página, monta o objeto com os dados e chama a API pública.

### 2. Entrada da aplicação

`app/api/solicitacoes/route.ts` é a fronteira entre o navegador e o banco. Ela trata JSON inválido, normaliza os textos, verifica os campos obrigatórios e somente então chama o Supabase.

### 3. Regra de cadastro

`supabase/migrations/202609010001_initial_commercial_schema.sql` contém `criar_solicitacao_publica`. A operação identifica o cliente pelo WhatsApp, cria a solicitação e registra seu status inicial. Centralizar isso no banco evita que uma solicitação fique parcialmente cadastrada.

### 4. Proteção do painel

`app/lib/admin-auth.ts` interpreta o e-mail informado pelo ambiente de hospedagem. Em produção ele precisa constar em `ADMIN_EMAILS`; localmente há uma identidade de desenvolvimento para facilitar os testes.

`app/lib/supabase-dashboard.ts` concentra a chamada das funções administrativas. Como esse módulo roda no servidor, a chave do painel não é exposta no JavaScript enviado ao visitante.

### 5. Painel comercial

`app/components/commercial-dashboard.tsx` busca as solicitações, calcula indicadores derivados e altera os status. Os dados são mantidos em estado React; quando um status muda, o item e os indicadores são atualizados imediatamente.

### 6. Detalhes da solicitação

`app/sistema/solicitacoes/[id]/page.tsx` protege a rota e localiza o registro solicitado. `app/components/request-detail.tsx` apresenta a necessidade, os dados de contato e a alteração de status. Os rótulos válidos ficam centralizados em `app/lib/commercial-status.ts`, evitando regras diferentes entre a API e a interface.

### 7. Montagem do orçamento

`app/components/quote-builder.tsx` controla o formulário e a lista de itens. As rotas em `app/api/painel/solicitacoes/[id]/itens` validam os dados antes de chamar as funções da terceira migração. O total não é armazenado separadamente: ele é calculado multiplicando quantidade e valor unitário, evitando inconsistências quando um item é editado.

### 8. Proposta em PDF

`app/components/proposal-settings.tsx` salva as condições comerciais. O endpoint `app/api/painel/solicitacoes/[id]/proposta` consulta todos os dados protegidos e usa `app/lib/proposal-pdf.ts` para montar o documento. A biblioteca `pdf-lib` gera o arquivo no próprio backend, sem enviar informações do cliente para serviços externos.

### 9. Histórico do atendimento

`app/components/request-history.tsx` reúne a inclusão de atividades e a linha do tempo. A rota `app/api/painel/solicitacoes/[id]/historico` usa o e-mail administrativo identificado no servidor; por isso, o navegador não pode escolher quem aparece como responsável. A quinta migração mantém observações em `atividades_comerciais` e combina esses registros com `historico_status` somente na consulta.

## Padrões adotados

- **Nomes ligados ao domínio:** `Solicitacao`, `cliente_nome`, `updateStatus` e `historico_status` representam conceitos do processo comercial.
- **Responsabilidade única:** componentes cuidam da interface, APIs validam requisições e funções SQL tratam operações do banco.
- **Validação em mais de uma camada:** navegador, API e banco verificam os dados de acordo com suas responsabilidades.
- **Segredos somente no servidor:** variáveis sensíveis não usam o prefixo público e não são incluídas no código do navegador.
- **Histórico em vez de sobrescrita silenciosa:** toda mudança efetiva de status gera um registro para futura auditoria.

## Convenção para comentários

Comentários devem explicar o motivo de uma decisão que não é evidente. Não é necessário comentar linhas como `setLoading(true)`, pois o próprio código já explica a ação. Proteções, exceções de ambiente e decisões de segurança merecem comentários curtos.

## Perguntas prováveis da banca

**Por que usar uma API se o Supabase já possui uma API?**  
Para criar uma fronteira controlada: validar os dados, esconder segredos administrativos e permitir mudanças futuras sem acoplar a interface diretamente ao banco.

**Por que o WhatsApp é único?**  
Ele funciona como identificador de contato no processo atual e evita duplicar o cliente a cada nova solicitação.

**Por que manter um histórico de status?**  
Para preservar rastreabilidade e permitir indicadores de tempo, conversão e produtividade futuramente.

**Onde o n8n entrará?**  
Depois do registro ou de uma mudança de status, poderá disparar notificações, tarefas e integrações sem substituir o núcleo do sistema.

**Por que existem duas tabelas de histórico?**
`historico_status` registra automaticamente mudanças de etapa, enquanto `atividades_comerciais` guarda ações e observações humanas. A linha do tempo une as duas sem misturar responsabilidades.
