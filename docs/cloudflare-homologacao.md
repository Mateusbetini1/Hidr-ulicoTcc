# Homologação no Cloudflare Workers

Use o Worker `wg-hidraulica-tcc-teste` com o Supabase de homologação e dados fictícios. O build comum do Vinext continua gerando o artefato padrão em `dist`. A preparação abaixo executa o mesmo build em uma cópia temporária do código atual, sem copiar arquivos de ambiente ou herdar credenciais da sessão. O artefato de homologação sai em uma pasta nova sob `output/cloudflare-homologacao`, ignorada pelo Git.

## Build e testes locais

Na raiz do repositório, com as dependências do lockfile já instaladas, execute:

```powershell
node --test tests/*.test.mjs
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd run lint
node scripts/build-cloudflare-homologacao.mjs
```

Interrompa se um comando falhar. Use o caminho de `wrangler.json` impresso pelo build recém-concluído e gere um novo artefato sempre que o código mudar. A preparação valida o nome, os flags, a data `2026-05-15`, o entrypoint e os assets em `../client`. A configuração gerada começa com `workers_dev=false` e `preview_urls=false`, sem rotas ou bindings do Supabase.

```powershell
$config = (Resolve-Path -LiteralPath (Read-Host 'Caminho do wrangler.json recém-gerado')).Path
$worker = 'wg-hidraulica-tcc-teste'
$wrangler = (Resolve-Path -LiteralPath 'node_modules/wrangler/bin/wrangler.js').Path
$artifact = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
if ($artifact.name -ne $worker -or $artifact.workers_dev -ne $false -or $artifact.preview_urls -ne $false) {
    throw 'Use o artefato de homologação com as URLs desativadas.'
}
$env:WRANGLER_SEND_METRICS = 'false'
node $wrangler deploy --dry-run --config $config --name $worker
if ($LASTEXITCODE -ne 0) { throw 'A validação local do artefato falhou.' }
```

Os testes JavaScript simulam os serviços externos. Para conferir o runtime sem conectar ao banco:

```powershell
node $wrangler dev --local --config $config --ip 127.0.0.1 --port 8791
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
| Secrets do painel e conexão | `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DASHBOARD_SECRET`, `AUTH_SESSION_SECRET`, `ADMIN_EMAILS` |
| Secrets do cadastro | `SUPABASE_QUOTE_SECRET`, `TURNSTILE_SECRET_KEY` |
| Variáveis de texto | `SUPABASE_URL`, `SITE_ORIGIN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAME` |
| Controles com valor `false` no artefato | `AUTH_DEV_BYPASS`, `CHATBOT_AI_ENABLED`, `TRIAGE_AI_ENABLED` |

Configure `AUTH_DEV_BYPASS=false` explicitamente. O código permite o bypass somente fora de produção e com ativação explícita. Login por senha exige conta autorizada no Auth de testes. Use um segredo de sessão independente e a chave administrativa cujo hash foi registrado no banco de homologação. Cadastre segredos como secrets do Worker, fora da configuração versionada e de variáveis públicas.

Deixe as duas opções de IA desativadas nesta etapa. A geração do PDF e o painel funcionam sem n8n. Na homologação, o Worker separado `wg-hidraulica-tcc-notificacoes-teste` usa um Cron Trigger de cinco em cinco minutos para processar a fila do Supabase `zutnvrnsahmwuvlhhcuy` e enviar e-mails via Resend. O n8n original permanece separado e seu funcionamento independe desse Worker. O envio de e-mails da homologação funciona sem n8n. Consulte o [guia do Worker de notificações](../infra/cloudflare/notificacoes/README.md).

## Publicação manual futura

Execute esta etapa apenas quando for publicar. Em `whoami`, confirme a conta Cloudflare e verifique no painel que o nome pertence exclusivamente à homologação. Use o `$config` recém-gerado e conferido acima. O primeiro deploy cria o Worker sem URL pública e já configura a URL do Supabase de testes. `SITE_ORIGIN` é opcional. Se a URL HTTPS da demonstração ainda for desconhecida, omita o segundo `--var` e configure `SITE_ORIGIN` como variável de texto no painel antes de abrir o acesso.

```powershell
node $wrangler whoami
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível verificar a conta Cloudflare.' }
$siteOrigin = Read-Host 'URL HTTPS prevista para a demonstração, sem barra final'
node $wrangler deploy --config $config --name $worker --keep-vars --var 'SUPABASE_URL:https://zutnvrnsahmwuvlhhcuy.supabase.co' --var "SITE_ORIGIN:$siteOrigin"
if ($LASTEXITCODE -ne 0) { throw 'O deploy falhou. Interrompa antes de cadastrar os secrets.' }
```

Após o deploy inicial, insira interativamente cada valor de homologação. A chave publishable fica no Worker e a lista de e-mails administrativos fica fora do repositório. O segredo de sessão deve ser independente. A chave do painel deve corresponder ao hash já cadastrado no Supabase de testes. Cada `secret put` aplica o segredo ao Worker indicado, por isso conclua os quatro comandos antes de habilitar uma URL pública.

```powershell
foreach ($name in @('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_DASHBOARD_SECRET', 'AUTH_SESSION_SECRET', 'ADMIN_EMAILS')) {
    node $wrangler secret put $name --config $config --name $worker
    if ($LASTEXITCODE -ne 0) { throw "Falha ao cadastrar $name." }
}
node $wrangler secret list --config $config --name $worker
```

Mantenha `workers.dev` e previews desligados durante a ativação abaixo. Uma nova publicação com o artefato acima volta a declarar `workers_dev=false`. Exclua as rotas administrativas de regras de cache forçado e valide login, logout, acesso anônimo negado e geração de PDF antes da apresentação. Meça o custo de CPU de um PDF representativo no ambiente hospedado. Consulte os [limites do Workers](https://developers.cloudflare.com/workers/platform/limits/).

### Ativação do cadastro protegido em homologação

1. No painel do Cloudflare, crie um widget Turnstile Free limitado ao hostname futuro do Worker. Nas variáveis de `wg-hidraulica-tcc-teste`, cadastre a chave pública em `TURNSTILE_SITE_KEY` e o hostname exato em `TURNSTILE_HOSTNAME`, sem esquema, porta ou caminho. Cadastre o segredo do widget no prompt abaixo. A integração usa a action `solicitacao` e valida o token no servidor. [Configuração de Turnstile](https://developers.cloudflare.com/turnstile/get-started/)

   ```powershell
   node $wrangler secret put TURNSTILE_SECRET_KEY --config $config --name $worker
   ```

2. No PowerShell 7, gere um segredo de 32 bytes e envie ao Worker de teste. O comando imprime somente o hash para o provisionamento SQL. Confira que `$worker` e `$config` apontam para a homologação antes de executá-lo.

   ```powershell
   $quoteSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
   try {
       $quoteSecret | node $wrangler secret put SUPABASE_QUOTE_SECRET --config $config --name $worker
       if ($LASTEXITCODE -ne 0) { throw 'Falha ao cadastrar o segredo do formulário.' }
       [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($quoteSecret))).ToLowerInvariant()
   } finally {
       Remove-Variable quoteSecret
   }
   ```

3. No SQL Editor do projeto **`zutnvrnsahmwuvlhhcuy`**, aplique a migração `202609010008_restringir_cadastro_ao_worker.sql` após confirmar a migração 007. Em seguida, grave apenas o hash gerado no passo anterior. A migração e o novo código formam um corte coordenado. A versão antiga perde o acesso direto ao cadastro assim que a 008 é aplicada, e a versão nova só grava após provisionar o hash e concluir o Turnstile. Preserve a aplicação atual de produção nessa etapa.

   ```sql
   insert into private.cadastro_worker_config (id, segredo_hash)
   values (true, '<SHA-256_HEXADECIMAL>')
   on conflict (id) do update set segredo_hash = excluded.segredo_hash;
   ```

4. Gere e publique o novo artefato no Worker de homologação, com `--keep-vars` para preservar as variáveis cadastradas no painel. Confira o nome do destino, a URL do Supabase de testes e a presença dos dois secrets novos. Com previews desligados, habilite `workers.dev` quando estiver pronto para o teste funcional. Confirme um cadastro fictício pelo formulário e pela triagem, teste o envio do chatbot se estiver habilitado e confira painel e histórico. Uma requisição sem token, com token reutilizado ou de outro hostname deve ser recusada. Após o teste, mantenha o endereço disponível somente pelo período necessário à demonstração.

Turnstile reduz automação, mas ainda permite abusos por pessoas ou automação capaz de obter desafios válidos. A RPC nova exige seu próprio segredo para cada chamada. Se o segredo vazar, o acesso direto volta a ser possível com ele. Para interromper temporariamente o cadastro em homologação, desabilite a URL e remova a linha de configuração do cadastro caso seja necessário bloquear também a RPC. Preserve os registros comerciais. Mantenha o n8n de produção separado do banco da demonstração.
