import { parsePages } from "./pdfParser.js";
import { normalize } from "./parserRules.js";
import { sectionKind } from "./documentStructure.js";

const identityKeys = ["market", "operator", "register", "date", "shift"];
const monetaryEvidence = /(?:R\$\s*[-\d]|\d[.,]\d{2}\b)/i;
const financialTitle =
  /^(?:(?:extrato|relatorio|movimento|fechamento|resumo)(?:\s+de)?\b.*(?:caixa|operador)|(?:fechamento|extrato)\s+(?:ID|n[ºo.]|numero)\b)/i;
const safeReference = (value) =>
  value && value.length <= 100 && /^[\w./-]+$/.test(value) ? value : null;

// Reuse the metadata parser; scope discovery never runs a second amount engine.
function inspectPage(page) {
  const rawLines =
    page.lines?.map((line) => line.text) ||
    String(page.text || "").split(/\r?\n/);
  const header = rawLines.filter((line) => line.trim()).slice(0, 16),
    norms = header.map(normalize);
  const parsed = parsePages([page], { documentId: "scope-probe" });
  const identity = Object.fromEntries(
    identityKeys.map((key) => [
      key,
      parsed.fields[key]?.value == null
        ? null
        : normalize(parsed.fields[key].value),
    ]),
  );
  let reference = null;
  // Explicit document identifiers outrank a possibly truncated decorative title.
  for (const line of header) {
    const match = line.match(
      /(?:^|\s)(?:documento|referencia(?: do fechamento)?|identificador do fechamento|ID do fechamento)\s*[:=#]\s*([\w./-]+)/i,
    );
    if (match && safeReference(match[1])) {
      reference = match[1];
      break;
    }
  }
  reference ||= parsed.identity?.closingReference;
  if (!reference)
    for (const line of header) {
      const title = line.match(
        /^(?:extrato(?: de movimentacao)?|relatorio|fechamento)\s+(?:de |do )?(?:caixa|operador)\s+([\w./-]+)\s*$/i,
      );
      if (title && /[a-z]/i.test(title[1]) && /\d/.test(title[1])) {
        reference = title[1];
        break;
      }
    }
  reference = safeReference(reference);
  const isFinancialTitle = norms.some((line) => financialTitle.test(line));
  const hasValues =
    monetaryEvidence.test(page.text || rawLines.join("\n")) ||
    parsed.movements.length > 0;
  const metadataCount = Object.values(identity).filter(Boolean).length;
  let contextKind = null;
  if (!isFinancialTitle) {
    if (
      norms
        .slice(0, 7)
        .some((line) =>
          /^(?:notas? (?:de auditoria|explicativas)|observacoes gerais|glossario|instrucoes de uso)\b/.test(
            line,
          ),
        )
    )
      contextKind = "audit_notes";
    else if (
      !rawLines.some((line) =>
        ["physical", "count", "payments", "transactions"].includes(
          sectionKind(line),
        ),
      ) &&
      norms
        .slice(0, 7)
        .some((line) =>
          /^(?:estoque|inventario|posicao (?:do |de )?estoque|relatorio (?:do |de )?estoque)\b/.test(
            line,
          ),
        )
    )
      contextKind = "inventory";
    else if (
      !hasValues &&
      norms
        .slice(0, 7)
        .some((line) =>
          /^(?:capa|sumario|indice|(?:mega\s+)?teste de fechamento|apresentacao)\b/.test(
            line,
          ),
        )
    )
      contextKind = "cover";
    else if (!reference && !hasValues && metadataCount < 2)
      contextKind = "informational";
  }
  return {
    reference: reference ? normalize(reference) : null,
    identity,
    isFinancialTitle,
    hasValues,
    metadataCount,
    contextKind,
    continuation: norms.some((line) =>
      /\bcontinuacao\b|\bcontinua\b/.test(line),
    ),
  };
}
function conflicts(first, next) {
  return identityKeys.some(
    (key) => first[key] && next[key] && first[key] !== next[key],
  );
}
function issueFor(page, message) {
  return {
    kind: "conflict",
    resolvable: false,
    message,
    source: {
      page: page.page,
      line: 1,
      text:
        page.lines?.[0]?.text ||
        page.text?.split(/\r?\n/)[0] ||
        "Cabeçalho do documento",
    },
  };
}

/** Partition physical pages by documented closing identity, preserving continuations. */
export function splitDocumentScopes(pages) {
  const scopes = [],
    contextPages = [];
  let current = null;
  for (const page of pages) {
    const observation = inspectPage(page);
    if (observation.contextKind) {
      contextPages.push({ ...page, contextKind: observation.contextKind });
      continue;
    }
    const referenceMatch =
      observation.reference &&
      scopes.find(
        (scope) =>
          scope.reference === observation.reference &&
          !conflicts(scope.identity, observation.identity),
      );
    if (referenceMatch) current = referenceMatch;
    else {
      const differentReference =
        observation.reference &&
        current?.reference &&
        observation.reference !== current.reference;
      const differentIdentity =
        current && conflicts(current.identity, observation.identity);
      const incompleteNewHeader =
        current &&
        observation.isFinancialTitle &&
        !observation.reference &&
        !observation.continuation &&
        observation.metadataCount < 4;
      const startsNew =
        !current ||
        differentReference ||
        differentIdentity ||
        incompleteNewHeader ||
        (observation.reference && !current.reference);
      if (startsNew) {
        const issues = [];
        const collision =
          observation.reference &&
          scopes.find((scope) => scope.reference === observation.reference);
        if (collision) {
          const message =
            "A mesma referência de fechamento aparece com identidades diferentes. Confira os documentos antes de emitir.";
          issues.push(issueFor(page, message));
          collision.issues.push(issueFor(page, message));
        }
        if (incompleteNewHeader)
          issues.push(
            issueFor(
              page,
              "Um novo cabeçalho de caixa não traz identidade suficiente para comprovar continuação. Este trecho foi mantido separado.",
            ),
          );
        current = {
          index: scopes.length + 1,
          reference: observation.reference,
          identity: { ...observation.identity },
          pages: [],
          issues,
        };
        scopes.push(current);
      }
    }
    current.pages.push(page);
    current.identity = Object.fromEntries(
      identityKeys.map((key) => [
        key,
        current.identity[key] || observation.identity[key],
      ]),
    );
    current.reference ||= observation.reference;
  }
  if (scopes.length > 1)
    for (const scope of scopes) {
      if (
        ["market", "operator", "register", "date"].some(
          (key) => !scope.identity[key],
        )
      )
        scope.issues.push(
          issueFor(
            scope.pages[0],
            "Este trecho do arquivo não traz identificação completa de estabelecimento, operador, caixa e data. Confira a identidade antes de associá-lo a outro fechamento.",
          ),
        );
    }
  return { scopes, contextPages };
}

export function scopePartLabel(pages) {
  const sheets = [...new Set(pages.map((page) => page.sheet).filter(Boolean))];
  if (sheets.length) return "aba " + sheets.join(", ");
  const numbers = pages.map((page) => page.page);
  if (numbers.length === 1) return "página " + numbers[0];
  const consecutive = numbers.every(
    (number, index) => !index || number === numbers[index - 1] + 1,
  );
  return (
    "páginas " +
    (consecutive ? numbers[0] + "–" + numbers.at(-1) : numbers.join(", "))
  );
}
