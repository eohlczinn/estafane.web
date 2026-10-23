export function sourceLocation(source = {}) {
  return [
    source.sheet ? `aba ${source.sheet}` : `pág. ${source.page || "?"}`,
    source.cell ? `célula ${source.cell}` : `linha ${source.line || "?"}`,
    source.hidden ? "inclui conteúdo oculto" : null,
  ]
    .filter(Boolean)
    .join(", ");
}
