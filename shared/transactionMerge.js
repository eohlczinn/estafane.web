// A receipt ID identifies one sale inside a closing, even when the same sale is
// present in exports of different formats. Monetary field totals remain separate
// observations and are never added to these receipt records during the merge.
export function mergeTransactions(documents) {
  const transactions = [],
    groups = new Map(),
    issues = [],
    notes = [];
  for (const document of documents)
    for (const original of document.transactions || []) {
      const transaction = { ...original };
      transactions.push(transaction);
      if (!transaction.operationId) continue;
      const key = transaction.operationId.trim().toLocaleUpperCase("pt-BR");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ transaction, documentId: document.id });
    }
  for (const [key, records] of groups) {
    if (new Set(records.map((record) => record.documentId)).size < 2) continue;
    const signatures = new Set(
      records.map(
        ({ transaction }) => `${transaction.field}:${transaction.amountCents}`,
      ),
    );
    if (signatures.size > 1) {
      for (const { transaction } of records) {
        transaction.status = "conflict";
        delete transaction.duplicateOf;
      }
      issues.push({
        id: `receipts:conflict:${encodeURIComponent(key)}`,
        kind: "conflict",
        resolvable: false,
        message: `O cupom ${records[0].transaction.operationId} tem valores ou formas de pagamento diferentes em documentos do mesmo fechamento. Corrija as operações nos arquivos de origem e importe novamente antes de confirmar.`,
        source: records[0].transaction.source,
        sources: records.map(({ transaction }) => transaction.source),
        transactionIds: records.map(({ transaction }) => transaction.id),
      });
      continue;
    }
    const canonical =
      records.find(
        ({ transaction }) =>
          !transaction.duplicateOf && transaction.status !== "excluded",
      ) || records[0];
    for (const record of records) {
      if (record === canonical) continue;
      const transaction = record.transaction,
        previouslyRepeated = !!transaction.duplicateOf;
      transaction.duplicateOf = canonical.transaction.id;
      transaction.status = "excluded";
      if (!previouslyRepeated && record.documentId !== canonical.documentId)
        notes.push({
          code: "duplicate_receipt",
          severity: "info",
          message: `Cupom ${transaction.operationId} repetido em documentos do mesmo fechamento com a mesma forma e valor; contado uma única vez.`,
          source: transaction.source,
          originalSource: canonical.transaction.source,
        });
    }
  }
  return { transactions, issues, notes };
}
