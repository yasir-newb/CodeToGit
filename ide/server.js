/**
 * TophHub C++ IDE — Local Node.js Development Server
 * Serves the IDE on localhost:3000 with optional local C++ compilation.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const IDE_DIR = __dirname;
const ROOT_DIR = path.resolve(__dirname, '..');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.cpp': 'text/plain',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Local Compilation API Endpoint: POST /api/compile
  if (req.method === 'POST' && pathname === '/api/compile') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { code, stdin } = JSON.parse(body);
        handleCompile(code, stdin, res);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static File Serving
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(IDE_DIR, relativePath);

  // If not found in ide/, check in root project directory
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT_DIR, relativePath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

function handleCompile(code, stdin, res) {
  // Check if local g++ compiler exists
  let hasGpp = false;
  try {
    execSync('g++ --version', { stdio: 'ignore' });
    hasGpp = true;
  } catch (e) {
    hasGpp = false;
  }

  if (!hasGpp) {
    // Fallback: Proxy to Piston Cloud Compiler API
    const https = require('https');
    const payload = JSON.stringify({
      language: 'cpp',
      version: '10.2.0',
      files: [{ name: 'solution.cpp', content: code }],
      stdin: stdin || ''
    });

    const options = {
      hostname: 'emkc.org',
      port: 443,
      path: '/api/v2/piston/execute',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const clientReq = https.request(options, clientRes => {
      let data = '';
      clientRes.on('data', chunk => { data += chunk; });
      clientRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const run = parsed.run || {};
          const compile = parsed.compile || {};
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            stdout: (run.stdout || '').trim(),
            stderr: (compile.stderr || run.stderr || '').trim(),
            exitCode: run.code || 0
          }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed parsing compiler response' }));
        }
      });
    });

    clientReq.on('error', err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    clientReq.write(payload);
    clientReq.end();
    return;
  }

  // Local compilation via g++
  const tempDir = path.join(ROOT_DIR, 'scratch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempSrc = path.join(tempDir, `temp_${Date.now()}.cpp`);
  const tempExe = path.join(tempDir, `temp_${Date.now()}.exe`);
  fs.writeFileSync(tempSrc, code, 'utf8');

  exec(`g++ -O2 -std=c++20 "${tempSrc}" -o "${tempExe}"`, (compileErr, stdout, stderr) => {
    if (compileErr) {
      cleanupFiles([tempSrc, tempExe]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ stderr: stderr || compileErr.message, stdout: '', exitCode: 1 }));
      return;
    }

    const runProc = exec(`"${tempExe}"`, (runErr, runStdout, runStderr) => {
      cleanupFiles([tempSrc, tempExe]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        stdout: (runStdout || '').trim(),
        stderr: (runStderr || '').trim(),
        exitCode: runErr ? runErr.code : 0
      }));
    });

    if (stdin) {
      runProc.stdin.write(stdin);
      runProc.stdin.end();
    }
  });
}

function cleanupFiles(files) {
  files.forEach(f => {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) {}
  });
}

server.listen(PORT, () => {
  console.log(`\n\x1b[36m⚡ TophHub C++ IDE is running locally!\x1b[0m`);
  console.log(`\x1b[32m✔ URL:\x1b[0m http://localhost:${PORT}\n`);
  console.log(`Open http://localhost:${PORT} in your browser to start coding in C++.\n`);
});
