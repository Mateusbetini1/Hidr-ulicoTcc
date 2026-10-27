# Análise da entrevista da WG Hidráulica

Análise realizada em 8 de outubro de 2026 a partir dos três áudios e dois vídeos enviados. Foram transcritas as faixas de áudio dos cinco arquivos e inspecionados quadros de ambos os vídeos. A transcrição automática contém erros em nomes e termos técnicos; os títulos da planilha foram conferidos visualmente quando legíveis. Não foi aberto o arquivo Excel original nem testadas suas fórmulas ou macros.

## Processo explicado

No áudio de 18/08/2026 às 12:14:45, o entrevistado relata que pedidos chegam por e-mail ao responsável pela produção. Esse responsável informa a demanda de cilindros; o entrevistado conhece as peças necessárias para cada cilindro, confere o estoque e identifica o que será necessário produzir. As instruções seguem para o operador, que também alimenta a planilha. O nome do responsável não foi confirmado com segurança pela transcrição automática.

Esse relato descreve o tratamento de pedidos na produção. Não esclarece se todos já são vendas confirmadas ou se alguma etapa também serve à elaboração de orçamentos comerciais.

## Estrutura visível da planilha

O vídeo de 17/08/2026 às 11:56:36 mostra campos de peça e quantidade, controles de registro e grupos de componentes. São legíveis grupos denominados FACA, ROLO, TILT e SERRA, com componentes como cabeçote, êmbolo, haste, fundo, niple e olhal. Há também referência a niple quadrado no grupo SERRA. Essas denominações devem ser validadas com a empresa antes de virar um catálogo do sistema.

Os vídeos mostram áreas de estoque real, estoque variável, solicitações de pedido e retirada do estoque. Células utilizam cores verde, amarela e vermelha, mas os limiares e regras das cores não foram confirmados.

## Estoque real e estoque variável

No vídeo de 17/08/2026 às 11:56:43, aproximadamente entre 5 e 37 segundos, o entrevistado distingue o estoque real do variável. No exemplo, existem 9 cabeçotes e são solicitados 10. O estoque variável passa a -1, sinalizando uma falta prevista, enquanto o real permanece em 9. Ele explica que o real é subtraído quando ocorre a retirada.

Na sequência, descreve o registro de produção de mais peças e seus efeitos nos saldos. A interpretação é que o estoque variável considera solicitações pendentes, enquanto o real representa as peças disponíveis fisicamente. Uma fórmula candidata seria estoque variável = estoque real - demanda pendente, mas ela precisa ser confirmada no Excel original, sobretudo para retiradas parciais, cancelamentos e solicitações simultâneas.

Assim, o material sustenta que já existe uma lógica de previsão de falta e distinção entre solicitação e retirada. Não sustenta afirmar que o controle é inteiramente manual ou que a empresa não consegue antecipar faltas. A entrada dos dados depende das pessoas; há comportamento calculado descrito pelo entrevistado.

## Histórico da empresa

O áudio de 17/08/2026 às 11:56:44 (1) relata a origem com dois professores do SENAI, aproximadamente em 2015–2016, inicialmente com manutenção de cilindros e serviços pontuais. O entrevistado associa o crescimento à atuação no setor florestal e à especialização em cilindros utilizados nesse setor. São informações de entrevista, sem verificação documental independente da data de fundação.

O áudio curto de 17/08/2026 às 11:56:44 informa que o modelo de controle foi desenvolvido internamente.

## Consequências para o TCC

O resumo fornecido anteriormente estava alinhado ao fluxo geral e à história, mas deixava em aberto uma distinção esclarecida pelos vídeos: o controle já considera demanda e movimentação de estoque separadamente.

O sistema web atual atende à frente comercial, enquanto a entrevista detalha principalmente a produção. É possível propor uma conexão futura entre essas frentes, mas a entrevista não justifica expandir automaticamente o projeto para substituir o controle de estoque.

Para a próxima etapa comercial, a IA pode coletar e organizar o pedido, identificar informações faltantes e encaminhar para análise humana. Não foram identificadas no material regras de precificação, tabela de preços, cálculo de custo ou agenda comercial. Valores e prazos não devem ser gerados a partir das quantidades de estoque mostradas.

## Questões ainda necessárias

- O pedido recebido por e-mail já é uma venda aprovada ou pode ser uma solicitação de orçamento?
- Como são definidos preços e prazos: tabela, composição de custos ou análise por pedido?
- Quais informações o cliente precisa fornecer para fabricação, reforma e manutenção?
- Como solicitações, retiradas parciais e cancelamentos afetam os saldos da planilha?
- A integração da produção ao painel comercial faz parte do escopo aprovado do TCC?

## Limites da análise

As imagens inspecionadas são amostras dos vídeos, não uma auditoria do Excel. A transcrição automática é apoio de interpretação e não deve ser usada como citação literal sem conferência. Não foram demonstrados erros de estoque, atrasos, perda de pedidos ou ausência de controle; esses problemas não podem ser apresentados como fatos apenas com este material.
