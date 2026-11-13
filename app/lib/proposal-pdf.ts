import {
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  PDFPage,
  StandardFonts,
  endMarkedContent,
  rgb,
} from 'pdf-lib';
import { formatBrlCents, moneyToCents, quoteSubtotalCents, quoteTotalCents } from './quote-money';
import type { DadosProposta, ItemOrcamento, Solicitacao } from './supabase-dashboard';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 55;
const NAVY = rgb(7 / 255, 25 / 255, 67 / 255);
const YELLOW = rgb(1, 196 / 255, 0);
const MUTED = rgb(102 / 255, 112 / 255, 133 / 255);
const LINE = rgb(226 / 255, 229 / 255, 234 / 255);

type PdfFonts = { regular: PDFFont; bold: PDFFont };

const winAnsiAlternatives: Record<string, string> = {
  '–': '-', '—': '-', '−': '-', '≤': '<=', '≥': '>=',
  '⌀': 'Ø', 'μ': 'µ', '′': "'", '″': '"',
};

function technicalGlyphWidth(char: string, font: PDFFont, size: number) {
  return char === 'α' ? size * .58 : font.widthOfTextAtSize('a', size * .7);
}

function widthOfDescription(text: string, font: PDFFont, size: number) {
  return text.split(/([αₐ])/).reduce((width, part) => width + (
    part === 'α' || part === 'ₐ' ? technicalGlyphWidth(part, font, size) : font.widthOfTextAtSize(part, size)
  ), 0);
}

function drawDescription(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number) {
  for (const part of text.split(/([αₐ])/).filter(Boolean)) {
    if (part === 'α' || part === 'ₐ') {
      // ActualText mantém o símbolo original ao copiar ou extrair o texto.
      page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
        PDFName.of('Span'), `<< /ActualText ${PDFHexString.fromText(part)} >>`,
      ]));
      if (part === 'α') {
        page.drawText('a', { x, y, size, font, opacity: 0 });
        page.drawSvgPath('M 4.1 -4.1 C 3.1 -6.4 0.8 -5.1 0.8 -2.5 C 0.7 -0.1 2.5 0.4 3.6 -1.1 C 4.5 -2.3 5.1 -4.1 5.3 -5.3 M 4.1 -4.1 C 4.5 -2.5 4.5 -0.4 5.6 -0.4', {
          x, y, scale: size / 11, borderColor: NAVY, borderWidth: 1,
        });
      } else {
        page.drawText('a', { x, y: y - size * .13, size: size * .7, font, color: NAVY });
      }
      page.pushOperators(endMarkedContent());
      x += technicalGlyphWidth(part, font, size);
    } else {
      page.drawText(part, { x, y, size, font, color: NAVY });
      x += font.widthOfTextAtSize(part, size);
    }
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const supported = new Set(font.getCharacterSet());
  const normalized = text.trim().normalize('NFC');
  const fits = (line: string) => widthOfDescription(line, font, size) <= maxWidth;

  return (normalized || '-').split(/\r\n?|\n/).flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const rawWord of words) {
      const glyphs = Array.from(rawWord, (char) => {
        const code = char.codePointAt(0) ?? 0;
        if (char === 'α' || char === 'ₐ' || supported.has(code) && !winAnsiAlternatives[char]) return char;
        return winAnsiAlternatives[char] ?? `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]`;
      });
      const word = glyphs.join('');
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);
      current = '';
      if (fits(word)) {
        current = word;
        continue;
      }
      for (const glyph of glyphs) {
        if (current && !fits(current + glyph)) {
          lines.push(current);
          current = '';
        }
        current += glyph;
      }
    }
    return [...lines, current];
  });
}

function drawHeader(page: PDFPage, fonts: PdfFonts, proposalNumber: string) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 106, width: PAGE_WIDTH, height: 106, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 111, width: PAGE_WIDTH, height: 5, color: YELLOW });
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 72, width: 38, height: 38, color: YELLOW });
  page.drawText('WG', { x: MARGIN + 9, y: PAGE_HEIGHT - 58, size: 13, font: fonts.bold, color: NAVY });
  page.drawText('WG HIDRÁULICA', { x: MARGIN + 50, y: PAGE_HEIGHT - 47, size: 15, font: fonts.bold, color: rgb(1, 1, 1) });
  page.drawText('Soluções hidráulicas sob medida', { x: MARGIN + 50, y: PAGE_HEIGHT - 65, size: 8, font: fonts.regular, color: rgb(.75, .8, .88) });
  page.drawText('PROPOSTA COMERCIAL', { x: 385, y: PAGE_HEIGHT - 45, size: 11, font: fonts.bold, color: YELLOW });
  page.drawText(proposalNumber, { x: 385, y: PAGE_HEIGHT - 64, size: 8, font: fonts.regular, color: rgb(1, 1, 1) });
}

function drawRightAligned(page: PDFPage, text: string, font: PDFFont, size: number, right: number, y: number, maxWidth: number, color = NAVY) {
  const width = font.widthOfTextAtSize(text, size);
  const scale = Math.min(1, maxWidth / width);
  page.drawText(text, { x: right - width * scale, y, size: size * scale, font, color });
}

export async function createProposalPdf(
  request: Solicitacao,
  items: ItemOrcamento[],
  proposal: DadosProposta,
) {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(expiresAt.getDate() + proposal.validade_dias);
  const proposalNumber = `WG-${issuedAt.getFullYear()}-${request.id.slice(0, 8).toUpperCase()}`;
  const dateFormat = new Intl.DateTimeFormat('pt-BR');

  let y = PAGE_HEIGHT - 150;
  const addPage = () => {
    const newPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(newPage, fonts, proposalNumber);
    y = PAGE_HEIGHT - 150;
    return newPage;
  };
  let page = addPage();

  const drawFields = (fields: ReadonlyArray<readonly [string, string, number, number]>) => {
    const columns = fields.map(([label, value, x, width]) => ({
      label, x, lines: wrapText(value || 'Não informado', fonts.regular, 9, width),
    }));
    const lineCount = Math.max(...columns.map(({ lines }) => lines.length));
    for (let start = 0; start < lineCount;) {
      if (y - 15 < CONTENT_BOTTOM) page = addPage();
      const count = Math.min(lineCount - start, Math.floor((y - 15 - CONTENT_BOTTOM) / 11) + 1);
      for (const { label, x, lines } of columns) {
        if (start >= lines.length) continue;
        page.drawText(start ? `${label} (CONT.)` : label, { x, y, size: 7, font: fonts.bold, color: MUTED });
        lines.slice(start, start + count).forEach((line, index) => {
          drawDescription(page, line, fonts.regular, 9, x, y - 15 - index * 11);
        });
      }
      y -= 19 + count * 11;
      start += count;
    }
  };
  drawFields([
    ['CLIENTE', request.empresa || request.cliente_nome, MARGIN, 225],
    ['RESPONSÁVEL', request.cliente_nome, 315, 120],
    ['EMISSÃO', dateFormat.format(issuedAt), 460, 85],
  ]);
  y -= 15;
  drawFields([
    ['WHATSAPP', request.whatsapp, MARGIN, 135],
    ['E-MAIL', request.email ?? '', 205, 230],
    ['VÁLIDA ATÉ', dateFormat.format(expiresAt), 460, 85],
  ]);
  y -= 29;

  const drawTextSection = (label: string, value: string, size: number) => {
    const lines = wrapText(value, fonts.regular, size, CONTENT_WIDTH);
    const lineHeight = size + 3;
    for (let start = 0; start < lines.length;) {
      if (y - 15 < CONTENT_BOTTOM) page = addPage();
      page.drawText(start ? `${label} (CONT.)` : label, { x: MARGIN, y, size: 8, font: fonts.bold, color: MUTED });
      y -= 15;
      const count = Math.min(lines.length - start, Math.floor((y - CONTENT_BOTTOM) / lineHeight) + 1);
      for (const line of lines.slice(start, start + count)) {
        drawDescription(page, line, fonts.regular, size, MARGIN, y);
        y -= lineHeight;
      }
      start += count;
    }
    y -= 12;
  };
  drawTextSection('NECESSIDADE APRESENTADA', request.descricao, 9);

  const itemX = MARGIN + 9;
  const columns = [365, 445, PAGE_WIDTH - MARGIN - 9];
  const widths = [48, 72, 85];
  const drawTableHeader = (continued: boolean) => {
    const white = rgb(1, 1, 1);
    page.drawRectangle({ x: MARGIN, y: y - 18, width: CONTENT_WIDTH, height: 26, color: NAVY });
    page.drawText(continued ? 'ITEM (CONT.)' : 'ITEM', { x: itemX, y: y - 9, size: 7, font: fonts.bold, color: white });
    ['QTD.', 'UNITÁRIO', 'SUBTOTAL'].forEach((label, index) => {
      drawRightAligned(page, label, fonts.bold, 7, columns[index], y - 9, widths[index], white);
    });
    y -= 28;
  };

  const rowHeight = (count: number) => Math.max(30, count * 11 + 12);
  let needsHeader = true;
  for (const item of items) {
    const lines = wrapText(item.descricao, fonts.regular, 8, columns[0] - widths[0] - itemX - 8);
    const freshPageHeight = PAGE_HEIGHT - 150 - 28 - CONTENT_BOTTOM;
    for (let start = 0; start < lines.length;) {
      const remainingHeight = rowHeight(lines.length - start);
      const requiredHeight = remainingHeight <= freshPageHeight ? remainingHeight : rowHeight(1);
      if (y - (needsHeader ? 28 : 0) - requiredHeight < CONTENT_BOTTOM) {
        page = addPage();
        needsHeader = true;
      }
      if (needsHeader) {
        drawTableHeader(start > 0);
        needsHeader = false;
      }

      const count = Math.min(lines.length - start, Math.floor((y - CONTENT_BOTTOM - 12) / 11));
      const height = rowHeight(count);
      page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, borderColor: LINE, borderWidth: .7 });
      lines.slice(start, start + count).forEach((line, index) => {
        drawDescription(page, line, fonts.regular, 8, itemX, y - 18 - index * 11);
      });
      if (start === 0) {
        const values = [
          Number(item.quantidade).toLocaleString('pt-BR'),
          formatBrlCents(moneyToCents(item.valor_unitario)),
          formatBrlCents(quoteSubtotalCents(item)),
        ];
        values.forEach((value, index) => {
          const font = index === 2 ? fonts.bold : fonts.regular;
          drawRightAligned(page, value, font, 8, columns[index], y - 18, widths[index]);
        });
      }
      start += count;
      y -= height;
    }
  }

  y -= 16;
  if (y - 32 < CONTENT_BOTTOM) page = addPage();
  page.drawRectangle({ x: 355, y: y - 32, width: 192, height: 42, color: YELLOW });
  page.drawText('VALOR TOTAL', { x: 369, y: y - 8, size: 8, font: fonts.bold, color: NAVY });
  drawRightAligned(page, formatBrlCents(quoteTotalCents(items)), fonts.bold, 14, 535, y - 12, 103);
  y -= 58;

  const conditions = [
    ['Prazo de entrega', proposal.prazo_entrega || 'A combinar'],
    ['Condições de pagamento', proposal.condicoes_pagamento || 'A combinar'],
    ['Observações', proposal.observacoes || 'Sem observações adicionais'],
  ] as const;

  for (const [label, value] of conditions) {
    drawTextSection(label.toUpperCase(), value, 8);
  }

  document.getPages().forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: MARGIN, y: 35 }, end: { x: PAGE_WIDTH - MARGIN, y: 35 }, thickness: .7, color: LINE });
    currentPage.drawText('WG Hidráulica | contato@wghidraulica.com.br', { x: MARGIN, y: 20, size: 7, font: fonts.regular, color: MUTED });
    currentPage.drawText(`Página ${index + 1} de ${document.getPageCount()}`, { x: PAGE_WIDTH - 105, y: 20, size: 7, font: fonts.regular, color: MUTED });
  });

  document.setTitle(`Proposta ${proposalNumber}`);
  document.setAuthor('WG Hidráulica');
  document.setSubject(`Proposta comercial para ${request.empresa || request.cliente_nome}`);
  document.setCreationDate(issuedAt);

  return document.save();
}
