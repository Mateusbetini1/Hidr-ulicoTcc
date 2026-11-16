import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dependencies = join(root, 'node_modules');
const vinext = join(dependencies, 'vinext', 'dist', 'cli.js');
if (!existsSync(vinext)) throw new Error('Instale as dependências do projeto antes de gerar o build.');

// Copia o working tree atual, incluindo fontes novas que o Git não ignora.
const sourceFiles = execFileSync('git', [
  'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
  'app', 'public', '.openai/hosting.json', 'next.config.ts', 'vite.config.ts', 'package.json', 'tsconfig.json',
], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);

const tempParent = realpathSync(tmpdir());
const buildRoot = mkdtempSync(join(tempParent, 'wg-build-homologacao-'));
try {
  for (const file of sourceFiles) {
    if (/^(?:\.env|\.dev\.vars)/i.test(basename(file))) continue;
    const source = join(root, file);
    if (!existsSync(source)) continue;
    if (!lstatSync(source).isFile()) throw new Error(`Fonte de build não regular: ${file}`);
    const destination = join(buildRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }

  symlinkSync(dependencies, join(buildRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const systemEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => (
    /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|COMSPEC|WINDIR|TMP|TEMP|TMPDIR|LANG|LC_ALL)$/i.test(name)
  )));
  const result = spawnSync(process.execPath, [vinext, 'build'], {
    cwd: buildRoot,
    stdio: 'inherit',
    env: {
      ...systemEnvironment,
      HOME: buildRoot,
      USERPROFILE: buildRoot,
      WG_BUILD_HOMOLOGACAO: 'true',
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
      WRANGLER_SEND_METRICS: 'false',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build do Vinext falhou (${result.status ?? result.signal}).`);

  const dist = join(buildRoot, 'dist');
  const config = JSON.parse(readFileSync(join(dist, 'server', 'wrangler.json'), 'utf8'));
  if (config.name !== 'wg-hidraulica-tcc-teste' || config.workers_dev !== false || config.preview_urls !== false ||
      config.route || config.routes?.length || config.triggers?.crons?.length || config.account_id ||
      config.d1_databases?.length || config.r2_buckets?.length || config.services?.length ||
      config.compatibility_date !== '2026-05-15' || !config.compatibility_flags?.includes('nodejs_compat') ||
      config.assets?.directory !== '../client' || !config.main || !existsSync(resolve(dist, 'server', config.main)) ||
      !existsSync(join(dist, 'client', 'favicon.ico'))) {
    throw new Error('A configuração gerada diverge do destino, dos bindings ou dos assets esperados.');
  }
  const vars = config.vars ?? {};
  const expectedVars = ['AUTH_DEV_BYPASS', 'CHATBOT_AI_ENABLED', 'TRIAGE_AI_ENABLED'];
  if (Object.keys(vars).length !== expectedVars.length || expectedVars.some((name) => vars[name] !== 'false')) {
    throw new Error('A configuração gerada contém variáveis inesperadas.');
  }

  const outputParent = join(root, 'output', 'cloudflare-homologacao');
  mkdirSync(outputParent, { recursive: true });
  const artifact = mkdtempSync(join(outputParent, 'build-'));
  cpSync(dist, artifact, { recursive: true });
  console.log(`\nConfiguração de homologação: ${join(artifact, 'server', 'wrangler.json')}`);
} finally {
  if (dirname(realpathSync(buildRoot)) === tempParent) rmSync(buildRoot, { recursive: true, force: true });
}
