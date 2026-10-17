#!/usr/bin/env node
// Allocates the first free port in a range for each named service.
//
// Usage: node scripts/lib/ports.js <name>:<start>:<end> [<name>:<start>:<end> ...]
// Example: node scripts/lib/ports.js backend:3100:3199 frontend:3200:3299
// Output: one "NAME_PORT=<port>" line per service, in the order given.
// Exits non-zero if no port is available for any service.

const net = require('net');

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, () => {
      srv.close(() => resolve(true));
    });
    setTimeout(() => resolve(false), 800);
  });
}

async function firstFreePort(start, end) {
  for (let p = start; p <= end; p++) {
    if (await portFree(p)) return p;
  }
  return null;
}

async function main() {
  const specs = process.argv.slice(2);
  if (specs.length === 0) {
    console.error('usage: ports.js <name>:<start>:<end> [<name>:<start>:<end> ...]');
    process.exit(2);
  }

  const assigned = new Set();
  for (const spec of specs) {
    const parts = spec.split(':');
    if (parts.length !== 3) {
      console.error(`Invalid spec '${spec}'. Expected <name>:<start>:<end>`);
      process.exit(2);
    }
    const [name, startStr, endStr] = parts;
    const start = Number(startStr);
    const end = Number(endStr);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      console.error(`Invalid range for '${name}': ${startStr}-${endStr}`);
      process.exit(2);
    }

    let port = null;
    for (let p = start; p <= end; p++) {
      if (assigned.has(p)) continue;
      if (await portFree(p)) {
        port = p;
        break;
      }
    }
    if (port === null) {
      console.error(`No free port in range ${start}-${end} for '${name}'.`);
      process.exit(1);
    }
    assigned.add(port);
    console.log(`${name.toUpperCase()}_PORT=${port}`);
  }
}

main();
