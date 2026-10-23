import { moneyRules, normalize, layoutLine } from './parserRules.js';
import { moneyTokens } from './movementExtractor.js';
import { sumCents } from '../../shared/movements.js';

// An explicitly enumerated payment section with its own total is a complete
// breakdown. A collection of isolated labelled amounts is not such evidence.
export function reconcilePaymentSection({lines,fields,assign,extractionIssues,documentId}) {
  const rows=lines.filter(l=>l.section==='payments' && moneyTokens(l.text).length);
  const totals=rows.filter(l=>moneyRules.sales.test(normalize(layoutLine(l.text))));
  if(!totals.length || fields.sales.value==null) return;
  const keys=['cash','pix','debit','credit','cards','voucher','other'];
  const details=rows.filter(l=>!totals.includes(l));
  const categories=details.map(l=>keys.find(k=>moneyRules[k].test(normalize(l.text))));
  if(!details.length || categories.some(k=>!k) || details.some(l=>moneyTokens(l.text).length!==1)) return;
  const covered=[...new Set(categories)];
  if(covered.some(k=>fields[k].value==null)) return;
  // Consolidated cards and their debit/credit breakdown describe the same money.
  const summed=covered.filter(k=>k!=='cards' || !(covered.includes('debit')&&covered.includes('credit')));
  const total=sumCents(summed.map(k=>fields[k].value));
  const row=totals[0],source={documentId,page:row.page,line:row.line,sheet:row.sheet,
    cell:row.cells?.map(c=>c.cell).filter(Boolean).join(', ')||null,bounds:row.bounds||null,
    text:rows.map(l=>l.text).join('\n'),profile:'formas-pagamento',confidence:row.confidence ?? 0.95};
  if(total!==fields.sales.value) {
    extractionIssues.push({id:`${documentId}:payment-breakdown`,source,kind:'conflict',resolvable:true,
      message:`A tabela de pagamentos soma ${total} centavos, mas o total líquido declara ${fields.sales.value}. Confira as linhas e o documento original.`});
    return;
  }
  if(fields.other.value==null) {
    assign('other',0,source,'Zero derivado: a tabela de pagamentos confere integralmente com o total líquido.');
    fields.other.status='derived';
  }
}
