const centsPerReal = BigInt(100);
const unitsPerQuantity = BigInt(1000);
const halfQuantityUnit = BigInt(500);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type QuoteItem = { quantidade: number; valor_unitario: number | null };

export function moneyToCents(value: number | null) {
  return BigInt(Math.round(Number(value) * Number(centsPerReal)));
}

export function quoteSubtotalCents(item: QuoteItem) {
  const quantity = BigInt(Math.round(Number(item.quantidade) * Number(unitsPerQuantity)));
  const product = quantity * moneyToCents(item.valor_unitario);
  // As quantidades são armazenadas em milésimos. Meio centavo arredonda para cima.
  return (product + halfQuantityUnit) / unitsPerQuantity;
}

export function quoteTotalCents(items: readonly QuoteItem[]) {
  return items.reduce((total, item) => total + quoteSubtotalCents(item), BigInt(0));
}

export function formatBrlCents(cents: bigint) {
  const fraction = String(cents % centsPerReal).padStart(2, '0');
  return brl.formatToParts(cents / centsPerReal)
    .map((part) => part.type === 'fraction' ? fraction : part.value)
    .join('');
}
