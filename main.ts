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

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const outFile = join(outDir, 'entry.png');
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, bytes);
console.log(`dune-whale: wrote ${bytes.length} bytes to ${outFile}`);
