import { jsPDF } from "jspdf";
import { reportRows, closingReport } from "./report.js";
import { normalizePreferences } from "./preferences.js";
import { reportFilename } from "./preferences.js";
import { zipFiles } from "./zip.js";
export function createReport(
  fields,
  calc,
  preferences,
  paper = "a4",
  generated = new Date(),
) {
  const prefs = normalizePreferences(preferences),
    a4 = paper === "a4",
    width = a4 ? 210 : Number(paper);
  if (![210, 80, 58].includes(width)) throw Error("Formato de papel inválido.");
  const margin = a4 ? prefs.marginA4 : prefs.marginThermal,
    usable = width - margin * 2,
    probe = new jsPDF({ unit: "mm", format: "a4" }),
    font = a4 ? 10 : 8;
  const blocks = [];
  const plain=text=>String(text).replace(/−/g,'-').replace(/→/g,'>');
  function block(text, size = font, bold = false, options = {}) {
    probe.setFont("helvetica", bold ? "bold" : "normal");
    probe.setFontSize(size);
    const lines = probe.splitTextToSize(
      String(text).replace(/−/g, "-").replace(/→/g, ">"),
      usable,
    );
    const step = ((size * 25.4) / 72) * 1.35;
    blocks.push({
      lines,
      size,
      bold,
      step,
      height: lines.length * step + (options.gap ?? 2),
      ...options,
    });
  }
  if (prefs.includeMarket)
    block(
      fields.market?.value || prefs.market || "Estabelecimento não informado",
      a4 ? 16 : 11,
      true,
      { center: true, gap: 3 },
    );
  block(
    calc.reportTitle || "RELATÓRIO DE FECHAMENTO DE CAIXA",
    a4 ? 12 : 9,
    true,
    {
      center: true,
      gap: 5,
    },
  );
  for (const [label, value] of calc.rows || reportRows(fields, calc, prefs)) {
    if(a4&&label){
      const leftWidth=Math.min(60,usable*.42),step=font*25.4/72*1.35;
      probe.setFont('helvetica','normal');probe.setFontSize(font);
      const leftLines=probe.splitTextToSize(plain(label),leftWidth),rightBold=label==='Resultado'||/^[-−]?\s*R\$/.test(value);
      probe.setFont('helvetica',rightBold?'bold':'normal');
      const rightLines=probe.splitTextToSize(plain(value),usable-leftWidth-5);
      blocks.push({columns:true,leftLines,rightLines,leftWidth,rightBold,size:font,step,height:Math.max(leftLines.length,rightLines.length)*step+1,gap:1});
    }else block(
      label ? `${label}: ${value}` : value,
      !label ? (a4 ? 11 : 9) : font,
      !label || label === "Resultado",
      { heading: !label, gap: !label ? (a4 ? 2 : 3) : a4 ? 1 : 2 },
    );
  }
  if (prefs.signature) {
    block("________________________________", font, false, {
      center: true,
      gap: 1,
      before: 10,
    });
    block("Assinatura da responsável", a4 ? 9 : 7, false, {
      center: true,
      gap: 4,
    });
  }
  if (prefs.includeGenerationTime)
    block(
      `Gerado em ${generated.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      a4 ? 8 : 7,
      false,
      { center: true },
    );
  block(
    calc.partial
      ? "estefane-web · PARCIAL · Não totalmente validado"
      : "estefane-web · Fechamento conferido",
    a4 ? 8 : 7,
    false,
    {
      center: true,
    },
  );
  let logoHeight = 0,
    logoWidth = 0;
  if (prefs.includeMarket && prefs.logo) {
    const p = probe.getImageProperties(prefs.logo);
    logoHeight = a4 ? 15 : 11;
    logoWidth = (logoHeight * p.width) / p.height;
    if (logoWidth > usable * 0.75) {
      logoWidth = usable * 0.75;
      logoHeight = (logoWidth * p.height) / p.width;
    }
  }
  const height = a4
    ? 297
    : Math.min(
        5080,
        Math.max(
          90,
          Math.ceil(
            margin * 2 +
              logoHeight +
              (logoHeight ? 4 : 0) +
              blocks.reduce((sum, b) => sum + b.height + (b.before || 0), 0) +
              4,
          ),
        ),
      );
  const doc = new jsPDF({
    unit: "mm",
    format: [width, height],
    orientation: "portrait",
  });
  let y = margin;
  if (logoHeight) {
    doc.addImage(
      prefs.logo,
      prefs.logo.startsWith("data:image/png") ? "PNG" : "JPEG",
      (width - logoWidth) / 2,
      y,
      logoWidth,
      logoHeight,
    );
    y += logoHeight + 4;
  }
  for (let i = 0; i < blocks.length; i++) {
    const item = blocks[i],
      reserve = item.heading ? (blocks[i + 1]?.step || 0) + 4 : 0;
    if (
      a4 &&
      y + item.height + (item.before || 0) + reserve > height - margin
    ) {
      doc.addPage();
      y = margin;
    }
    y += item.before || 0;
    doc.setFont("helvetica", item.bold ? "bold" : "normal");
    doc.setFontSize(item.size);
    const lineCount=item.columns?Math.max(item.leftLines.length,item.rightLines.length):item.lines.length;
    for (let lineIndex=0;lineIndex<lineCount;lineIndex++) {
      if (y + item.step > height - margin) {
        doc.addPage();
        y = margin;
      }
      if(item.columns){
        doc.setFont('helvetica','normal');
        if(item.leftLines[lineIndex])doc.text(item.leftLines[lineIndex],margin,y+item.step*.78);
        doc.setFont('helvetica',item.rightBold?'bold':'normal');
        if(item.rightLines[lineIndex])doc.text(item.rightLines[lineIndex],margin+item.leftWidth+5,y+item.step*.78);
      }else doc.text(
        item.lines[lineIndex],
        item.center ? width / 2 : margin,
        y + item.step * 0.78,
        item.center ? { align: "center" } : {},
      );
      y += item.step;
    }
    y += item.gap ?? 2;
  }
  if(a4&&doc.getNumberOfPages()>1){const count=doc.getNumberOfPages();for(let page=1;page<=count;page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Página ${page} de ${count}`,width-margin,height-4,{align:'right'});}}
  return doc;
}
export function reportPDF(model, prefs, paper = "a4", generated = new Date()) {
  return createReport(
    { ...model.fields, market: { value: model.market } },
    {
      ...model.calc,
      rows: model.rows,
      reportTitle: model.title,
      partial: model.partial,
    },
    prefs,
    paper,
    generated,
  );
}
export function individualFilename(closing, prefs, paper, date = new Date()) {
  const register = String(closing.fields.register.value || "pendente").replace(
    /[^\w-]/g,
    "-",
  );
  return reportFilename(
    {
      ...prefs,
      filename: `${prefs.filename}-caixa-${register}-${closing.id.slice(-8)}`,
    },
    date,
    paper,
  );
}
export function individualReportArchive(closings, prefs, paper = prefs.paper) {
  const date = new Date();
  return zipFiles(
    closings.map((c) => ({
      name: individualFilename(c, prefs, paper, date),
      bytes: reportPDF(closingReport(c, prefs), prefs, paper, date).output(
        "arraybuffer",
      ),
    })),
  );
}
export async function saveIndividualReports(closings, prefs) {
  const bytes = individualReportArchive(closings, prefs),
    url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" })),
    link = document.createElement("a");
  link.href = url;
  link.download = reportFilename(
    { ...prefs, filename: prefs.filename + "-individuais" },
    new Date(),
    prefs.paper,
  ).replace(/\.pdf$/, ".zip");
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
