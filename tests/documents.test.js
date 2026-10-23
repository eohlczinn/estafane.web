import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readTabular, decodeText, splitDelimited } from "../server/services/tabularReader.js";
import { detectDocument } from "../server/services/documentDetector.js";
import { parsePages } from "../server/services/pdfParser.js";
import { reconcile } from "../shared/reconciliation.js";
import { classifyUnknownLine,rememberChange,undoChange } from "../shared/closingEdits.js";
import { mergeDocuments } from "../shared/grouping.js";
import { zipFiles } from "../src/services/zip.js";
import { inspectWorkbookArchive } from "../server/services/archiveGuard.js";
import { workbookBytes,textBytes,headerRows,amountRows,fixtureRows } from "./fixtures/documents.js";
async function temporary(bytes, run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),"estefane-test-"));
  const file = path.join(dir,"document.upload");
  try { await fs.writeFile(file,bytes);return await run(file); }
  finally { await fs.rm(dir,{recursive:true,force:true}); }
}
async function parse(bytes,format) {return temporary(bytes,async file => parsePages(await readTabular(file,format),{documentId:"fixture"}));}
it.each(["xlsx","xls","ods"])("lê %s real gerado e calcula 730,75 / -13,50 em centavos",async format => {
  const result = await parse(workbookBytes(format),format);
  const audit = reconcile(result);
  expect(result.fields.withdrawals.value).toBe(90000);
  expect(audit.calculation.expected).toBe(73075);
  expect(audit.calculation.difference).toBe(-1350);
  expect(audit.calculation.result).toBe("short");
  expect(result.fields.cash.source.sheet).toBe("Caixa");
  expect(result.fields.cash.source.cell).toContain("B7");
});
it.each([";",",","\t","|"])("CSV %s com decimal brasileiro e aspas",async delimiter => {
  const result = await parse(Buffer.from(textBytes(delimiter)),"csv");
  expect(result.fields.cash.value).toBe(128075);
  expect(reconcile(result).calculation.difference).toBe(-1350);
});
it("TXT estruturado mantém origem e valores negativos",async () => {
  const result = await parse(Buffer.from(textBytes(": ")) ,"txt");
  expect(result.fields.counted.value).toBe(71725);
  const negative = parsePages([{page:1,text:"Dinheiro: (20,00)\nPIX: 10,00-"}]);
  expect(negative.fields.cash.value).toBe(-2000); expect(negative.fields.pix.value).toBe(-1000);
  expect(reconcile(negative).canConfirm).toBe(false);
});
it("múltiplas abas complementares preservam localização e não duplicam subtotais",async () => {
  const r = await parse(workbookBytes("xlsx",[{name:"Identificacao",rows:headerRows},{name:"Financeiro",rows:amountRows}]),"xlsx");
  expect(r.fields.cash.source.sheet).toBe("Financeiro"); expect(r.fields.withdrawals.value).toBe(90000);
  expect(reconcile(r).calculation.difference).toBe(-1350);
});
it("células mescladas, linhas ocultas e cabeçalhos repetidos são auditáveis",async () => {
  const rows = [...fixtureRows,["Descricao","Valor"],["Descricao","Valor"]];
  const bytes = workbookBytes("xlsx",[{name:"Caixa",rows}],book => {
    book.Sheets.Caixa["!merges"] = [{s:{r:0,c:0},e:{r:0,c:3}}];
    book.Sheets.Caixa["!rows"] = [];book.Sheets.Caixa["!rows"][9] = {hidden:true};
  });
  const r = await parse(bytes,"xlsx");
  expect(r.fields.withdrawals.value).toBe(90000);
  expect(r.movements.find(m => m.amountCents === 40000).source.hidden).toBe(true);
  expect(r.unparsedLines).toHaveLength(0);
});
it("colunas identificadas associam valor correto e não confundem quantidade com total",async () => {
  const rows = [...headerRows,["Forma de pagamento","Quantidade","Valor"],["Dinheiro",1280,1280.75],["PIX",10,100.50]];
  const r = await parse(workbookBytes("xlsx",[{name:"Pagamentos",rows}]),"xlsx");
  expect(r.fields.cash.value).toBe(128075); expect(r.fields.pix.value).toBe(10050);expect(r.unparsedLines).toHaveLength(0);
});
it("tabela horizontal mantém identidade e bloqueia operadores/datas misturados",async () => {
  const rows = [["Data","Operadora","Caixa","Dinheiro","PIX"],["22/10/2026","Estefane",3,100,20],["23/10/2026","Ana",4,200,30]];
  const r = await parse(workbookBytes("xlsx",[{name:"Vendas",rows}]),"xlsx");
  expect(r.fields.operator.status).toBe("ambiguous");expect(r.fields.date.status).toBe("ambiguous");
  expect(r.fields.cash.value).toBeNull();expect(reconcile(r).canConfirm).toBe(false);
});
it("não executa fórmulas; resultados armazenados e ausentes exigem conferência",async () => {
  const cached = workbookBytes("xlsx",undefined,b => { b.Sheets.Caixa.B7 = {t:"n",v:1280.75,f:"SUM(1280,0.75)"}; });
  const r = await parse(cached,"xlsx");
  expect(r.fields.cash.value).toBe(128075);expect(r.extractionIssues.some(i => /armazenado/.test(i.message))).toBe(true);
  expect(reconcile(r).canConfirm).toBe(false);
  const missing = workbookBytes("xlsx",undefined,b => { b.Sheets.Caixa.B7 = {t:"n",f:"SUM(1,2)"}; });
  const m = await parse(missing,"xlsx");
  expect(m.fields.cash.value).toBeNull();expect(m.extractionIssues.some(i => /Fórmula sem/.test(i.message))).toBe(true);
});
it("informações decorativas não geram justificativas, movimentos desconhecidos sim",() => {
  const r = parsePages([{page:1,text:"CNPJ: 12.345.678/0001-00\nEmitido em 22/10/2026 - valor de referencia 10,00\n---\nAjuste especial: 12,34"}]);
  expect(r.unparsedLines).toHaveLength(1);expect(r.unparsedLines[0].value).toBe(1234);expect(r.unparsedLines[0].reason).toContain("contexto");
});
it("classificação manual recalcula, preserva origem e pode ser desfeita; perfil não atravessa layouts",() => {
  const p = parsePages([{page:1,text:"Ajuste especial: 12,34"}],{documentId:"test"});
  const doc = { ...p,id:"test",filename:"ficticio.txt",hash:"a".repeat(64),pages:[]};
  const c = mergeDocuments([doc],"closing-test"), line = c.unparsedLines[0];
  const next = rememberChange(c,classifyUnknownLine(c,line.id,"supplies",1234,"Conferido no original","movement"));
  expect(next.fields.supplies.value).toBe(1234);expect(next.history.some(h => h.kind === "classification")).toBe(true);
  const undone = undoChange(next);expect(undone.fields.supplies.value).toBeNull();expect(undone.resolutions[line.id]).toBeUndefined();
  const profile = {version:1,layoutKey:p.layoutKey,rules:[{label:line.label,field:"supplies"}]};
  const reused = parsePages([{page:1,text:"Ajuste especial: 22,34"}],{importProfiles:[profile]});
  expect(reused.fields.supplies.value).toBe(2234);expect(reconcile(reused).canConfirm).toBe(false);
  const other = parsePages([{page:1,text:"OUTRO RELATORIO\nAjuste especial: 22,34"}],{importProfiles:[profile]});expect(other.fields.supplies.value).toBeNull();
});
it("detecta UTF-16 e Windows-1252 sem aceitar texto binário ou HTML",() => {
  expect(decodeText(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from("Dinheiro: 10,00","utf16le")])).encoding).toBe("utf-16le");
  expect(decodeText(Buffer.from([0x61,0xe7,0xe3,0x6f])).text).toBe("ação");
  expect(() => decodeText(Buffer.from("<html>teste</html>"))).toThrow();expect(() => decodeText(Buffer.from([0,1,2]))).toThrow();
  expect(() => splitDelimited('"incompleto;',";")).toThrow();
});
it("valida assinatura, extensão e MIME sem confiar no nome",async () => {
  await temporary(Buffer.from("%PDF-falso"),async file => {
    await expect(detectDocument({path:file,originalname:"falso.xlsx",mimetype:"application/octet-stream"})).rejects.toThrow(/conteúdo/);
    await expect(detectDocument({path:file,originalname:"falso.pdf",mimetype:"image/png"})).rejects.toThrow(/declarado/);
  });
});
it("recusa ZIPs falsos, partes ativas e expansão acima do limite",async () => {
  const encoder = new TextEncoder();
  const zip = names => Buffer.from(zipFiles(names.map(name => ({name,bytes:encoder.encode("x")}))));
  await temporary(zip(["qualquer.txt"]),file => expect(inspectWorkbookArchive(file,"xlsx")).rejects.toThrow(/corresponde/));
  await temporary(zip(["xl/vbaProject.bin"]),file => expect(inspectWorkbookArchive(file,"xlsx")).rejects.toThrow(/macros/));
  const bomb = zip(["xl/workbook.xml"]); const central = bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bomb.writeUInt32LE(100 * 1024 * 1024,central + 24);
  await temporary(bomb,file => expect(inspectWorkbookArchive(file,"xlsx")).rejects.toThrow());
});
it("palavra entrada com complemento desconhecido não comprova suprimento",() => {
  const r = parsePages([{page:1,text:"Entrada conferida especial: 25,00"}]);
  expect(r.fields.supplies.value).toBeNull();expect(r.unparsedLines).toHaveLength(1);
});
it("vale-alimentação e vale-refeição somam modalidades, sem somar novamente o total",() => {
  const r = parsePages([{page:1,text:"Vale-alimentacao: 100,00\nVale-refeicao: 50,00\nVoucher: 150,00"}]);
  expect(r.fields.voucher.value).toBe(15000);expect(r.fields.voucher.breakdown).toHaveLength(2);
  expect(r.fields.voucher.sources.length).toBeGreaterThan(1);
});
it("despesa autorizada afeta apenas dinheiro físico e mantém a direção",() => {
  const r = parsePages([{page:1,text:textBytes(": ") + "\nDespesa autorizada: 10,00"}]);
  expect(r.fields.expenses.value).toBe(1000);expect(reconcile(r).calculation.expected).toBe(72075);
  expect(r.movements.find(m => m.type === "expense").direction).toBe("out");
});
it("adicionar item não substitui silenciosamente um total sem detalhamento",() => {
  const p=parsePages([{page:1,text:"Total de sangrias: 900,00\nAjuste especial: 25,00"}],{documentId:"test"});
  const c=mergeDocuments([{...p,id:"test",filename:"teste.txt",hash:"b".repeat(64),pages:[]}],"closing");
  expect(()=>classifyUnknownLine(c,c.unparsedLines[0].id,"withdrawals",2500,"Conferido no original","movement")).toThrow(/total/);
  expect(c.fields.withdrawals.value).toBe(90000);
});
it("rodapé com indício de dinheiro não é descartado como texto decorativo",() => {
  const p=parsePages([{page:1,text:"Emitido em 23/10/2026 - ajuste de dinheiro: 25,00"}]);
  expect(p.unparsedLines).toHaveLength(1);
});
it("rótulos após tabela horizontal não herdam colunas do cabeçalho anterior",async () => {
  const r=await parse(workbookBytes("xlsx",[{name:"Caixa",rows:[...headerRows,["Dinheiro","PIX","Total de vendas"],[1280.75,0,1280.75],["Fundo inicial",200],["Sangrias",900],["Suprimentos",150],["Devolucoes em dinheiro",0],["Dinheiro contado",717.25]]}]),"xlsx");
  expect(r.fields.opening.value).toBe(20000);expect(r.fields.cash.value).toBe(128075);expect(reconcile(r).calculation.difference).toBe(-1350);
});
