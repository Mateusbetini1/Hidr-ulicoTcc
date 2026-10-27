export const serviceLabels = {
  fabricacao: 'Fabricação', manutencao: 'Manutenção', reforma: 'Reforma',
  nao_sei: 'Preciso de orientação',
} as const;

export type Triage = {
  servico: keyof typeof serviceLabels;
  aplicacao: string;
  quantidade: string;
  medidas: string;
  problema: string;
  prazoDesejado: string;
};

export const emptyTriage: Triage = {
  servico: 'nao_sei', aplicacao: '', quantidade: '', medidas: '', problema: '', prazoDesejado: '',
};

export function parseTriage(value: unknown): Triage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Triagem inválida.');
  const input = value as Record<string, unknown>;
  if (typeof input.servico !== 'string' || !Object.hasOwn(serviceLabels, input.servico)) {
    throw new Error('Selecione um tipo de atendimento válido.');
  }
  const result = { servico: input.servico } as Triage;
  for (const field of ['aplicacao', 'quantidade', 'medidas', 'problema', 'prazoDesejado'] as const) {
    const max = field === 'quantidade' ? 80 : 250;
    if (typeof input[field] !== 'string' || input[field].length > max) {
      throw new Error('Confira os campos da triagem e o limite de caracteres.');
    }
    result[field] = input[field].trim();
  }
  return result;
}

export function pendingFields(data: Triage): string[] {
  return [
    ...(data.servico === 'nao_sei' ? ['Tipo de serviço'] : []),
    ...(!data.aplicacao ? ['Aplicação ou equipamento'] : []),
    ...(!data.quantidade ? ['Quantidade'] : []),
    ...(!data.medidas ? ['Medidas e identificação técnica'] : []),
    ...(data.servico !== 'fabricacao' && !data.problema ? ['Problema apresentado'] : []),
  ];
}

export function triageDescription(request: string, data: Triage): string {
  if (request.trim().length < 10 || request.length > 1000) throw new Error('Descreva sua necessidade em 10 a 1.000 caracteres.');
  const pending = pendingFields(data);
  return [
    'TRIAGEM COMERCIAL — dados revisados pelo cliente',
    `Necessidade: ${request.trim()}`,
    `Serviço: ${serviceLabels[data.servico]}`,
    `Aplicação/equipamento: ${data.aplicacao || 'Não informado'}`,
    `Quantidade: ${data.quantidade || 'A confirmar'}`,
    `Medidas/identificação: ${data.medidas || 'A confirmar com a equipe'}`,
    `Problema: ${data.problema || 'Não informado'}`,
    `Prazo desejado pelo cliente: ${data.prazoDesejado || 'Não informado'}`,
    `Pendências para análise: ${pending.join('; ') || 'Validar os dados técnicos com a equipe'}`,
    'Preço, compatibilidade e prazo de entrega dependem de avaliação da equipe WG.',
  ].join('\n');
}
