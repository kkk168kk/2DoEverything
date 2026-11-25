#!/usr/bin/env node
// Minimal ASAR reader/writer-helper (no dependencies, pure Node.js >= 16).
//
// Usage:
//   node extract-asar.js list <app.asar> [filterSubstring]
//   node extract-asar.js dump <app.asar> <outDir> [--exclude <substring>]...
//
// Notes:
//   * Entries flagged "unpacked" live in <asar-dir>/app.asar.unpacked and are
//     skipped by dump (they are separate real files on disk).
//   * dump recreates the directory tree exactly as stored in the archive.
const fs = require('fs');
const path = require('path');

function readAsar(file) {
  const buf = fs.readFileSync(file);
  const headerSize = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  const root = JSON.parse(buf.slice(16, 16 + jsonLen).toString('utf8'));
  const dataStart = 8 + headerSize;
  return { buf, root, dataStart };
}

function walk(node, prefix, out) {
  for (const name of Object.keys(node.files)) {
    const entry = node.files[name];
    const p = prefix + '/' + name;
    if (entry.files) walk(entry, p, out);
    else out.push({ path: p, entry });
  }
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'list') {
  const file = args[1];
  const filter = args[2] || '';
  if (!file) {
    console.error('usage: node extract-asar.js list <app.asar> [filter]');
    process.exit(2);
  }
  const { root } = readAsar(file);
  const flat = [];
  walk(root, '', flat);
  const rows = flat
    .filter((x) => x.path.includes(filter))
    .sort((a, b) => a.path.localeCompare(b.path));
  for (const x of rows) {
    const size = String(x.entry.size).padStart(10);
    console.log(`${size}  ${x.entry.unpacked ? '[unpacked] ' : ''}${x.path}`);
  }
  console.log(`\n(total ${rows.length} matching / ${flat.length} files)`);
} else if (cmd === 'dump') {
  const file = args[1];
  const outDir = args[2];
  const excludes = [];
  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--exclude') excludes.push(args[++i]);
    else excludes.push(args[i]);
  }
  if (!file || !outDir) {
    console.error('usage: node extract-asar.js dump <app.asar> <outDir> [--exclude <substring>]...');
    process.exit(2);
  }
  const { buf, root, dataStart } = readAsar(file);
  const flat = [];
  walk(root, '', flat);
  let written = 0;
  let skipped = 0;
  let unpacked = 0;
  for (const x of flat) {
    if (excludes.some((s) => x.path.includes(s))) {
      skipped++;
      continue;
    }
    if (x.entry.unpacked) {
      unpacked++;
      continue;
    }
    const dest = path.join(outDir, x.path.replace(/^\/+/, ''));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const off = dataStart + Number(x.entry.offset);
    fs.writeFileSync(dest, buf.subarray(off, off + x.entry.size));
    written++;
  }
  console.log(
    `dumped ${written} files -> ${outDir} (skipped ${skipped}, unpacked ${unpacked}, total ${flat.length})`
  );
} else {
  console.error('unknown command; use: list | dump');
  process.exit(2);
}
