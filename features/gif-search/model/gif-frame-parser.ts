export function countGifFrames(bytes: Uint8Array) {
  let offset = 0;
  let count = 0;
  function skip(length: number) {
    if (offset + length > bytes.length) throw new Error("Truncated GIF");
    offset += length;
  }
  function byte() { skip(1); return bytes[offset - 1]; }
  function subblocks() {
    for (let length = byte(); length !== 0; length = byte()) skip(length);
  }
  skip(13);
  const signature = String.fromCharCode(...bytes.subarray(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a") throw new Error("Not a GIF");
  if (bytes[10] & 0x80) skip(3 * 2 ** ((bytes[10] & 7) + 1));
  while (offset < bytes.length) {
    const marker = byte();
    if (marker === 0x3b) {
      if (count === 0) throw new Error("No image frames");
      return count;
    }
    if (marker === 0x21) {
      skip(1);
      subblocks();
    } else if (marker === 0x2c) {
      skip(8);
      const packed = byte();
      if (packed & 0x80) skip(3 * 2 ** ((packed & 7) + 1));
      skip(1);
      subblocks();
      count += 1;
    } else throw new Error("Invalid GIF block");
  }
  throw new Error("Missing GIF trailer");
}
