#!/usr/bin/env node
/**
 * Cross-platform driver for the bash scripts (start/stop/status/logs/seed).
 *
 * Why this exists: `npm run start` etc. used to call `bash scripts/x.sh`,
 * which fails on Windows because `bash` is not on PATH by default. Node is
 * guaranteed to be present (you need it to run the app), so driving the same
 * bash scripts from Node works identically on Windows, macOS, and Linux.
 *
 * It locates a usable shell (Git Bash on Windows, /bin/sh or /bin/bash
 * elsewhere) and executes the target script with the same args, streaming
 * output live and propagating the exit code.
 */
const { spawn, spawnSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Candidate shells, in order of preference. On Windows Git Bash is the usual
// choice (it ships with Git for Windows); plain sh/bash may also exist.
const CANDIDATE_SHELLS = [
  // Explicit override always wins.
  process.env.HACKGB_SHELL,
  // Windows: Git Bash
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  'bash', // on PATH (WSL, cygwin, or manual Git Bash install)
  // Unix
  '/bin/bash',
  '/bin/sh',
].filter(Boolean);

function findShell() {
  for (const candidate of CANDIDATE_SHELLS) {
    // Absolute path with a backslash/slash — check it exists.
    if (candidate.includes(path.sep) || candidate.includes('/')) {
      if (existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    // Bare command — resolve via `where` (Windows) or `which` (unix).
    try {
      const r =
        process.platform === 'win32'
          ? spawnSync('where', [candidate], { stdio: ['ignore', 'pipe', 'ignore'] })
          : spawnSync('which', [candidate], { stdio: ['ignore', 'pipe', 'ignore'] });
      const out = (r.stdout ? r.stdout.toString() : '').trim();
      if (r.status === 0 && out) {
        return candidate; // let the shell resolve it
      }
    } catch {
      // ignore, try next
    }
  }
  return null;
}

const scriptName = process.argv[2];
if (!scriptName) {
  console.error('Usage: node scripts/lib/run-script.mjs <script.sh> [args...]');
  process.exit(1);
}
const scriptPath = path.isAbsolute(scriptName)
  ? scriptName
  : path.join(PROJECT_ROOT, scriptName);

if (!existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`);
  process.exit(1);
}

const shell = findShell();
if (!shell) {
  console.error(
    [
      'Could not find a usable shell to run the stack scripts.',
      '',
      'On Windows, install Git for Windows (which includes Git Bash):',
      '  https://git-scm.com/download/win',
      'Then re-run the command. Or point us at bash explicitly:',
      '  set HACKGB_SHELL="C:\\Program Files\\Git\\bin\\bash.exe"   (cmd)',
      '  $env:HACKGB_SHELL="C:\\Program Files\\Git\\bin\\bash.exe"   (powershell)',
    ].join('\n'),
  );
  process.exit(1);
}

// Pass the script as an absolute path so relative `source` inside works.
const args = [scriptPath, ...process.argv.slice(3)];

console.error(`[hackgb] running: ${shell} ${args.join(' ')}  (cwd: ${PROJECT_ROOT})`);
const child = spawn(shell, args, {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  // Windows: the bash script path may contain spaces (Program Files) — spawn
  // handles quoting for us. No shell needed.
  shell: false,
});

child.on('error', (err) => {
  console.error('Failed to start shell script:', err.message);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code == null ? 0 : code);
});
