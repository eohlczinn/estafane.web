import { normalize } from './parserRules.js';

// Section identity is evidence carried with a row, independent of file format.
export function sectionKind(text) {
  const n = normalize(text).replace(/^[\doil]+\s*(?:[|.)-]\s*|\s+)/, '').trim();
  if (/^(?:movimentacoes (?:do |de )?(?:dinheiro fisico|caixa)|dinheiro fisico)$/.test(n)) return 'physical';
  if (/^(?:conferencia(?: do caixa| informada pela operadora)?|contagem(?: do caixa)?)$/.test(n)) return 'count';
  if (/^(?:vendas(?: por forma de pagamento)?|pagamentos)$/.test(n)) return 'payments';
  if (/^(?:resumo(?: das vendas)?)$/.test(n)) return 'summary';
  return null;
}

export const metadataHeaders = {
  data:'date','data do movimento':'date','data de fechamento':'date',
  operador:'operator',operadora:'operator',caixa:'register',pdv:'register',
  turno:'shift',horario:'shift','horario / turno':'shift',
  estabelecimento:'market',empresa:'market',mercado:'market',
  'operadora / caixa':'operatorRegister','operador / caixa':'operatorRegister',
};

export function rowCells(row) {
  return row.cells || row.text.split(/\t+/).map(text => ({text,original:text}));
}
