import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';
import ts from 'typescript';

async function loadSource(path, imports = {}) {
  let { outputText } = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  outputText = outputText.replace(/(from\s+['"])([^'"]+)/g, (match, prefix, name) => (
    imports[name] ? prefix + imports[name] : match
  ));
  return asModule(outputText);
}

function asModule(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

const moneyUrl = await loadSource('../app/lib/quote-money.ts');
const { formatBrlCents, quoteSubtotalCents, quoteTotalCents } = await import(moneyUrl);
const { createProposalPdf } = await import(await loadSource('../app/lib/proposal-pdf.ts', {
  './quote-money': moneyUrl,
  'pdf-lib': import.meta.resolve('pdf-lib'),
}));

const halfCent = { quantidade: 0.5, valor_unitario: 0.01 };
const largestItem = { quantidade: 999999, valor_unitario: 9999999999.99 };
const contact = {
  id: '00000000-0000-0000-0000-000000000001',
  cliente_nome: 'João da Silva',
  whatsapp: '(00) 00000-0000',
  email: 'cliente@example.invalid',
};
const proposal = {
  validade_dias: 15,
  prazo_entrega: '20 dias úteis',
  condicoes_pagamento: 'A combinar',
  observacoes: 'Conferir Ø e temperatura em °C.',
};

test('soma centavos das linhas arredondadas e preserva precisão nos valores máximos', () => {
  assert.equal(quoteSubtotalCents(halfCent), 1n);
  assert.equal(quoteSubtotalCents({ ...halfCent, quantidade: 0.499 }), 0n);
  assert.equal(quoteSubtotalCents({ quantidade: 1.125, valor_unitario: 19.99 }), 2249n);
  assert.equal(quoteSubtotalCents({ quantidade: 1, valor_unitario: null }), 0n);
  assert.equal(quoteTotalCents([halfCent, halfCent]), 2n);
  assert.equal(quoteSubtotalCents(largestItem), 999998999999000001n);
  assert.equal(formatBrlCents(quoteTotalCents([largestItem, halfCent])), 'R$\u00a09.999.989.999.990.000,02');
});

function pageText(page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
  const decoder = new TextDecoder('windows-1252');
  return streams.flatMap((stream) => {
    const raw = page.doc.context.lookup(stream, PDFRawStream);
    const operators = Buffer.from(decodePDFRawStream(raw).decode()).toString('ascii');
    return [...operators.matchAll(/\/Helvetica(-Bold)?-[\d]+ ([\d.]+) Tf\s+[\d.]+ TL\s+1 0 0 1 ([\d.]+) ([\d.]+) Tm\s+<([0-9A-F]*)> Tj/g)].map(
      ([, bold, size, x, y, hex]) => ({ bold, size: Number(size), x: Number(x), y: Number(y), text: decoder.decode(Buffer.from(hex, 'hex')) }),
    );
  });
}

test('PDF soma os subtotais visíveis com o mesmo arredondamento do painel', async () => {
  const document = await PDFDocument.load(await createProposalPdf(
    { ...contact, descricao: 'Cilindros para a prensa.' },
    [{ ...halfCent, descricao: 'Primeiro item' }, { ...halfCent, descricao: 'Segundo item' }],
    proposal,
  ));
  const text = pageText(document.getPage(0));
  assert.equal(document.getPageCount(), 1);
  assert.equal(text.filter((line) => line.text === 'R$\u00a00,01').length, 4);
  assert.equal(text.filter((line) => line.text === 'R$\u00a00,02').length, 1);
});

test('PDF mantém descrição, campos, itens e condições em múltiplas páginas', async () => {
  const lines = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
  const description = lines('Necessidade', 75);
  const itemDescription = lines('Detalhe', 60).join('\n');
  const items = lines('Cilindro', 80).map((descricao) => ({ ...halfCent, descricao }));
  items[0] = { ...largestItem, descricao: itemDescription };
  const observations = lines('Observação', 100);
  const reference = `REF-${'W'.repeat(178)}-FIM`;
  const request = { ...contact, empresa: reference, descricao: description.join('\r\n') };
  const document = await PDFDocument.load(await createProposalPdf(request, items, {
    ...proposal,
    observacoes: [...observations, 'Conferir ⌀, tolerância ≤ 5 μm e temperatura em °C.', 'Ângulo α 15°, rugosidade Rₐ 0,8 µm e revisão 🔧.'].join('\n'),
  }));
  const pages = document.getPages().map(pageText);
  const all = pages.flatMap((page) => page.map(({ text }) => text));
  assert.ok(pages.length > 5);
  for (const expected of [...description, ...itemDescription.split('\n'), ...items.slice(1).map(({ descricao }) => descricao), ...observations]) {
    assert.equal(all.filter((text) => text === expected).length, 1, expected);
  }
  assert.ok(all.join('').includes(reference));
  assert.ok(all.includes('Conferir Ø, tolerância <= 5 µm e temperatura em °C.'));
  assert.ok(all.some((text) => text.includes('[U+1F527]')));
  const actualText = document.getPages().flatMap((page) => {
    const contents = page.node.Contents();
    return (contents instanceof PDFArray ? contents.asArray() : [contents]).flatMap((ref) => {
      const operators = Buffer.from(decodePDFRawStream(page.doc.context.lookup(ref, PDFRawStream)).decode()).toString('ascii');
      return [...operators.matchAll(/\/ActualText <FEFF([0-9A-F]+)>/g)].map(([, hex]) => String.fromCodePoint(Number.parseInt(hex, 16)));
    });
  });
  assert.deepEqual(actualText, ['α', 'ₐ']);
  assert.ok(all.includes('ITEM (CONT.)'));
  assert.equal(all.filter((text) => text === formatBrlCents(quoteTotalCents(items))).length, 1);

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  pages.forEach((page, index) => {
    assert.ok(page.some(({ text }) => text === `Página ${index + 1} de ${pages.length}`));
    if (page.some(({ text }) => /^(Cilindro|Detalhe)\d+$/.test(text))) {
      assert.ok(page.some(({ text }) => text === 'SUBTOTAL'));
    }
    for (const line of page) {
      assert.ok(line.y === 20 || line.y >= 55, line.text);
      assert.ok(line.x + (line.bold ? bold : regular).widthOfTextAtSize(line.text, line.size) <= 548, line.text);
    }
  });
});

const admin = asModule('export async function getAdminEmail() { return "test@example.invalid"; }');
const rpc = asModule(`
  export const calls = [];
  export async function supabaseDashboardRpc(name, args) {
    calls.push({ name, args });
    return 'test-id';
  }
`);
const { calls } = await import(rpc);
const countUrl = await loadSource('../app/lib/character-count.ts');
const routeImports = {
  'next/server': import.meta.resolve('next/server.js'),
  '../../../../../lib/admin-auth': admin,
  '../../../../../lib/character-count': countUrl,
  '../../../../../lib/supabase-dashboard': rpc,
  '../../../../../../lib/admin-auth': admin,
  '../../../../../../lib/character-count': countUrl,
  '../../../../../../lib/supabase-dashboard': rpc,
};
const itemRoute = await import(await loadSource('../app/api/painel/solicitacoes/[id]/itens/route.ts', routeImports));
const proposalRoute = await import(await loadSource('../app/api/painel/solicitacoes/[id]/proposta/dados/route.ts', routeImports));

function post(route, body) {
  return route.POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: contact.id }),
  });
}

test('valida preço e quantidade antes da RPC, preservando zero e decimais válidos', async () => {
  const valid = { descricao: 'Cilindro', quantidade: '1,125', valorUnitario: '0,00' };
  for (const [input, message] of [
    [{ valorUnitario: '' }, /valor unitário/],
    [{ valorUnitario: true }, /valor unitário/],
    [{ valorUnitario: '0x10' }, /valor unitário/],
    [{ valorUnitario: '12,345' }, /valor unitário/],
    [{ quantidade: '0.0009' }, /quantidade/],
    [{ quantidade: '1.0001' }, /quantidade/],
    [{ descricao: 'W'.repeat(501) }, /descrição/],
    [{ descricao: '🔧' }, /descrição/],
  ]) {
    const response = await post(itemRoute, { ...valid, ...input });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, message);
  }
  assert.equal(calls.length, 0);
  assert.equal((await post(itemRoute, valid)).status, 200);
  assert.deepEqual(calls.at(-1), { name: 'salvar_item_orcamento_painel', args: {
    p_solicitacao_id: contact.id, p_item_id: null, p_descricao: 'Cilindro', p_quantidade: 1.125, p_valor_unitario: 0,
  } });
  assert.equal((await post(itemRoute, { ...valid, quantidade: '1e-3', valorUnitario: '100e-2' })).status, 200);
  assert.equal(calls.at(-1).args.p_quantidade, 0.001);
  assert.equal(calls.at(-1).args.p_valor_unitario, 1);
});

test('rejeita validade inválida e condições excessivas sem truncar ou chamar a RPC', async () => {
  const initialCalls = calls.length;
  for (const [input, message] of [
    [{ validadeDias: true }, /validade/],
    [{ validadeDias: 366 }, /validade/],
    [{ prazoEntrega: 'x'.repeat(301) }, /prazo de entrega/],
    [{ condicoesPagamento: 'x'.repeat(501) }, /condições de pagamento/],
    [{ observacoes: 'x'.repeat(2001) }, /observações/],
    [{ observacoes: [] }, /observações/],
  ]) {
    const response = await post(proposalRoute, { validadeDias: '15', ...input });
    assert.equal(response.status, 400);
    assert.match((await response.json()).message, message);
  }
  assert.equal(calls.length, initialCalls);
  const observacoes = '🔧'.repeat(2000);
  assert.equal((await post(proposalRoute, { validadeDias: '15', observacoes })).status, 200);
  assert.deepEqual(calls.at(-1), { name: 'salvar_dados_proposta_painel', args: {
    p_solicitacao_id: contact.id, p_validade_dias: 15, p_prazo_entrega: '', p_condicoes_pagamento: '', p_observacoes: observacoes,
  } });
});
