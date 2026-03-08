/**
 * React Click-to-Source — Local Server
 *
 * Tiny HTTP server that receives file-open requests from the Chrome extension
 * and runs `cursor --goto <file>:<line>:<column>` to jump to the right spot.
 *
 * Usage:
 *   node server.js
 *   node server.js --port 3334   # optional custom port
 *
 * The server listens on localhost only (not exposed to the network).
 */

const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg !== -1 ? parseInt(args[portArg + 1], 10) : 3333;

// Candidate CLI paths for Cursor on macOS / Linux / Windows
const CURSOR_PATHS = [
  'cursor',
  '/usr/local/bin/cursor',
  '/usr/bin/cursor',
  `${process.env.HOME}/.local/bin/cursor`,
  // macOS app bundle CLI shim
  '/Applications/Cursor.app/Contents/MacOS/Cursor',
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function tryOpen(filePath, line, column, candidates, callback) {
  if (candidates.length === 0) {
    return callback(new Error('cursor CLI not found. Is Cursor installed and in PATH?'));
  }
  const [cmd, ...rest] = candidates;
  const gotoArg = `${filePath}:${line}:${column}`;
  execFile(cmd, ['--goto', gotoArg], (err) => {
    if (err) {
      tryOpen(filePath, line, column, rest, callback);
    } else {
      callback(null);
    }
  });
}

const server = http.createServer((req, res) => {
  // Always set CORS headers
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  // Health check (used by the popup to confirm the server is running)
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Open file
  if (req.method === 'POST' && req.url === '/open') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, headers);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { file, line = 1, column = 1 } = payload;

      if (!file || typeof file !== 'string') {
        res.writeHead(400, headers);
        res.end(JSON.stringify({ error: 'Missing "file" field' }));
        return;
      }

      const absFile = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

      console.log(`→ Opening  ${absFile}:${line}:${column}`);

      tryOpen(absFile, line, column, CURSOR_PATHS, (err) => {
        if (err) {
          console.error('✗', err.message);
          res.writeHead(500, headers);
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.writeHead(200, headers);
          res.end(JSON.stringify({ ok: true }));
        }
      });
    });
    return;
  }

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n⚛  React Click-to-Source server`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
