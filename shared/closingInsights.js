import {moneyFields} from './fields.js';
import {formatMoney} from './money.js';
import {reconcile} from './reconciliation.js';

export function explainClosing(closing) {
  const audit=reconcile(closing),c=audit.calculation,f=closing.fields;
  const unresolved=audit.issues.length>0;
  const headline=c.difference==null?'Ainda faltam informações':c.difference>0?`Sobraram ${formatMoney(c.difference)}`:c.difference<0?`Faltaram ${formatMoney(Math.abs(c.difference))}`:'O dinheiro confere';
  const explanation=c.expected==null?'Ainda não há dados suficientes para calcular quanto deveria estar no caixa.':c.difference==null?`O esperado é ${formatMoney(c.expected)}. Informe o dinheiro contado para comparar.`:`Pelos valores informados, deveriam estar no caixa ${formatMoney(c.expected)}. A contagem foi de ${formatMoney(f.counted.value)}. ${c.difference===0?'Os dois valores são iguais.':c.difference>0?'Há dinheiro a mais na contagem.':'Há dinheiro a menos na contagem.'}`;
  const steps=[['opening',1,'Fundo inicial'],['cash',1,'Vendas em dinheiro'],['supplies',1,'Suprimentos'],['withdrawals',-1,'Sangrias'],['expenses',-1,'Despesas'],['refunds',-1,'Devoluções']]
    .filter(([key])=>f[key]?.value!=null && (key!=='refunds'||!['included','non_cash'].includes(closing.rules?.refundTreatment)))
    .map(([key,sign,label])=>({key,label,sign,value:f[key].value}));
  if(closing.rules?.cashBasis==='net')steps.splice(0,steps.length,{key:'netCash',label:'Saldo líquido declarado no documento',sign:1,value:f.netCash.value});
  else for(const [field,policy] of [['cancellations','cancellationTreatment'],['reversals','reversalTreatment']])
    if(closing.rules?.[policy]==='cash_out' && f[field].value!=null)steps.push({key:field,label:moneyFields[field],sign:-1,value:f[field].value});
  return {headline,explanation,steps,provisional:unresolved,issueCount:audit.issues.length,
    next:unresolved?`Confira ${audit.issues.length} ponto(s) abaixo. O resultado é provisório até resolver essas pendências.`:closing.confirmed?'Fechamento conferido. Você já pode salvar ou imprimir.':'Confira o documento original e confirme o fechamento para salvar ou imprimir.',
    cancellation:closing.rules?.cancellationTreatment==='included' && f.cancellations.value>0?'Os cancelamentos já estão descontados nas vendas. Não foram subtraídos outra vez.':null};
}

const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function documentOverview(closing) {
  const sources=Object.values(closing.fields||{}).flatMap(f=>f.sources||[f.source]).filter(Boolean);
  const unresolved=closing.unparsedLines||[];
  return (closing.pages||[]).map(p=>{
    const belongs=s=>s.page===p.page && (!p.documentId||s.documentId===p.documentId);
    const lines=p.lines||p.text.split(/\r?\n/).map((text,i)=>({text,line:i+1}));
    const sections=lines.filter(l=>/^(?:\d+\s*[|.)-]\s*)?(?:vendas por|resumo das|movimenta[cç][oõ]es|confer[eê]ncia|pagamentos|sangrias|suprimentos)\b/i.test(l.text.trim()) && !/\d,\d{2}/.test(l.text)).map(l=>({title:l.text.trim(),line:l.line})).slice(0,20);
    const financial=lines.filter(l=>/R\$\s*[-\d]|\d,\d{2}\b/.test(l.text)).length;
    return {page:p.page,documentId:p.documentId,filename:p.filename,sheet:p.sheet,ocr:p.ocr,sections,
      lines:lines.length,financial,recognized:sources.filter(belongs).length,
      unknown:unresolved.filter(l=>belongs(l.source)&&!closing.resolutions?.[l.id]?.reason).length,
      searchable:norm(p.text||'')};
  });
}
