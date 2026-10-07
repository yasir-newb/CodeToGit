/**
 * CodeToGit (CTG) IDE — Local Node.js Development Server
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

  // Open in Code::Blocks Endpoint: POST /api/codeblocks/open
  if (req.method === 'POST' && pathname === '/api/codeblocks/open') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        handleCodeBlocksOpen(payload, res);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Fetch Problem from Platform API: GET /api/problem?slug=<slug>&platform=<platform>
  if (req.method === 'GET' && pathname === '/api/problem') {
    const slug = parsedUrl.searchParams.get('slug');
    const platform = parsedUrl.searchParams.get('platform');
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing slug parameter' }));
      return;
    }
    handleFetchProblem(slug, res, platform);
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

function handleFetchProblem(slug, res, platform) {
  const https = require('https');
  const trimmed = (slug || '').trim();

  // Check if Codeforces problem
  const cfUrlMatch = trimmed.match(/(?:codeforces\.com\/)?(?:contest|gym|problemset\/problem)\/([0-9]+)(?:\/problem)?\/([a-zA-Z0-9]+)/i);
  const cfShortMatch = trimmed.match(/^(?:cf[:_\s-]*)?([0-9]{1,6})[\/_\s-]*([a-zA-Z][0-9]?)$/i);

  if (cfUrlMatch || cfShortMatch || platform === 'codeforces') {
    const cfContest = cfUrlMatch ? cfUrlMatch[1] : (cfShortMatch ? cfShortMatch[1] : '');
    const cfIndex = cfUrlMatch ? cfUrlMatch[2].toUpperCase() : (cfShortMatch ? cfShortMatch[2].toUpperCase() : '');

    // Query official Codeforces API
    https.get('https://codeforces.com/api/problemset.problems', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeToGit/1.0' }
    }, clientRes => {
      let data = '';
      clientRes.on('data', chunk => data += chunk);
      clientRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          let p = null;
          if (json.status === 'OK' && json.result && json.result.problems) {
            p = json.result.problems.find(item => item.contestId == cfContest && String(item.index).toUpperCase() === cfIndex);
          }
          const title = p ? `${cfContest}${cfIndex} - ${p.name}` : `Codeforces ${cfContest}${cfIndex}`;
          const ratingStr = (p && p.rating) ? `Rating: ${p.rating}` : 'Unrated';
          const tagsStr = (p && p.tags && p.tags.length > 0) ? p.tags.join(', ') : 'competitive programming';

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            slug: `cf_${cfContest}${cfIndex}`,
            contestId: cfContest,
            problemIndex: cfIndex,
            title,
            desc: `Codeforces Problem: ${title}\n${ratingStr} | Tags: ${tagsStr}\n\nOfficial Link: https://codeforces.com/contest/${cfContest}/problem/${cfIndex}`,
            input: 'Standard input format (cin >> ...)',
            output: 'Standard output format (cout << ...)',
            samples: [{ stdin: '', expected: '' }],
            platform: 'codeforces'
          }));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            slug: `cf_${cfContest}${cfIndex}`,
            contestId: cfContest,
            problemIndex: cfIndex,
            title: `Codeforces ${cfContest}${cfIndex}`,
            desc: `Visit https://codeforces.com/contest/${cfContest}/problem/${cfIndex} for complete description.`,
            samples: [{ stdin: '', expected: '' }],
            platform: 'codeforces'
          }));
        }
      });
    }).on('error', err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Otherwise: Toph.co problem
  const cleanSlug = trimmed
    .replace(/.*toph\.co\/p\//i, '')
    .replace(/[\/?#].*$/, '')
    .trim()
    .toLowerCase();
  const url = `https://toph.co/p/${cleanSlug}.json`;

  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  }, clientRes => {
    let data = '';
    clientRes.on('data', chunk => data += chunk);
    clientRes.on('end', () => {
      if (clientRes.statusCode !== 200) {
        res.writeHead(clientRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Toph returned status ${clientRes.statusCode}` }));
        return;
      }
      try {
        const json = JSON.parse(data);
        const statement = (json.statement && json.statement.en_us) 
          ? json.statement.en_us 
          : (json.statement ? Object.values(json.statement)[0] : {});
        const rawSamples = json.samples || [];

        const samples = rawSamples.map(s => ({
          stdin: (s.input || '').replace(/\r\n/g, '\n').trim(),
          expected: (s.output || '').replace(/\r\n/g, '\n').trim()
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          slug: cleanSlug,
          title: statement.title || cleanSlug,
          desc: stripHtml(statement.bodyHTML || ''),
          input: stripHtml(statement.inputHTML || ''),
          output: stripHtml(statement.outputHTML || ''),
          samples: samples,
          platform: 'toph'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to parse Toph problem JSON' }));
      }
    });
  }).on('error', err => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function handleCodeBlocksOpen(payload, res) {
  const { slug, code, stdin, expected, platform } = payload;
  const cleanSlug = (slug || 'solution').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const isCf = platform === 'codeforces' || cleanSlug.startsWith('cf-') || cleanSlug.startsWith('cf_');
  const baseDir = path.join(ROOT_DIR, isCf ? 'codeforces' : 'toph');
  const problemFolder = path.join(baseDir, cleanSlug);

  if (!fs.existsSync(problemFolder)) {
    fs.mkdirSync(problemFolder, { recursive: true });
  }

  const solutionFile = path.join(problemFolder, 'solution.cpp');
  const cbpFile = path.join(problemFolder, `${cleanSlug}.cbp`);
  const inputFile = path.join(problemFolder, 'input.txt');
  const outputFile = path.join(problemFolder, 'output.txt');

  if (code) {
    fs.writeFileSync(solutionFile, code, 'utf8');
  }

  const cbpXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<CodeBlocks_project_file>
	<FileVersion major="1" minor="6" />
	<Project>
		<Option title="${cleanSlug}" />
		<Option pch_mode="2" />
		<Option compiler="gcc" />
		<Build>
			<Target title="Debug">
				<Option output="bin/Debug/${cleanSlug}" prefix_auto="1" extension_auto="1" />
				<Option object_output="obj/Debug/" />
				<Option type="1" />
				<Option compiler="gcc" />
				<Compiler>
					<Add option="-g" />
					<Add option="-std=c++20" />
				</Compiler>
			</Target>
			<Target title="Release">
				<Option output="bin/Release/${cleanSlug}" prefix_auto="1" extension_auto="1" />
				<Option object_output="obj/Release/" />
				<Option type="1" />
				<Option compiler="gcc" />
				<Compiler>
					<Add option="-O2" />
					<Add option="-std=c++20" />
				</Compiler>
				<Linker>
					<Add option="-s" />
				</Linker>
			</Target>
		</Build>
		<Compiler>
			<Add option="-Wall" />
			<Add option="-fexceptions" />
		</Compiler>
		<Unit filename="solution.cpp" />
		<Extensions />
	</Project>
</CodeBlocks_project_file>
`;
  fs.writeFileSync(cbpFile, cbpXml, 'utf8');

  if (stdin !== undefined) {
    fs.writeFileSync(inputFile, (stdin || '') + '\n', 'utf8');
  }
  if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, (expected || '') + '\n', 'utf8');
  }

  // Update Toph.workspace
  try {
    const workspacePath = path.join(tophDir, 'Toph.workspace');
    let projects = [];
    if (fs.existsSync(workspacePath)) {
      const content = fs.readFileSync(workspacePath, 'utf8');
      const matches = content.match(/filename="([^"]+)"/g) || [];
      projects = matches.map(m => m.replace(/filename="|"/g, ''));
    }
    const relProject = `${cleanSlug}/${cleanSlug}.cbp`;
    if (!projects.includes(relProject)) projects.push(relProject);
    const projectTags = projects
      .map(p => `\t\t<Project filename="${p}" active="${p === relProject ? '1' : '0'}" />`)
      .join('\n');
    fs.writeFileSync(workspacePath, `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<CodeBlocks_workspace_file>\n\t<Workspace title="Toph Solutions">\n${projectTags}\n\t</Workspace>\n</CodeBlocks_workspace_file>\n`, 'utf8');
  } catch (e) {}

  // Launch Code::Blocks
  const commonPaths = [
    'C:\\Program Files\\CodeBlocks\\codeblocks.exe',
    'C:\\Program Files (x86)\\CodeBlocks\\codeblocks.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'CodeBlocks', 'codeblocks.exe')
  ];
  let cbExe = commonPaths.find(p => fs.existsSync(p));

  if (process.platform === 'win32') {
    if (cbExe) {
      exec(`"${cbExe}" "${cbpFile}"`);
    } else {
      exec(`start "" "${cbpFile}"`);
    }
  } else {
    exec(`codeblocks "${cbpFile}" || xdg-open "${cbpFile}"`);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    message: `Launched Code::Blocks project for ${cleanSlug}`,
    cbpFile: cbpFile,
    solutionFile: solutionFile,
    inputFile: inputFile
  }));
}

server.listen(PORT, () => {
  console.log(`\n\x1b[36m⚡ CodeToGit (CTG) IDE is running locally!\x1b[0m`);
  console.log(`\x1b[32m✔ URL:\x1b[0m http://localhost:${PORT}\n`);
  console.log(`Open http://localhost:${PORT} in your browser to start coding in C++.\n`);
});
