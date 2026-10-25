import { emptyFields, allFields } from "../../shared/fields.js";
import {
  splitFinancialPairs,
  financialAmountTokens,
} from "./financialObservations.js";
import {
  extractPaymentTransactions,
  reconcilePaymentTransactions,
} from "./paymentTransactions.js";
import { parseInventory, inventorySourceKey } from "./inventoryParser.js";
import { sectionKind } from "./documentStructure.js";
import {
  movementTotals,
  movementTypes,
  sumCents,
} from "../../shared/movements.js";
import { normalize, moneyRules, infoRules, layoutLine } from "./parserRules.js";
import { reconcileLedgerProfile } from "./ledgerProfile.js";
import { interpretTables } from "./tableInterpreter.js";
import { reconcilePaymentSection } from "./paymentProfile.js";
import { suggestCategories } from "./categorySuggestions.js";
import { createHash } from "node:crypto";
import { validateImportProfiles } from "../../shared/importProfiles.js";
import {
  extractMovements,
  moneyTokens,
  classifyEffect,
} from "./movementExtractor.js";

export function parsePages(
  inputPages,
  { documentId = "document", importProfiles = [] } = {},
) {
  const inventory = parseInventory(inputPages, { documentId });
  const excludedInventory = new Set(
    (inventory.excludedSources || []).map(inventorySourceKey),
  );
  const financialPages = inputPages.map((p) => {
    const lines = (
      p.lines || p.text.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }))
    ).filter(
      (l) =>
        !excludedInventory.has(
          inventorySourceKey({ ...l, page: p.page, sheet: p.sheet }),
        ),
    );
    return { ...p, lines, text: lines.map((l) => l.text).join("\n") };
  });
  const pages = interpretTables(financialPages);
  const layoutKey = createHash("sha256")
    .update(
      JSON.stringify(
        pages.map((p) => ({
          sheet: p.sheet || null,
          labels: p.lines
            .map((l) =>
              normalize(l.text).replace(/(?:r\$\s*)?-?\d[\d.,/]*/g, "#"),
            )
            .filter(Boolean),
        })),
      ),
    )
    .digest("hex");
  const profile = validateImportProfiles(importProfiles).find(
    (p) => p.layoutKey === layoutKey,
  );
  const fields = emptyFields(),
    warnings = [],
    declarations = [],
    unparsedLines = [],
    extractionIssues = [],
    voucherParts = new Map();
  const lines = pages.flatMap((p) =>
    (
      p.lines || p.text.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }))
    ).flatMap((l) => {
      const cells = splitFinancialPairs(l.text);
      return cells.map(({ text }, cell) => ({
        ...l,
        text: text.trim(),
        page: p.page,
        sheet: p.sheet,
        ocr: p.ocr,
        confidence: l.confidence ?? p.confidence,
        id: `${p.page}:${l.line}:${l.column || 0}:${cell}`,
      }));
    }),
  );
  const extracted = extractMovements(lines, documentId);
  const receipts = extractPaymentTransactions(lines, documentId);
  declarations.push(...extracted.declarations);
  function assign(key, value, source, original = source.text) {
    const candidate = {
      value,
      original,
      source,
      status: "recognized",
      review: true,
      confidence: source.confidence ?? 0.95,
      category: key,
    };
    if (fields[key].status === "ambiguous") {
      fields[key].candidates.push(candidate);
      return;
    }
    if (fields[key].value != null) {
      if (fields[key].value !== value) {
        fields[key] = {
          ...candidate,
          value: null,
          status: "ambiguous",
          candidates: [fields[key], candidate],
        };
        warnings.push(
          `Valores diferentes para ${allFields[key]}; confira o documento.`,
        );
      } else
        fields[key].sources = [
          ...(fields[key].sources || [fields[key].source]),
          source,
        ];
    } else fields[key] = candidate;
  }
  const identity = { closingReference: null, reportType: null };
  const reportTitles = [
    [/^(?:relacao de )?vendas (?:agrupadas )?por dia\b/, "Vendas por dia"],
    [
      /^(?:extrato de movimentacao|relatorio de movimento|movimento diario|movimentacoes) (?:do |de )?caixa\b/,
      "Movimentação física de caixa",
    ],
    [/^fechamento (?:de |do )?operador/, "Fechamento de operador"],
    [/^resumo (?:de |das )?vendas\b/, "Resumo de vendas"],
    [/^extrato (?:de |dos )?pagamentos\b/, "Extrato de pagamentos"],
    [/^(?:relatorio (?:de |das )?)?sangrias$/, "Relatório de sangrias"],
    [/^(?:relatorio (?:de |dos )?)?suprimentos$/, "Relatório de suprimentos"],
    [/^relatorio (?:de |dos )?cancelamentos$/, "Relatório de cancelamentos"],
    [
      /^relatorio (?:de |das )?(?:devolucoes|estornos)$/,
      "Devoluções e estornos",
    ],
  ];
  for (const line of lines) {
    const found = reportTitles.find(([pattern]) =>
      pattern.test(normalize(line.text)),
    );
    if (found) {
      identity.reportType = found[1];
      break;
    }
  }
  const explicitMarket = lines.some((l) =>
    /^estabelecimento\s*[:=\s]/.test(normalize(l.text)),
  );
  for (const line of lines) {
    let original = line.text;
    // An unlabelled establishment banner keeps its complete name. A labelled
    // metadata card takes precedence over a decorative document banner.
    if (
      /^(?:mercado|supermercado)\s+[^:=]+/i.test(original) &&
      !/^(?:mercado|supermercado)\s*[:=]/i.test(original)
    ) {
      if (explicitMarket) continue;
      original = "Estabelecimento: " + original.split(/[|\t]/)[0].trim();
    }
    const clean = layoutLine(original),
      n = normalize(clean);
    const source = {
      documentId,
      page: line.page,
      line: line.line,
      text: original,
      bounds: line.bounds || null,
      profile: clean === original ? "rotulos" : "tabela-numerada",
      sheet: line.sheet,
      cell:
        line.cells
          ?.filter((c) => c.text || c.unsafe)
          .map((c) => c.cell)
          .filter(Boolean)
          .join(", ") || null,
      original: line.originalText || original,
      hidden: !!line.hidden,
      confidence: line.ocr ? (line.confidence ?? 0.5) : 0.95,
      layoutKey,
    };
    const unsafe = line.cells?.filter((c) => c.unsafe) || [];
    if (unsafe.length)
      extractionIssues.push({
        id: `${documentId}:${line.id}:cell-review`,
        message: unsafe.map((c) => `${c.cell}: ${c.unsafe}`).join("; "),
        source,
        kind: "review",
        resolvable: true,
      });
    const reference = clean.match(
      /(?:\bDOCUMENTO\s*[:=#]\s*|^(?:ID do fechamento|Fechamento (?:ID|n[ºo.]|numero)|Identificador do fechamento)\s*[:=#]?\s*)([\w-]+)/i,
    );
    if (reference) {
      identity.closingReference = reference[1];
    }
    if (/^(?:relatorio|tipo do relatorio)\s*[:=]/.test(n)) {
      identity.reportType = clean.split(/[:=]/).slice(1).join(":").trim();
      continue;
    }
    if (
      extracted.consumed.has(line.id) ||
      receipts.consumed.has(line.id) ||
      line.section === "inventory" ||
      line.metadataHeader ||
      !clean ||
      (sectionKind(clean) && !/^dinheiro contado\b/.test(n))
    )
      continue;
    // Metadata columns may be separated by coordinates/tabs without colons.
    const header = Object.values(infoRules).some((rule) => rule.test(n))
      ? clean.split(
          /\s+(?=(?:Caixa|PDV|Data(?: do movimento| de fechamento)?|Turno|Hor[aá]rio|Operador(?:a|\(a\))?|Estabelecimento|Documento)(?:\s*[:=]\s*|\s+)\S)/i,
        )
      : [clean];
    let info = false;
    for (const cell of header) {
      const normalized = normalize(cell);
      for (const [key, rule] of Object.entries(infoRules)) {
        // Ignore an unlabelled market banner when a labelled establishment
        // exists; retain conflicting explicit metadata for the audit.
        if (
          key === "market" &&
          explicitMarket &&
          /^(?:mercado|supermercado)\s+[^:=]*\//.test(normalized)
        )
          continue;
        const match = normalized.match(rule);
        if (!match) continue;
        const prefix = normalized.slice(0, normalized.length - match[1].length);
        let value = /[:=|]/.test(prefix)
          ? cell.slice(cell.search(/[:=|]/) + 1).trim()
          : cell
              .split(/\s+/)
              .slice(prefix.trim().split(/\s+/).length)
              .join(" ");
        if (key === "date") {
          const d = value.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/),
            iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
          if (d) value = `${d[1]}/${d[2]}/${d[3]}`;
          else if (iso) value = `${iso[3]}/${iso[2]}/${iso[1]}`;
          else {
            warnings.push(
              `Data não reconhecida: página ${line.page}, linha ${line.line}.`,
            );
            info = true;
            break;
          }
          const [day, month, year] = value.split("/").map(Number),
            date = new Date(Date.UTC(year, month - 1, day));
          if (
            year < 1900 ||
            year > 2200 ||
            date.getUTCDate() !== day ||
            date.getUTCMonth() !== month - 1
          ) {
            warnings.push("Data inválida no documento.");
            info = true;
            break;
          }
          const time = cell.match(/\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
          if (time) assign("shift", time[0], source);
        }
        if (key !== "date") value = value.replace(/[|\t]\s*$/, "").trim();
        assign(key, value, source);
        info = true;
        break;
      }
    }
    if (info) continue;
    let recognized = false;
    for (const [key, rule] of Object.entries(moneyRules)) {
      if (
        !rule.test(n) ||
        (key === "cash" && /contado/.test(n)) ||
        (key === "cash" &&
          /^(?:dinheiro|especie|numerario)\s+liquid|disponivel|restante|apos.*(?:sangri|retirad|movimenta)/.test(
            n,
          )) ||
        (key === "cards" && /debito|credito/.test(n))
      )
        continue;
      let amounts = [];
      try {
        amounts = moneyTokens(clean);
      } catch {}
      if (!amounts.length) {
        amounts = financialAmountTokens(clean, { labelPattern: rule });
      }
      if (amounts.length === 1) {
        const subtype =
          key === "voucher" &&
          !/alimentacao.*refeicao|refeicao.*alimentacao/.test(n)
            ? /vale[- ]?alimentacao|ticket alimentacao/.test(n)
              ? "alimentacao"
              : /vale[- ]?refeicao/.test(n)
                ? "refeicao"
                : null
            : null;
        if (subtype) {
          const items = voucherParts.get(subtype) || [];
          items.push({ value: amounts[0].value, source, original });
          voucherParts.set(subtype, items);
          recognized = true;
          break;
        }
        assign(key, amounts[0].value, source);
        declarations.push({
          field: key,
          value: amounts[0].value,
          source,
          role: "declared_total",
          effect: classifyEffect(clean),
        });
        recognized = true;
      }
      break;
    }
    const informational =
      /^(?:pagina\s+\d|pag\.?\s*\d|emitido (?:em|por)|impress[ao]o (?:em|por)|cnpj\s*[:=]|cpf\s*[:=]|telefone\s*[:=]|versao do sistema\s*[:=])/.test(
        n,
      ) || /^[-_=*\s]+$/.test(clean);
    const financialContext =
      /\b(?:dinheiro|numerario|sangria|suprimento|pix|cartao|despesa|devolucao|estorno|cancelamento)\b/.test(
        n,
      );
    if (
      !recognized &&
      (!informational || financialContext) &&
      (/(?:R\$|\d,\d{2}\b)/.test(clean) ||
        (financialContext && /\d/.test(clean)))
    ) {
      const tokens = moneyTokens(clean);
      const label = normalize(
        clean
          .replace(
            /(?:-\s*)?(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}-?/g,
            "",
          )
          .replace(/[:=|\s]+$/, ""),
      );
      const saved = profile?.rules.find((r) => r.label === label);
      if (saved && tokens.length === 1) {
        assign(saved.field, tokens[0].value, {
          ...source,
          profile: "perfil-confirmado-v1",
        });
        extractionIssues.push({
          id: `${documentId}:${line.id}:profile-review`,
          message: `Confira a classificação sugerida pelo perfil: ${allFields[saved.field]}.`,
          source,
          kind: "review",
          resolvable: true,
        });
        continue;
      }
      unparsedLines.push({
        id: `${documentId}:${line.id}:unknown`,
        source,
        text: original,
        value: tokens.length === 1 ? tokens[0].value : null,
        label,
        layoutKey,
        suggestions: suggestCategories(clean),
        reason:
          tokens.length !== 1
            ? "Há vários valores ou um valor incompleto sem coluna financeira identificada."
            : "O contexto não comprova a categoria financeira deste valor.",
      });
      warnings.push(
        `Linha financeira não interpretada: página ${line.page}, linha ${line.line}.`,
      );
    }
  }
  if (voucherParts.size) {
    const parts = [...voucherParts.values()];
    if (parts.some((items) => new Set(items.map((i) => i.value)).size > 1)) {
      for (const item of parts.flat())
        assign("voucher", item.value, item.source, item.original);
    } else {
      const items = parts.map((p) => p[0]),
        total = sumCents(items.map((i) => i.value));
      assign(
        "voucher",
        total,
        {
          ...items[0].source,
          profile:
            items.length > 1 ? "vales-por-modalidade" : items[0].source.profile,
        },
        items.map((i) => i.original).join(" | "),
      );
      fields.voucher.breakdown = [...voucherParts].map(([kind, items]) => ({
        kind,
        value: items[0].value,
        sources: items.map((i) => i.source),
      }));
      declarations.push({
        field: "voucher",
        value: total,
        source: items[0].source,
        role: "declared_total",
      });
    }
  }
  const totals = movementTotals(extracted.movements);
  for (const key of new Set([
    ...Object.keys(totals),
    ...extracted.declarations.map((d) => d.field),
  ])) {
    const declared = extracted.declarations.filter((d) => d.field === key);
    if (totals[key] != null) {
      const items = extracted.movements.filter(
        (m) => movementTypes[m.type]?.field === key,
      );
      assign(
        key,
        totals[key],
        {
          ...items[0].source,
          profile: "soma-movimentacoes",
          movementIds: items.map((m) => m.id),
        },
        items.map((m) => m.source.text).join(" | "),
      );
    } else for (const d of declared) assign(key, d.value, d.source);
  }
  const effectFor = (key) => {
    const effects = [
      ...extracted.movements.filter(
        (m) => movementTypes[m.type]?.field === key,
      ),
      ...declarations.filter((d) => d.field === key),
    ]
      .filter((d) => (d.amountCents ?? d.value) > 0)
      .map((d) => d.effect);
    return effects.length && effects.every((e) => e && e === effects[0])
      ? effects[0]
      : null;
  };
  const rules = {
    automatic: true,
    confirmed: true,
    cashBasis: fields.netCash.value != null ? "net" : "gross",
    cancellationTreatment: effectFor("cancellations"),
    reversalTreatment: effectFor("reversals"),
    refundTreatment: effectFor("refunds"),
    voucherIncludedInOther: /vale.*incluido.*outros/.test(
      normalize(pages.map((p) => p.text).join("\n")),
    ),
  };
  reconcilePaymentTransactions({
    result: receipts,
    fields,
    assign,
    extractionIssues,
    documentId,
  });
  reconcileLedgerProfile({
    lines,
    fields,
    declarations,
    unparsedLines,
    rules,
    notes: extracted.issues,
    assign,
    documentId,
  });
  reconcilePaymentSection({
    lines,
    fields,
    assign,
    extractionIssues,
    documentId,
  });
  // Profile-recognized lines no longer need a generic extraction warning.
  const unknownSources = new Set(
    unparsedLines.map((l) => `${l.source.page}:${l.source.line}`),
  );
  const retainedWarnings = warnings.filter((w) => {
    const match = w.match(
      /^Linha financeira não interpretada: página (\d+), linha (\d+)\./,
    );
    return !match || unknownSources.has(`${match[1]}:${match[2]}`);
  });
  for (const page of pages.filter((p) => p.ocr))
    extractionIssues.push({
      id: `${documentId}:ocr:${page.page}`,
      kind: "review",
      resolvable: true,
      message:
        "Confira os valores desta página com a imagem original. A leitura por OCR não confirma valores financeiros automaticamente.",
      source: {
        documentId,
        page: page.page,
        sheet: page.sheet,
        line: 1,
        text: "Página lida por OCR",
        confidence: page.confidence ?? 0.5,
      },
    });
  const uniqueWarnings = retainedWarnings.filter(
    (w) => !w.startsWith("Linha financeira não interpretada:"),
  );
  if (unparsedLines.length)
    uniqueWarnings.push(
      `${unparsedLines.length} linha(s) financeira(s) foram encaminhadas à auditoria. Confira a situação atual na conferência.`,
    );
  const groupedIssues = new Map();
  for (const issue of extractionIssues) {
    const reason = issue.message.replace(/[A-Z]+\d+:\s*/g, "");
    const key = `${issue.source.page}:${reason}`;
    const previous = groupedIssues.get(key);
    if (previous) {
      previous.sources.push(issue.source);
      previous.count++;
    } else
      groupedIssues.set(key, { ...issue, sources: [issue.source], count: 1 });
  }
  const reviewIssues = [...groupedIssues.values()].map((i) =>
    i.count > 1
      ? {
          ...i,
          message: `${i.count} ocorrências nesta aba/página: ${i.message}`,
        }
      : i,
  );
  return {
    fields,
    movements: extracted.movements,
    declarations,
    unparsedLines,
    warnings: uniqueWarnings,
    extractionIssues: reviewIssues,
    layoutKey,
    normalizationNotes: [...extracted.issues, ...receipts.notes],
    transactions: receipts.transactions,
    inventory,
    documentKind:
      inventory.detected &&
      !Object.keys(moneyRules).some((k) => fields[k]?.value != null)
        ? "inventory"
        : "financial",
    rules,
    identity,
  };
}
