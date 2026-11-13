# Homologação no Cloudflare Workers

Use um Worker exclusivo para a demonstração, com o Supabase de homologação e dados fictícios. O build do Vinext gera `dist/server/wrangler.json` para o servidor e `dist/client` para os assets. A configuração fixa a data de compatibilidade em `2026-05-15` e usa `nodejs_compat` para disponibilizar os bindings de texto e os segredos via `process.env`. O build local independe das credenciais do Supabase.

## Build e testes locais

Em uma cópia isolada, mantenha os arquivos da aplicação e do build, incluindo `.openai/hosting.json`, os testes e os arquivos de dependências. Exclua `.env*` com valores reais, `.dev.vars*`, `node_modules`, `dist` e `.wrangler` da origem. Instale as dependências na própria cópia. Abra uma sessão sem credenciais exportadas da produção ou de homologação.

```powershell
pnpm.cmd install --frozen-lockfile
node --test tests/*.test.mjs
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd run lint
$env:WRANGLER_SEND_METRICS = 'false'
$env:CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
pnpm.cmd run build
```

Interrompa se um comando falhar. Os testes JavaScript simulam os serviços externos. Para conferir o artefato no runtime local sem conectar ao banco, inicie o Wrangler com os bindings do Supabase ausentes:

```powershell
pnpm.cmd exec wrangler dev --local --config dist/server/wrangler.json --ip 127.0.0.1 --port 8791 --var 'AUTH_DEV_BYPASS:false'
```

Em outra janela, confira os cabeçalhos. A listagem retorna `401` e a página do painel mostra acesso negado. As respostas devem incluir `no-store`.

```powershell
curl.exe -i http://127.0.0.1:8791/sistema
curl.exe -i http://127.0.0.1:8791/api/painel/solicitacoes
```

Encerre o Wrangler com Ctrl+C. Para exercitar login e PDF sem acesso remoto, use um mock local de Supabase Auth e RPCs com dados fictícios. Teste uma resposta autenticada seguida de uma requisição sem cookie à mesma URL, além de uma proposta com vários itens. Valide `401` sem sessão, `application/pdf` e `no-store`. A execução local valida a compatibilidade do runtime. A cota de CPU do Workers Free deve ser medida no ambiente hospedado.

No runtime Vinext usado pelo projeto, páginas dinâmicas como `/sistema` podem usar `Cache-Control: no-store, must-revalidate` e omitir `Cloudflare-CDN-Cache-Control`, mesmo com os dois cabeçalhos declarados em `next.config.ts`. As rotas de login e logout definem os dois cabeçalhos diretamente, inclusive em redirecionamentos e erros. No domínio hospedado, confirme o bypass nas regras de cache e repita o teste com e sem cookie na mesma URL.

## Variáveis do Worker

| Escopo | Nomes |
| --- | --- |
| Segredos exclusivos do Worker de homologação | `SUPABASE_DASHBOARD_SECRET`, `AUTH_SESSION_SECRET` |
| Conexão, lista administrativa e URL da demonstração | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAILS`, `SITE_ORIGIN` |
| Controles da demonstração | `AUTH_DEV_BYPASS`, `CHATBOT_AI_ENABLED`, `TRIAGE_AI_ENABLED` |

Configure `AUTH_DEV_BYPASS=false` explicitamente. O código permite o bypass somente fora de produção e com ativação explícita. Login por senha exige conta autorizada no Auth de testes. Use um segredo de sessão independente e a chave administrativa cujo hash foi registrado no banco de homologação. Cadastre segredos como secrets do Worker, fora da configuração versionada e de variáveis públicas.

Deixe as duas opções de IA desativadas nesta etapa. A geração do PDF e o painel funcionam sem n8n. A fila pode receber registros no banco de teste, mas o envio depende de um n8n conectado a esse ambiente.

## Antes de publicar

1. Confirme no Dashboard que o nome de destino é o Worker de homologação. Confira o nome no artefato gerado e a configuração dos comandos e gatilhos de publicação antes de autorizar o envio.
2. Confirme que os bindings pertencem exclusivamente ao Supabase de testes. O aplicativo usa RPCs e a configuração já aplicada ao banco. O deploy web não requer reaplicar as migrações.
3. Exclua `/login`, `/sistema` e subrotas, `/api/auth/*` e `/api/painel/*` de qualquer regra de cache forçado. O código envia `no-store` nessas respostas. O PDF também declara essa política diretamente.
4. Após uma publicação autorizada, confira login, logout, listagem, acesso anônimo negado e geração de PDF. Verifique cabeçalhos no domínio real e o tempo de CPU com um PDF representativo. Uma resposta cacheada jamais deve permitir que uma sessão anônima leia dados administrativos.
5. Confira o cadastro público no ambiente isolado antes de compartilhar a URL. A RPC pública ainda aceita gravações anônimas, então restrinja o acesso à demonstração. Mantenha o workflow atual e as credenciais de produção separados.
