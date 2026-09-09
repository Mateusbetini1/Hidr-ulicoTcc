export const commercialStatusLabels = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  orcamento: 'Orçamento',
  negociacao: 'Negociação',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
} as const;

export type CommercialStatus = keyof typeof commercialStatusLabels;

export const funnelStatuses: CommercialStatus[] = [
  'novo',
  'em_atendimento',
  'orcamento',
  'negociacao',
];

export function isCommercialStatus(value: unknown): value is CommercialStatus {
  return typeof value === 'string' && value in commercialStatusLabels;
}

