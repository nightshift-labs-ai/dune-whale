// dune-whale: make.fun ai-excited-01 entry.
// Validates entry.jpg and copies its bytes unchanged to <output>/entry.png.
// Node 22, standard library only, deterministic, no network.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1048576;

function fail(message: string): never {
  console.error(`dune-whale: ${message}`);
  process.exit(1);
}

const source = new URL('./entry.jpg', import.meta.url);

let bytes: Buffer;
try {
  bytes = readFileSync(source);
} catch (err) {
  fail(`cannot read ${source.pathname}: ${(err as Error).message}`);
}

if (bytes.length > MAX_BYTES) {
  fail(`entry.jpg is ${bytes.length} bytes, over the ${MAX_BYTES}-byte limit`);
}
if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
  fail('entry.jpg does not start with the JPEG magic bytes FF D8 FF');
}
if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
  fail('entry.jpg does not end with the JPEG end marker FF D9');
}

// Walk the JPEG segments up to the first SOF (start-of-frame) marker and read
// the frame's height and width. SOF markers are C0-CF except C4 (DHT),
// C8 (JPG, reserved) and CC (DAC).
const MAX_SIDE = 1024;

function isSof(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readFrameSize(data: Buffer): { width: number; height: number } {
  let pos = 2; // just past SOI (FF D8)
  while (pos < data.length) {
    if (data[pos] !== 0xff) fail(`malformed JPEG: expected a marker at byte ${pos}`);
    while (pos < data.length && data[pos] === 0xff) pos++; // skip fill bytes
    if (pos >= data.length) break;
    const marker = data[pos++];
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (marker === 0xd9 || marker === 0xda) break; // EOI or start of scan: no frame header before it
    if (pos + 2 > data.length) break;
    const length = data.readUInt16BE(pos);
    if (length < 2 || pos + length > data.length) fail(`malformed JPEG: bad segment length at byte ${pos}`);
    if (isSof(marker)) {
      if (length < 7) fail('malformed JPEG: SOF segment too short');
      return { height: data.readUInt16BE(pos + 3), width: data.readUInt16BE(pos + 5) };
    }
    pos += length;
  }
  fail('entry.jpg has no SOF (frame header) marker before the image data');
}

const { width, height } = readFrameSize(bytes);
if (width === 0 || height === 0) {
  fail(`entry.jpg has an invalid frame size ${width}x${height}`);
}
if (width > MAX_SIDE || height > MAX_SIDE) {
  fail(`entry.jpg is ${width}x${height}, larger than the ${MAX_SIDE}x${MAX_SIDE} limit`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const outFile = join(outDir, 'entry.png');
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, bytes);
console.log(`dune-whale: wrote ${bytes.length} bytes (${width}x${height} JPEG) to ${outFile}`);
