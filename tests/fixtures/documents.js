import XLSX from "xlsx";
import { jsPDF } from "jspdf";
export const headerRows = [
  ["DOCUMENTO FICTICIO - TESTE"],
  ["Estabelecimento", "Mercado Ficticio"],
  ["Operadora", "Estefane"],
  ["Caixa", "03"],
  ["Data", "22/10/2026"],
];
export const amountRows = [
  ["Total de vendas", 1280.75],
  ["Dinheiro", 1280.75],
  ["Fundo inicial", 200],
  ["Suprimento 01", 150],
  ["Sangria 01", 400],
  ["Sangria 02", 500],
  ["Total de sangrias", 900],
  ["Devolucoes em dinheiro", 0],
  ["Dinheiro contado", 717.25],
];
export const fixtureRows = [...headerRows, ...amountRows];
export function workbookBytes(
  format = "xlsx",
  sheets = [{ name: "Caixa", rows: fixtureRows }],
  customize = () => {},
) {
  const book = XLSX.utils.book_new();
  for (const s of sheets)
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  customize(book);
  return XLSX.write(book, {
    type: "buffer",
    bookType: format === "xls" ? "biff8" : format,
    cellStyles: true,
  });
}
export function textBytes(delimiter = ";", rows = fixtureRows) {
  return rows
    .map((row) =>
      row
        .map((v) =>
          typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v),
        )
        .map((v) =>
          v.includes(delimiter) ? '"' + v.replace(/"/g, '""') + '"' : v,
        )
        .join(delimiter),
    )
    .join("\r\n");
}
export function pdfBytes(rows = fixtureRows) {
  const d = new jsPDF();
  d.setFontSize(11);
  d.text(textBytes(": ", rows).split("\r\n"), 15, 20);
  return d.output("arraybuffer");
}
