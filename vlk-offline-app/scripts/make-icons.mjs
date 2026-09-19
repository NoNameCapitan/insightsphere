// Значки PWA створюються локально з коду: жодного зовнішнього завантаження
// і жодної графічної залежності. Запускати після зміни кольорів теми.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { root } from "./offline.mjs";

const background = [0x12, 0x6b, 0x62];
const foreground = [0xff, 0xff, 0xff];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// Хрест у центральних 60 % полотна — безпечна зона maskable-значка.
function pixels(size) {
  const rows = [];
  const arm = Math.round(size * 0.12);
  const reach = Math.round(size * 0.3);
  const center = size / 2;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x + 0.5 - center);
      const dy = Math.abs(y + 0.5 - center);
      const inCross = (dx <= arm && dy <= reach) || (dy <= arm && dx <= reach);
      const color = inCross ? foreground : background;
      row[1 + x * 3] = color[0];
      row[2 + x * 3] = color[1];
      row[3 + x * 3] = color[2];
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 біт на канал
  header[9] = 2; // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = join(root, "public", "icon-" + size + ".png");
  writeFileSync(file, png(size));
  console.log("Створено public/icon-" + size + ".png");
}
