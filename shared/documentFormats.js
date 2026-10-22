// Shared upload contract. Content validation remains mandatory on the server.
export const documentFormats = {
  pdf: ["application/pdf"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  xls: ["application/vnd.ms-excel"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
};
export const documentAccept = Object.keys(documentFormats).map(k => "." + k).join(",");
export const extensionOf = name => String(name).split(".").pop().toLowerCase();
export function declaredFormatError(name, mime) {
  const ext = extensionOf(name);
  if (!Object.hasOwn(documentFormats, ext)) return "Formato não suportado. Envie PDF, Excel, ODS, CSV, TXT, PNG ou JPEG.";
  const type = String(mime || "").split(";")[0].toLowerCase();
  if (type && type !== "application/octet-stream" && !documentFormats[ext].includes(type))
    return "O tipo declarado não corresponde à extensão do arquivo.";
  return null;
}
