import {it,expect} from 'vitest';
import fs from 'node:fs';
import {parsePages} from '../server/services/pdfParser.js';
import {explainClosing,documentOverview} from '../shared/closingInsights.js';
import {suggestCategories} from '../server/services/categorySuggestions.js';
const text=fs.readFileSync(new URL('./fixtures/horizonte/relatorio_teste_caixa_estefane_02 (2).txt',import.meta.url),'utf8');
const closing=(t=text)=>({...parsePages([{page:1,text:t}],{documentId:'test'}),pages:[{page:1,text:t,documentId:'test'}],resolutions:{}});
it('explica sobra, falta e caixa igual; não declara confirmação automática',()=>{
  const over=explainClosing(closing());expect(over.headline).toContain('6,65');expect(over.explanation).toContain('445,40');
  expect(over.provisional).toBe(false);expect(over.next).toContain('confirme');expect(over.cancellation).toContain('outra vez');
  expect(explainClosing(closing(text.replace('452,05','440,00'))).headline).toContain('Faltaram');
  expect(explainClosing(closing(text.replace('452,05','445,40'))).headline).toBe('O dinheiro confere');
});
it('divergência de pagamentos mantém resumo provisório e pendências explícitas',()=>{
  const p=explainClosing(closing(text.replace('1.150,75','1.050,75')));
  expect(p.provisional).toBe(true);expect(p.next).toContain('pendências');
  const missing=explainClosing(closing('Dinheiro: 12,00'));expect(missing.headline).toContain('faltam');
  const manual=closing();manual.rules={...manual.rules,automatic:false,deductCancellations:true};
  const explanation=explainClosing(manual);
  expect(explanation.steps.find(s=>s.key==='cancellations')).toMatchObject({sign:-1,value:13000});
  expect(explanation.cancellation).toBeNull();
});
it('mapeia todas as páginas, preserva origem e limita assuntos à estrutura do documento',()=>{
  const c=closing();c.pages.push({page:2,text:'02 | RESUMO DAS VENDAS\nValor desconhecido: 10,00',documentId:'outro'});
  const overview=documentOverview(c);
  expect(overview).toHaveLength(2);expect(overview[0].sections.length).toBeGreaterThan(2);expect(overview[0].financial).toBeGreaterThan(10);
  expect(overview[1].recognized).toBe(0);expect(overview[1].searchable).toContain('resumo');
});
it('sugere termos financeiros sem preencher valores ou autorizar conferência',()=>{
  expect(suggestCategories('Transferência para o cofre: R$ 10,00')[0].field).toBe('withdrawals');
  const p=closing('Reembolso especial: 10,00');expect(p.unparsedLines[0].suggestions[0].field).toBe('refunds');expect(p.fields.refunds.value).toBeNull();
  expect(suggestCategories('Código de referência')).toEqual([]);
});
it('continua colunas de tabelas entre páginas PDF, mas não entre abas de Excel',()=>{
  const first={page:1,text:'',lines:[{line:1,text:'Forma de pagamento\tQuantidade\tValor recebido'},{line:2,text:'Dinheiro\t19,00\t895,40'}]};
  const second={page:2,text:'',lines:[{line:1,text:'PIX\t31,00\t1678,20'}]};
  const p=parsePages([first,second]);expect(p.fields.pix.value).toBe(167820);expect(p.unparsedLines).toEqual([]);
  const sheets=parsePages([{...first,sheet:'Primeiro'},{...second,sheet:'Segundo'}]);expect(sheets.fields.pix.value).toBeNull();expect(sheets.unparsedLines).toHaveLength(1);
});
