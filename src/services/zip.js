// Minimal ZIP STORE writer: UTF-8 filenames, CRC-32 and an explicit central directory.
const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
function header(size, values) {
  const bytes = new Uint8Array(size),
    view = new DataView(bytes.buffer);
  for (const [offset, value, width] of values)
    width === 2
      ? view.setUint16(offset, value, true)
      : view.setUint32(offset, value, true);
  return bytes;
}
export function zipFiles(files) {
  let offset = 0;
  const chunks = [],
    directory = [];
  for (const file of files) {
    const name = encoder.encode(file.name),
      bytes = new Uint8Array(file.bytes),
      crc = crc32(bytes);
    const local = header(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x800, 2],
      [8, 0, 2],
      [14, crc, 4],
      [18, bytes.length, 4],
      [22, bytes.length, 4],
      [26, name.length, 2],
    ]);
    chunks.push(local, name, bytes);
    directory.push(
      header(46, [
        [0, 0x02014b50, 4],
        [4, 20, 2],
        [6, 20, 2],
        [8, 0x800, 2],
        [10, 0, 2],
        [16, crc, 4],
        [20, bytes.length, 4],
        [24, bytes.length, 4],
        [28, name.length, 2],
        [42, offset, 4],
      ]),
      name,
    );
    offset += local.length + name.length + bytes.length;
  }
  const directorySize = directory.reduce((s, c) => s + c.length, 0),
    end = header(22, [
      [0, 0x06054b50, 4],
      [8, files.length, 2],
      [10, files.length, 2],
      [12, directorySize, 4],
      [16, offset, 4],
    ]);
  const result = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const c of [...chunks, ...directory, end]) {
    result.set(c, at);
    at += c.length;
  }
  return result;
}
