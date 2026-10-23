import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import {readTabular} from '../server/services/tabularReader.js';
import {readPDF} from '../server/services/pdfReader.js';
import {readImage} from '../server/services/imageReader.js';
import {parsePages} from '../server/services/pdfParser.js';
import {reconcile} from '../shared/reconciliation.js';

const file=ext=>new URL(`./fixtures/horizonte/relatorio_teste_caixa_estefane_02 (2).${ext}`,import.meta.url);
const text=await fs.readFile(file('txt'),'utf8');
const parse=text=>parsePages([{page:1,text}]);
const expected={cash:89540,pix:167820,debit:93050,credit:115075,voucher:23530,sales:489015,
  opening:18000,supplies:12000,withdrawals:75000,counted:45205,cancellations:13000,refunds:0,other:0};

it.each(['txt','csv','xlsx','pdf','png','jpg'])('reconhece o arquivo original enviado (%s), sem valores ou metadados manuais',async ext=>{
  const bytes=await fs.readFile(file(ext));
  const pages=ext==='pdf'?await readPDF(bytes):['png','jpg'].includes(ext)?await readImage(bytes,ext==='jpg'?'jpeg':ext):await readTabular(file(ext),ext);
  const p=parsePages(pages),audit=reconcile(p);
  for(const [key,value] of Object.entries(expected)) expect(p.fields[key].value,key).toBe(value);
  expect(p.fields.operator.value).toBe('Estefane');expect(p.fields.register.value).toBe('03');
  expect(p.fields.date.value).toBe('21/10/2026');expect(p.fields.shift.value).toBe('14:00 às 22:00');
  expect(p.fields.market.value.toLowerCase()).toBe('mercado horizonte (fictício)');
  expect(p.rules.cancellationTreatment).toBe('included');
  expect(p.unparsedLines).toEqual([]);
  expect(audit.calculation).toMatchObject({expected:44540,difference:665,paymentTotal:489015});
  if(['png','jpg'].includes(ext)) {
    expect(audit.issues).toHaveLength(1);expect(audit.issues[0].id).toContain(':ocr:');
    expect(audit.canConfirm).toBe(false);expect(p.fields.credit.source.bounds).toBeTruthy();
  } else {expect(audit.issues).toEqual([]);expect(audit.canConfirm).toBe(true);}
  if(ext==='xlsx') {expect(p.fields.cash.source.cell).toContain('C5');expect(p.fields.counted.source.sheet).toBe('Conferencia');}
},60000);

it('calcula outros números e nomes sem fixar o resultado ou a identidade do exemplo',()=>{
  const p=parse(text.replaceAll('895,40','995,40').replaceAll('4.890,15','4.990,15').replaceAll('5.020,15','5.120,15')
    .replaceAll('452,05','550,00').replace(/Horizonte/gi,'AURORA').replaceAll('Estefane','Ana Maria').replaceAll('21/10/2026','22/10/2026'));
  expect(reconcile(p).calculation).toMatchObject({expected:54540,difference:460,paymentTotal:499015,result:'over'});
  expect(p.fields.operator.value).toBe('Ana Maria');expect(p.fields.market.value).toContain('AURORA');
});
it('não ajusta números para forçar a soma dos pagamentos a fechar',()=>{
  const p=parse(text.replace('1.150,75','1.050,75'));
  expect(p.fields.credit.value).toBe(105075);expect(p.fields.other.value).toBeNull();
  expect(reconcile(p).issues.some(i=>i.id.includes('payment-breakdown'))).toBe(true);
});
it('não presume devolução zero em extrato incompleto ou com saída desconhecida',()=>{
  for(const t of [text.replace('04 | CONFERÊNCIA','OBSERVAÇÕES'),text.replace('Sangria 02 - recolhimento','Saída não identificada')]) {
    expect(parse(t).fields.refunds.value).toBeNull();expect(reconcile(parse(t)).canConfirm).toBe(false);
  }
});
it('lê CSV com colunas reordenadas, preserva metadados repetidos e detecta mistura de operadores',async()=>{
  const {splitDelimited}=await import('../server/services/tabularReader.js');
  const rows=splitDelimited(await fs.readFile(file('csv'),'utf8'),';');
  const order=[9,6,4,3,0,8,1,7,5,2];
  const p=parsePages([{page:1,text:'',lines:rows.map((row,i)=>({line:i+1,text:order.map(j=>row[j]).join('\t'),cells:order.map((j,k)=>({text:row[j]||'',cell:`${String.fromCharCode(65+k)}${i+1}`}))}))}]);
  expect(reconcile(p).calculation).toMatchObject({expected:44540,difference:665,result:'over'});
  rows[2][6]='Outra operadora';
  const mixed=parsePages([{page:1,text:'',lines:rows.map((r,i)=>({line:i+1,text:r.join('\t'),cells:r.map(text=>({text}))}))}]);
  expect(mixed.fields.operator.status).toBe('ambiguous');expect(reconcile(mixed).canConfirm).toBe(false);
});
