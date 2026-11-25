#!/usr/bin/env node
/**
 * repack-asar.js — rebuild an Electron app.asar from a source directory.
 *
 * Every packed entry of the ORIGINAL archive is kept byte-for-byte unless a
 * file with the same relative path exists under --src. Files present in --src
 * but missing from the archive are appended as new entries. Entries flagged
 * "unpacked" (native modules such as better-sqlite3) are left untouched and
 * keep pointing at app.asar.unpacked.
 *
 * Usage:
 *   node repack-asar.js --asar <orig app.asar> --src <dir> --out <new app.asar> [--dry-run]
 *
 * Example (Windows):
 *   node tools/repack-asar.js ^
 *     --asar "D:\app\resources\app.asar" ^
 *     --src  ".\app" ^
 *     --out  "D:\app\resources\app.asar.new"
 *
 * Then, with the app closed:
 *   move /Y app.asar app.asar.bak
 *   move /Y app.asar.new app.asar
 *
 * Requires only Node.js (no npm install). ASAR integrity is recomputed for
 * every replaced or added file (SHA256, 4 MiB blocks) so Electron's
 * integrity check keeps working.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BLOCK = 4 * 1024 * 1024;

function usage(msg) {
  if (msg) console.error('error: ' + msg);
  console.error('usage: node repack-asar.js --asar <orig> --src <dir> --out <new> [--dry-run]');
  process.exit(2);
}

function parseArgs(argv) {
  const o = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--asar') o.asar = argv[++i];
    else if (a === '--src') o.src = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '-h' || a === '--help') usage();
    else usage('unknown argument ' + a);
  }
  if (!o.asar || !o.src || !o.out) usage('--asar, --src and --out are required');
  return o;
}

function integrity(content) {
  const blocks = [];
  for (let i = 0; i < content.length; i += BLOCK) {
    blocks.push(
      crypto.createHash('sha256').update(content.subarray(i, Math.min(i + BLOCK, content.length))).digest('hex')
    );
  }
  return {
    algorithm: 'SHA256',
    hash: crypto.createHash('sha256').update(content).digest('hex'),
    blockSize: BLOCK,
    blocks,
  };
}

function walkTree(node, prefix, out) {
  for (const name of Object.keys(node.files)) {
    const entry = node.files[name];
    const p = prefix + '/' + name;
    if (entry.files) walkTree(entry, p, out);
    else out.push({ path: p, entry });
  }
}

function walkDisk(dir, prefix, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const p = prefix + '/' + name;
    const st = fs.statSync(full);
    if (st.isDirectory()) walkDisk(full, p, out);
    else out.push({ path: p, full, size: st.size });
  }
}

const opt = parseArgs(process.argv.slice(2));
const buf = fs.readFileSync(opt.asar);
const headerSize = buf.readUInt32LE(4);
const jsonLen = buf.readUInt32LE(12);
const root = JSON.parse(buf.slice(16, 16 + jsonLen).toString('utf8'));
const dataStart = 8 + headerSize;
const oldSize = buf.length;

const entries = [];
walkTree(root, '', entries);
const packed = entries
  .filter((x) => !x.entry.unpacked)
  .sort((a, b) => Number(a.entry.offset) - Number(b.entry.offset));
const unpackedCount = entries.length - packed.length;

// Files on disk (relative asar path -> absolute path)
const onDisk = [];
walkDisk(opt.src, '', onDisk);
const diskMap = new Map(onDisk.map((f) => [f.path, f]));

const replaced = [];
const added = [];
const chunks = [];
let pos = 0;

for (const x of packed) {
  const f = diskMap.get(x.path);
  let content;
  if (f) {
    content = fs.readFileSync(f.full);
    replaced.push({ path: x.path, from: Number(x.entry.size), to: content.length });
    x.entry.integrity = integrity(content);
    diskMap.delete(x.path);
  } else {
    const off = dataStart + Number(x.entry.offset);
    content = buf.subarray(off, off + Number(x.entry.size));
  }
  x.entry.offset = String(pos);
  x.entry.size = content.length;
  chunks.push(content);
  pos += content.length;
}

// New files: append after the last packed entry.
for (const f of diskMap.values()) {
  const parts = f.path.split('/').filter(Boolean);
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    node.files[parts[i]] = node.files[parts[i]] || { files: {} };
    node = node.files[parts[i]];
  }
  const content = fs.readFileSync(f.full);
  node.files[parts[parts.length - 1]] = {
    offset: String(pos),
    size: content.length,
    integrity: integrity(content),
  };
  added.push({ path: f.path, size: content.length });
  chunks.push(content);
  pos += content.length;
}

const dataBuf = Buffer.concat(chunks);
const jsonBuf = Buffer.from(JSON.stringify(root), 'utf8');
const pad = (4 - (jsonBuf.length % 4)) % 4;
const newHeaderSize = 8 + jsonBuf.length + pad;
const header = Buffer.alloc(8 + newHeaderSize);
header.writeUInt32LE(4, 0);
header.writeUInt32LE(newHeaderSize, 4);
header.writeUInt32LE(4 + jsonBuf.length + pad, 8);
header.writeUInt32LE(jsonBuf.length, 12);
jsonBuf.copy(header, 16);
Buffer.alloc(pad, 0x20).copy(header, 16 + jsonBuf.length);

const total = header.length + dataBuf.length;
console.log(`original : ${opt.asar} (${oldSize} bytes, ${packed.length} packed + ${unpackedCount} unpacked)`);
console.log(`source   : ${opt.src} (${onDisk.length} files)`);
console.log(`replaced : ${replaced.length}`);
if (replaced.length && replaced.length <= 40) {
  for (const r of replaced) console.log(`  ~ ${r.path}  ${r.from} -> ${r.to}`);
}
console.log(`added    : ${added.length}`);
for (const a of added) console.log(`  + ${a.path}  ${a.size}`);
console.log(`result   : ${total} bytes`);

if (opt.dryRun) {
  console.log('dry-run: nothing written');
} else {
  fs.writeFileSync(opt.out, Buffer.concat([header, dataBuf]));
  console.log(`written  : ${opt.out}`);
}
