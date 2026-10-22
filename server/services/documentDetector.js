import fs from "node:fs/promises";
import {
  extensionOf,
  declaredFormatError,
} from "../../shared/documentFormats.js";
export class DocumentError extends Error {
  constructor(message) {
    super(message);
    this.name = "DocumentError";
    this.status = 422;
    this.failureKind = /não suportad|protegida|macros/i.test(message) ? "unsupported" : /limite|excede/i.test(message) ? "limit" : "invalid";
  }
}
export async function detectDocument(file) {
  const declared = declaredFormatError(file.originalname, file.mimetype);
  if (declared) throw new DocumentError(declared);
  const ext = extensionOf(file.originalname),
    handle = await fs.open(file.path, "r");
  let bytes;
  try {
    const b = Buffer.alloc(512);
    const { bytesRead } = await handle.read(b, 0, b.length, 0);
    bytes = b.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
  const hex = bytes.subarray(0, 8).toString("hex");
  const actual =
    bytes.subarray(0, 5).toString() === "%PDF-"
      ? "pdf"
      : hex === "d0cf11e0a1b11ae1"
        ? "xls"
        : bytes.length >= 4 &&
            bytes.subarray(0, 4).toString("hex") === "504b0304"
          ? "zip"
          : hex === "89504e470d0a1a0a"
            ? "png"
            : hex.startsWith("ffd8ff")
              ? "jpeg"
              : "text";
  const compatible =
    actual === "zip"
      ? ["xlsx", "ods"].includes(ext)
      : actual === "jpeg"
        ? ["jpg", "jpeg"].includes(ext)
        : actual === "text"
          ? ["csv", "txt"].includes(ext)
          : ext === actual;
  if (
    !bytes.length ||
    !compatible ||
    (actual === "text" &&
      bytes.includes(0) &&
      !hex.startsWith("fffe") &&
      !hex.startsWith("feff"))
  )
    throw new DocumentError(
      "O conteúdo não corresponde ao formato informado ou o arquivo está vazio.",
    );
  return ext === "jpg" ? "jpeg" : ext;
}
