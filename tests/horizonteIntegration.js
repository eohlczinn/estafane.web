import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {app} from '../server/app.js';
import {createSessionToken,SESSION_COOKIE_NAME} from '../server/services/authService.js';
const remote=process.env.DOCUMENT_TEST_URL,server=remote?null:app.listen(0,'127.0.0.1');
if(server) await new Promise(r=>server.once('listening',r));
const url=remote||`http://127.0.0.1:${server.address().port}`;
let cookie=`${SESSION_COOKIE_NAME}=${createSessionToken({username:'fixture'})}`;
if(remote) {
  const env=Object.fromEntries((await fs.readFile('.env.railway','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]));
  const r=await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify({username:'estefane',password:env.ESTEFANE_LOGIN_PASSWORD})});
  assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
}
const headers={Cookie:cookie,Origin:url},proof=[];
try {
 for(const ext of ['pdf','xlsx','csv','txt','png','jpg']) {
  const bytes=await fs.readFile(new URL(`./fixtures/horizonte/relatorio_teste_caixa_estefane_02 (2).${ext}`,import.meta.url));
  const form=new FormData();form.append('pdf',new Blob([bytes]),'ficticio.'+ext);
  const started=Date.now();
  const r=await fetch(url+'/api/fechamento/analisar',{method:'POST',headers,body:form,signal:AbortSignal.timeout(150000)}),data=await r.json();
  assert.equal(r.status,200,JSON.stringify(data));
  for(const [key,value] of Object.entries({cash:89540,pix:167820,debit:93050,credit:115075,voucher:23530,sales:489015,opening:18000,supplies:12000,withdrawals:75000,counted:45205,refunds:0,other:0,cancellations:13000})) assert.equal(data.fields[key].value,value,ext+':'+key);
  assert.equal(data.fields.operator.value,'Estefane');assert.equal(data.fields.register.value,'03');assert.equal(data.fields.date.value,'21/10/2026');assert.equal(data.fields.shift.value,'14:00 às 22:00');
  assert.equal(data.calculation.expected,44540);assert.equal(data.calculation.difference,665);assert.equal(data.calculation.paymentTotal,489015);
  assert.equal(data.unparsedLines.length,0);
  const ocr=['png','jpg'].includes(ext);
  assert.equal(data.audit.issues.length,ocr?1:0);assert.equal(data.audit.canConfirm,!ocr);
  proof.push({format:ext,expected:data.calculation.expected,difference:data.calculation.difference,paymentTotal:data.calculation.paymentTotal,unknown:data.unparsedLines.length,review:ocr,durationMs:Date.now()-started});
  console.log(`OK ${ext.toUpperCase()}: todos os campos, identidade, pagamentos R$ 4.890,15; esperado R$ 445,40; sobra R$ 6,65${ocr?'; revisão OCR preservada':''}.`);
 }
 await fs.mkdir('tests/output',{recursive:true});
 await fs.writeFile(`tests/output/horizonte-${remote?'render':'local'}-proof.json`,JSON.stringify({url,checkedAt:new Date().toISOString(),files:proof},null,2));
} finally {server?.close();}
