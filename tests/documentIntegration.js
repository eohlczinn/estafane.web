import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { app } from "../server/app.js";
import { stopBatches } from "../server/services/batchAnalyzer.js";
import { createSessionToken,SESSION_COOKIE_NAME } from "../server/services/authService.js";
import { workbookBytes,textBytes,pdfBytes,fixtureRows } from "./fixtures/documents.js";
const remote = process.env.DOCUMENT_TEST_URL;
const server = remote ? null : app.listen(0,"127.0.0.1");
if (server) await new Promise(r => server.once("listening",r));
const url = remote || `http://127.0.0.1:${server.address().port}`;
let cookie;
if (remote) {
  // Credentials are local only; never printed, committed or copied into fixtures.
  const env = Object.fromEntries((await fs.readFile(".env.railway","utf8")).split(/\r?\n/).filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
  const login = await fetch(url + "/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json",Origin:url},body:JSON.stringify({username:"estefane",password:env.ESTEFANE_LOGIN_PASSWORD})});
  assert.equal(login.status,200);cookie=login.headers.get("set-cookie").split(";")[0];
} else cookie = `${SESSION_COOKIE_NAME}=${createSessionToken({username:"fixture"})}`;
const headers = {Cookie:cookie,Origin:url};
const single = async (name,bytes,type = "application/octet-stream") => {
  const form = new FormData();form.append("pdf",new Blob([bytes],{type}),name);
  const response = await fetch(url + "/api/fechamento/analisar",{method:"POST",body:form,headers,signal:AbortSignal.timeout(150000)});
  const body = await response.json(); return {response,body};
};
const batch = async files => {
  const form = new FormData();files.forEach(([name,bytes]) => form.append("pdfs",new Blob([bytes],{type:"application/octet-stream"}),name));
  const response = await fetch(url + "/api/fechamento/analisar-lote",{method:"POST",body:form,headers});
  assert.equal(response.status,202); let result = await response.json();const deadline=Date.now()+150000;
  while (result.status === "processing") {
    assert.ok(Date.now()<deadline,"Lote não finalizou dentro do limite");
    await new Promise(r => setTimeout(r,200));
    const r=await fetch(url + "/api/fechamento/lotes/"+result.id,{headers});assert.equal(r.status,200);result=await r.json();
  }
  return result;
};
try {
  for (const format of ["xlsx","xls","ods","csv","txt","pdf"]) {
    const bytes = format === "pdf" ? pdfBytes() : ["csv","txt"].includes(format) ? textBytes(format === "csv" ? ";" : ": ") : workbookBytes(format);
    const {response,body}=await single("ficticio."+format,bytes);
    assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.format,format);
    assert.equal(body.calculation.expected,73075);assert.equal(body.calculation.difference,-1350);assert.equal(body.fields.withdrawals.value,90000);
    console.log(`OK: ${format.toUpperCase()} pela API real, esperado 730,75; diferença -13,50.`);
  }
  const mixed=await batch([["caixa.xlsx",workbookBytes()],["mesmo-renomeado.xlsx",workbookBytes()],["planilha.ods",workbookBytes("ods")],["relatorio.csv",textBytes()],["invalido.xlsx","isto nao e Excel"]]);
  assert.equal(mixed.documents.filter(d=>d.status==="error").length,1);assert.equal(mixed.documents.filter(d=>d.status==="duplicate").length,1);
  assert.equal(mixed.closings.length,3);assert.ok(mixed.closings.every(c=>c.calculation.difference===-1350));
  console.log("OK: lote misto, arquivo inválido isolado, duplicado renomeado não somado.");
  const sheets = await batch([["dois-caixas.xlsx",workbookBytes("xlsx",[
    {name:"Caixa03",rows:fixtureRows}, {name:"Caixa04",rows:fixtureRows.map(row=>row[0]==="Caixa"?["Caixa","04"]:row)},
  ])]]);
  assert.equal(sheets.closings.length,2);assert.deepEqual(sheets.closings.map(c=>c.fields.register.value).sort(),["03","04"]);
  assert.ok(sheets.closings.every(c=>c.fields.withdrawals.value===90000));
  console.log("OK: planilha com dois caixas em abas independentes gera dois fechamentos, sem mistura.");
  if (!remote) {
    const other={Cookie:`${SESSION_COOKIE_NAME}=${createSessionToken({username:"fixture"})}`};
    assert.equal((await fetch(url+"/api/fechamento/lotes/"+mixed.id,{headers:other})).status,404);
    assert.equal((await fetch(url+"/api/fechamento/lotes/"+mixed.id,{method:"DELETE",headers:other})).status,404);
    console.log("OK: outra sessão do mesmo usuário não lê nem cancela lote alheio.");
    const previous=process.env.REQUIRE_AUTH;process.env.REQUIRE_AUTH="true";
    try {assert.equal((await fetch(url+"/api/health")).status,401);}finally { if(previous===undefined)delete process.env.REQUIRE_AUTH;else process.env.REQUIRE_AUTH=previous; }
    for (const format of ["png","jpeg"]) {
      const canvas=createCanvas(1600,1500),ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,1600,1500);ctx.fillStyle="black";ctx.font="36px Arial";
      textBytes(": ").split("\r\n").forEach((line,i)=>ctx.fillText(line,40,65+i*75));
      const bytes=canvas.toBuffer("image/"+format),{response,body}=await single("imagem."+format,bytes,"image/"+format);
      assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.ocr,true);assert.equal(body.fields.cash.value,128075);assert.equal(body.fields.counted.value,71725);
      assert.ok(body.extractionIssues.some(i=>i.id.includes(":ocr:")));assert.equal(body.audit.canConfirm,false);
      console.log(`OK: ${format.toUpperCase()} passa por OCR local real; confirmação permanece bloqueada até conferência.`);
    }
    for (const [name,bytes] of [["protegida.xlsx",Buffer.from("d0cf11e0a1b11e1","hex")],["falso.png",Buffer.from("nao e uma imagem")]])
      assert.equal((await single(name,bytes)).response.status,400);
  }
  console.log("OK: validação de documentos concluída em " + (remote ? "produção (somente fixtures fictícias)" : "servidor local"));
} finally { if(server){await stopBatches();server.close();} }
