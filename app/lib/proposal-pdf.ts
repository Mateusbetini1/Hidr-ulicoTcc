import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type { DadosProposta, ItemOrcamento, Solicitacao } from './supabase-dashboard';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const NAVY = rgb(7 / 255, 25 / 255, 67 / 255);
const YELLOW = rgb(1, 196 / 255, 0);
const MUTED = rgb(102 / 255, 112 / 255, 133 / 255);
const LINE = rgb(226 / 255, 229 / 255, 234 / 255);

type PdfFonts = { regular: PDFFont; bold: PDFFont };

function pdfText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '');
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
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

function drawLabelValue(page: PDFPage, fonts: PdfFonts, label: string, value: string, x: number, y: number, width: number) {
  page.drawText(label.toUpperCase(), { x, y, size: 7, font: fonts.bold, color: MUTED });
  const lines = wrapText(value || 'Não informado', fonts.regular, 9, width);
  lines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, { x, y: y - 15 - index * 11, size: 9, font: fonts.regular, color: NAVY });
  });
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

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, fonts, proposalNumber);
  let y = PAGE_HEIGHT - 150;

  drawLabelValue(page, fonts, 'Cliente', request.empresa || request.cliente_nome, MARGIN, y, 225);
  drawLabelValue(page, fonts, 'Responsavel', request.cliente_nome, 315, y, 120);
  drawLabelValue(page, fonts, 'Emissao', dateFormat.format(issuedAt), 460, y, 85);
  y -= 52;
  drawLabelValue(page, fonts, 'WhatsApp', request.whatsapp, MARGIN, y, 135);
  drawLabelValue(page, fonts, 'E-mail', request.email || 'Não informado', 205, y, 230);
  drawLabelValue(page, fonts, 'Valida ate', dateFormat.format(expiresAt), 460, y, 85);

  y -= 66;
  page.drawText('NECESSIDADE APRESENTADA', { x: MARGIN, y, size: 8, font: fonts.bold, color: MUTED });
  y -= 19;
  const descriptionLines = wrapText(request.descricao, fonts.regular, 9, PAGE_WIDTH - MARGIN * 2);
  descriptionLines.slice(0, 5).forEach((line) => {
    page.drawText(line, { x: MARGIN, y, size: 9, font: fonts.regular, color: NAVY });
    y -= 12;
  });

  y -= 18;
  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 18, width: PAGE_WIDTH - MARGIN * 2, height: 26, color: NAVY });
    page.drawText('ITEM', { x: MARGIN + 9, y: y - 9, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText('QTD.', { x: 365, y: y - 9, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText('UNITARIO', { x: 415, y: y - 9, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    page.drawText('SUBTOTAL', { x: 490, y: y - 9, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
    y -= 28;
  };
  drawTableHeader();

  let total = 0;
  for (const item of items) {
    const subtotal = Number(item.quantidade) * Number(item.valor_unitario);
    total += subtotal;
    const itemLines = wrapText(item.descricao, fonts.regular, 8, 290);
    const rowHeight = Math.max(30, itemLines.length * 11 + 12);

    if (y - rowHeight < 135) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page, fonts, proposalNumber);
      y = PAGE_HEIGHT - 145;
      drawTableHeader();
    }

    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: PAGE_WIDTH - MARGIN * 2, height: rowHeight, borderColor: LINE, borderWidth: .7 });
    itemLines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN + 9, y: y - 18 - index * 11, size: 8, font: fonts.regular, color: NAVY });
    });
    page.drawText(Number(item.quantidade).toLocaleString('pt-BR'), { x: 365, y: y - 18, size: 8, font: fonts.regular, color: NAVY });
    page.drawText(pdfText(money(Number(item.valor_unitario))), { x: 415, y: y - 18, size: 8, font: fonts.regular, color: NAVY });
    page.drawText(pdfText(money(subtotal)), { x: 490, y: y - 18, size: 8, font: fonts.bold, color: NAVY });
    y -= rowHeight;
  }

  y -= 16;
  page.drawRectangle({ x: 355, y: y - 32, width: 192, height: 42, color: YELLOW });
  page.drawText('VALOR TOTAL', { x: 369, y: y - 8, size: 8, font: fonts.bold, color: NAVY });
  page.drawText(pdfText(money(total)), { x: 455, y: y - 12, size: 14, font: fonts.bold, color: NAVY });
  y -= 58;

  const conditions = [
    ['Prazo de entrega', proposal.prazo_entrega || 'A combinar'],
    ['Condições de pagamento', proposal.condicoes_pagamento || 'A combinar'],
    ['Observações', proposal.observacoes || 'Sem observações adicionais'],
  ] as const;

  for (const [label, value] of conditions) {
    const lines = wrapText(value, fonts.regular, 8, PAGE_WIDTH - MARGIN * 2);
    const neededHeight = 24 + lines.length * 10;
    if (y - neededHeight < 55) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawHeader(page, fonts, proposalNumber);
      y = PAGE_HEIGHT - 145;
    }
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 7, font: fonts.bold, color: MUTED });
    y -= 14;
    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y, size: 8, font: fonts.regular, color: NAVY });
      y -= 10;
    });
    y -= 12;
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
