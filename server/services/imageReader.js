import { loadImage, createCanvas } from "@napi-rs/canvas";
import { recognizeBuffer } from "./ocrService.js";
import { DocumentError } from "./documentDetector.js";
function dimensions(bytes, format) {
  if (format === "png" && bytes.length >= 24)
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset++] !== 0xff) break;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    )
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    offset += length;
  }
  throw new DocumentError("Imagem inválida ou sem dimensões reconhecíveis.");
}
export async function readImage(bytes, format) {
  const [width, height] = dimensions(bytes, format);
  if (
    !width ||
    !height ||
    width * height > 4000000 ||
    Math.max(width, height) > 12000
  )
    throw new DocumentError(
      "A imagem excede o limite de 4 megapixels ou 12 mil pixels por lado.",
    );
  let image;
  try {
    image = await loadImage(bytes);
  } catch {
    throw new DocumentError("Imagem corrompida ou não suportada.");
  }
  const canvas = createCanvas(width, height),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);
  const result = await recognizeBuffer(canvas.toBuffer("image/png"));
  if (result.text.length > 250000)
    throw new DocumentError("Texto da imagem excede o limite de leitura.");
  return [
    {
      page: 1,
      text: result.text,
      ocr: true,
      confidence: result.confidence,
      lines: result.text
        .split(/\r?\n/)
        .map((text, i) => ({ text, line: i + 1, bounds: null })),
    },
  ];
}
