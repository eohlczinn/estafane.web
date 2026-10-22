import yauzl from "yauzl";
import { DocumentError } from "./documentDetector.js";
// Inspect and stream every entry before any workbook parser can inflate it.
// No archive entry is written to disk. Both declared AND actual sizes are bounded.
export function inspectWorkbookArchive(filePath, format) {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error)
          return reject(
            new DocumentError("Planilha ZIP inválida ou corrompida."),
          );
        let total = 0,
          count = 0,
          streamed = 0,
          settled = false;
        const names = new Set();
        function fail(message) {
          if (settled) return;
          settled = true;
          zip.close();
          reject(new DocumentError(message));
        }
        zip.on("error", () =>
          fail("Estrutura da planilha inválida ou corrompida."),
        );
        zip.on("entry", (entry) => {
          total += entry.uncompressedSize;
          count++;
          if (
            count > 2000 ||
            total > 40 * 1024 * 1024 ||
            entry.uncompressedSize > 16 * 1024 * 1024 ||
            entry.uncompressedSize >
              Math.max(1024 * 1024, entry.compressedSize * 200)
          )
            return fail(
              "A planilha excede o limite de descompressão segura (40 MB / 2 mil partes).",
            );
          if (
            entry.isEncrypted() ||
            /(?:vbaProject|activeX|embeddings|externalLinks|Basic\/|Scripts\/)/i.test(
              entry.fileName,
            )
          )
            return fail(
              "Planilha protegida ou com macros, objetos ou vínculos externos não suportados. Exporte uma cópia somente com valores.",
            );
          if (names.has(entry.fileName))
            return fail(
              "A planilha contém partes repetidas e não pode ser interpretada com segurança.",
            );
          names.add(entry.fileName);
          if (/\/$/.test(entry.fileName)) return zip.readEntry();
          zip.openReadStream(entry, (err, stream) => {
            if (err)
              return fail("Não foi possível validar o conteúdo da planilha.");
            stream.on("error", () =>
              fail("Conteúdo comprimido inválido na planilha."),
            );
            stream.on("data", (chunk) => {
              streamed += chunk.length;
              if (streamed > 40 * 1024 * 1024) {
                stream.destroy();
                fail("A planilha excede o limite de descompressão segura.");
              }
            });
            stream.on("end", () => {
              if (!settled) zip.readEntry();
            });
          });
        });
        zip.on("end", () => {
          if (settled) return;
          if (
            format === "xlsx"
              ? !(
                  names.has("xl/workbook.xml") &&
                  names.has("[Content_Types].xml")
                )
              : !(names.has("content.xml") && names.has("mimetype"))
          )
            return fail(
              "O conteúdo da planilha não corresponde a " +
                format.toUpperCase() +
                ".",
            );
          settled = true;
          resolve();
        });
        zip.readEntry();
      },
    );
  });
}
