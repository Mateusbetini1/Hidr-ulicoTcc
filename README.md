# Sistema Web — WG Hidráulica

Projeto desenvolvido como Trabalho de Conclusão de Curso para centralizar o atendimento comercial da WG Hidráulica. A solução reúne um site institucional, um formulário de solicitação de orçamento e um painel interno que acompanha o andamento de cada atendimento.

## O que já funciona

- páginas públicas institucionais responsivas;
- envio de solicitações de orçamento pelo site;
- armazenamento de clientes e solicitações no Supabase;
- painel comercial protegido;
- listagem das solicitações reais recebidas;
- consulta dos dados completos de cada solicitação;
- criação, edição e remoção de itens do orçamento;
- cálculo automático do valor total da proposta;
- cadastro das condições comerciais da proposta;
- geração e download da proposta comercial em PDF;
- alteração de status e atualização automática dos indicadores;
- histórico das mudanças de status no banco de dados.
- linha do tempo com observações, contatos, recebimento de medidas e envio de propostas.

## Tecnologias

- **Next.js, React e TypeScript:** interface e rotas da aplicação;
- **Vinext e Vite:** execução e geração da versão hospedada;
- **Supabase/PostgreSQL:** persistência dos dados;
- **n8n e Docker:** execução local das automações de atendimento;
- **OpenAI Sites/Cloudflare Workers:** hospedagem da aplicação;
- **CSS:** identidade visual baseada no protótipo do Figma.

## Executar localmente

Requisitos: Node.js 22.13 ou superior e pnpm.

```powershell
cd "E:\TCC - Hidraulico\sistema-web"
pnpm install
Copy-Item .env.example .env.local
pnpm run dev
```

Preencha o arquivo `.env.local` com os valores do projeto Supabase. Esse arquivo contém configurações privadas, é ignorado pelo Git e não deve ser enviado ao repositório.

Acesse:

- `http://localhost:3000` para o site;
- `http://localhost:3000/contato` para enviar uma solicitação;
- `http://localhost:3000/sistema` para abrir o painel.

O painel usa autenticação por e-mail e senha do Supabase Auth. Somente contas já criadas no Supabase e listadas em `ADMIN_EMAILS` são aceitas. A sessão administrativa é armazenada em cookie HTTP-only assinado por `AUTH_SESSION_SECRET` (ou, temporariamente, por `SUPABASE_DASHBOARD_SECRET` quando o segredo específico não estiver configurado). Para liberar o acesso local sem login durante uma manutenção, use `AUTH_DEV_BYPASS=true`; nunca habilite essa opção em produção.

## Comandos principais

```powershell
pnpm run dev    # inicia o ambiente de desenvolvimento
pnpm run build  # valida e gera a aplicação para produção
pnpm run lint   # verifica padrões e possíveis erros no código
pnpm run n8n:up # inicia o serviço local de automações
```

## Organização do projeto

```text
app/
  api/          Rotas que recebem e validam requisições
  components/   Formulário, painel e elementos compartilhados
  lib/          Autenticação e comunicação protegida com o Supabase
  sistema/      Página administrativa
  contato/      Página pública de solicitação
supabase/
  migrations/   Estrutura, regras e funções do banco de dados
infra/n8n/       Configuração local do serviço de automações
docs/            Documentação para desenvolvimento e apresentação
public/          Imagens e ícones públicos
```

## Documentação

- [Arquitetura e fluxo da aplicação](docs/arquitetura.md)
- [Banco de dados e segurança](docs/banco-de-dados.md)
- [Guia de leitura do código](docs/guia-do-codigo.md)
- [Roteiro de demonstração](docs/roteiro-demonstracao.md)
- [Execução local do n8n](infra/n8n/README.md)

## Próximas etapas sugeridas

### Triagem comercial adicionada em outubro de 2026

A página `/atendimento` oferece um chatbot de triagem que conversa sobre a necessidade técnica, organiza os campos com saída estruturada e solicita revisão antes do envio para o painel. O site encaminha as mensagens ao n8n local, que consulta o Gemini 3.5 Flash-Lite. O formulário de contato continua disponível como alternativa. A integração permanece desativada até configurar a chave gratuita do Gemini e os limites de uso. Consulte [Triagem comercial](docs/triagem-comercial.md).

1. configurar os dados cadastrais completos da WG Hidráulica;
2. integrar notificações e automações com n8n;
3. conectar o atendimento automatizado e os agendamentos descritos no artigo;
4. adicionar testes automatizados e indicadores históricos.
