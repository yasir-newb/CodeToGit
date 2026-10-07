#!/usr/bin/env node

/**
 * ⚡ CodeToGit (CTG) CLI — Competitive Programming Helper for Toph.co & Code::Blocks
 * 
 * Commands:
 *   node toph.js init              Initialize local repository & Code::Blocks workspace
 *   node toph.js new <slug>        Create C++ solution, Code::Blocks project (.cbp) & test files
 *   node toph.js cb [slug]         Open problem or workspace in Code::Blocks IDE
 *   node toph.js push <slug>       Stage, commit, and push solution to GitHub
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, exec, spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const tophDir = path.join(rootDir, 'toph');
const templatePath = path.join(rootDir, 'templates', 'template.cpp');
const workspacePath = path.join(tophDir, 'Toph.workspace');

const command = process.argv[2];
const problemSlug = process.argv[3];

function printHelp() {
  console.log(`
\x1b[36m⚡ CodeToGit (CTG) CLI — Competitive Programming Helper for Toph.co & Code::Blocks\x1b[0m

Usage:
  node toph.js init              Initialize local workspace, git & Code::Blocks workspace
  node toph.js new <slug>        Create C++ template, Code::Blocks project (.cbp) & test files
  node toph.js cb [slug]         Open problem in Code::Blocks IDE (or open full workspace)
  node toph.js push <slug>       Stage, commit, and push solution to GitHub

Aliases:
  node toph.js open <slug>       (Same as cb)

Examples:
  node toph.js new formatted-numbers
  node toph.js cb formatted-numbers
  node toph.js push formatted-numbers
`);
}

function fetchProblemData(slug) {
  return new Promise((resolve) => {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const url = `https://toph.co/p/${cleanSlug}.json`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeToGit/1.0'
      }
    }, res => {
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const statement = (json.statement && json.statement.en_us)
            ? json.statement.en_us
            : (json.statement ? Object.values(json.statement)[0] : {});
          const rawSamples = json.samples || [];

          const samples = rawSamples.map(s => ({
            stdin: (s.input || '').replace(/\r\n/g, '\n').trim(),
            expected: (s.output || '').replace(/\r\n/g, '\n').trim()
          }));

          resolve({
            slug: cleanSlug,
            title: statement.title || formatTitle(cleanSlug),
            desc: stripHtml(statement.bodyHTML || ''),
            inputFormat: stripHtml(statement.inputHTML || ''),
            outputFormat: stripHtml(statement.outputHTML || ''),
            samples: samples
          });
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
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

function formatTitle(slug) {
  return slug
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function generateCbpContent(slug) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<CodeBlocks_project_file>
	<FileVersion major="1" minor="6" />
	<Project>
		<Option title="${slug}" />
		<Option pch_mode="2" />
		<Option compiler="gcc" />
		<Build>
			<Target title="Debug">
				<Option output="bin/Debug/${slug}" prefix_auto="1" extension_auto="1" />
				<Option object_output="obj/Debug/" />
				<Option type="1" />
				<Option compiler="gcc" />
				<Compiler>
					<Add option="-g" />
					<Add option="-std=c++20" />
				</Compiler>
			</Target>
			<Target title="Release">
				<Option output="bin/Release/${slug}" prefix_auto="1" extension_auto="1" />
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
}

function updateCodeBlocksWorkspace(slug) {
  try {
    if (!fs.existsSync(tophDir)) fs.mkdirSync(tophDir, { recursive: true });

    let projects = [];
    if (fs.existsSync(workspacePath)) {
      const content = fs.readFileSync(workspacePath, 'utf8');
      const matches = content.match(/filename="([^"]+)"/g) || [];
      projects = matches.map(m => m.replace(/filename="|"/g, ''));
    }

    const relProject = `${slug}/${slug}.cbp`;
    if (!projects.includes(relProject)) {
      projects.push(relProject);
    }

    const projectTags = projects
      .map(p => `\t\t<Project filename="${p}" active="${p === relProject ? '1' : '0'}" />`)
      .join('\n');

    const workspaceXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<CodeBlocks_workspace_file>
	<Workspace title="Toph Solutions">
${projectTags}
	</Workspace>
</CodeBlocks_workspace_file>
`;
    fs.writeFileSync(workspacePath, workspaceXml, 'utf8');
  } catch (err) {
    // Non-critical workspace update
  }
}

function findCodeBlocksExe() {
  const commonPaths = [
    'C:\\Program Files\\CodeBlocks\\codeblocks.exe',
    'C:\\Program Files (x86)\\CodeBlocks\\codeblocks.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'CodeBlocks', 'codeblocks.exe')
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Check PATH
  try {
    const stdout = execSync('where codeblocks', { stdio: 'pipe' }).toString().trim();
    if (stdout && fs.existsSync(stdout.split('\n')[0].trim())) {
      return stdout.split('\n')[0].trim();
    }
  } catch (e) {}

  return null;
}

function openInCodeBlocks(slug) {
  let targetFile = '';
  if (slug) {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cbpFile = path.join(tophDir, cleanSlug, `${cleanSlug}.cbp`);
    const cppFile = path.join(tophDir, cleanSlug, 'solution.cpp');
    if (fs.existsSync(cbpFile)) {
      targetFile = cbpFile;
    } else if (fs.existsSync(cppFile)) {
      targetFile = cppFile;
    } else {
      console.error(`\x1b[31mError: Problem folder toph/${cleanSlug} does not exist.\x1b[0m`);
      console.log(`Run: node toph.js new ${cleanSlug}`);
      return;
    }
  } else {
    // Open full workspace or root toph
    if (fs.existsSync(workspacePath)) {
      targetFile = workspacePath;
    } else {
      console.log('\x1b[33mNo slug specified. Please specify problem slug:\x1b[0m node toph.js cb <slug>');
      return;
    }
  }

  const cbExe = findCodeBlocksExe();
  console.log(`\x1b[34m[+] Opening in Code::Blocks IDE...\x1b[0m`);
  console.log(`Target: ${targetFile}`);

  if (process.platform === 'win32') {
    if (cbExe) {
      exec(`"${cbExe}" "${targetFile}"`, err => {
        if (err) console.error('\x1b[31mError launching Code::Blocks:\x1b[0m', err.message);
      });
      console.log('\x1b[32m✔ Launched Code::Blocks successfully!\x1b[0m');
    } else {
      // Use Windows file association for .cbp / .workspace
      exec(`start "" "${targetFile}"`, err => {
        if (err) console.error('\x1b[31mCould not open file with Code::Blocks association.\x1b[0m');
      });
      console.log('\x1b[32m✔ Sent open command to Windows shell.\x1b[0m');
    }
  } else {
    // Linux/macOS
    const cmd = cbExe ? `"${cbExe}" "${targetFile}" &` : `xdg-open "${targetFile}"`;
    exec(cmd);
    console.log('\x1b[32m✔ Launched Code::Blocks.\x1b[0m');
  }
}

function init() {
  console.log('\x1b[34m[+] Initializing CodeToGit (CTG) workspace...\x1b[0m');
  if (!fs.existsSync(tophDir)) {
    fs.mkdirSync(tophDir, { recursive: true });
    console.log(`Created directory: ${tophDir}`);
  }

  // Code::Blocks Workspace
  if (!fs.existsSync(workspacePath)) {
    const defaultWorkspace = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<CodeBlocks_workspace_file>
	<Workspace title="Toph Solutions" />
</CodeBlocks_workspace_file>
`;
    fs.writeFileSync(workspacePath, defaultWorkspace, 'utf8');
    console.log('\x1b[32m✔ Created Code::Blocks workspace:\x1b[0m toph/Toph.workspace');
  }

  // Root README
  const rootReadme = path.join(rootDir, 'README.md');
  if (!fs.existsSync(rootReadme)) {
    const defaultReadme = `# Toph.co C++ Solutions

Repository containing my C++ competitive programming solutions for [Toph.co](https://toph.co).

## 📊 Solved Problems

| # | Problem | Language | Solution |
|---|---|---|---|
`;
    fs.writeFileSync(rootReadme, defaultReadme, 'utf8');
    console.log('Created: README.md');
  }

  // Check git status
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    console.log('\x1b[32m✔ Git repository is ready.\x1b[0m');
  } catch (e) {
    try {
      execSync('git init', { cwd: rootDir, stdio: 'inherit' });
      console.log('\x1b[32m✔ Initialized fresh git repository.\x1b[0m');
    } catch (gitErr) {
      console.log('\x1b[33m! Note: Git not initialized. Run "git init" when ready.\x1b[0m');
    }
  }

  const cbExe = findCodeBlocksExe();
  if (cbExe) {
    console.log(`\x1b[32m✔ Detected Code::Blocks IDE:\x1b[0m ${cbExe}`);
  } else {
    console.log('\x1b[33m! Code::Blocks not found in standard paths. You can still open .cbp files directly.\x1b[0m');
  }

  console.log('\n\x1b[32m✔ Setup complete! Start coding with:\x1b[0m');
  console.log('  node toph.js new <slug>');
  console.log('  node toph.js cb <slug>');
}

async function newProblem(slug) {
  if (!slug) {
    console.error('\x1b[31mError: Please specify the problem slug.\x1b[0m');
    console.log('Example: node toph.js new formatted-numbers');
    return;
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const problemFolder = path.join(tophDir, cleanSlug);

  if (!fs.existsSync(problemFolder)) {
    fs.mkdirSync(problemFolder, { recursive: true });
  }

  console.log(`\x1b[34m[+] Fetching problem info from Toph.co for "${cleanSlug}"...\x1b[0m`);
  const problemData = await fetchProblemData(cleanSlug);

  const formattedTitle = problemData ? problemData.title : formatTitle(cleanSlug);
  const sampleInput = (problemData && problemData.samples && problemData.samples[0])
    ? problemData.samples[0].stdin
    : '';
  const sampleExpected = (problemData && problemData.samples && problemData.samples[0])
    ? problemData.samples[0].expected
    : '';

  // 1. Solution C++ file
  const solutionFile = path.join(problemFolder, 'solution.cpp');
  let templateContent = '';
  if (fs.existsSync(templatePath)) {
    templateContent = fs.readFileSync(templatePath, 'utf8');
  } else {
    templateContent = `#include <bits/stdc++.h>
using namespace std;

#define fast_io ios_base::sync_with_stdio(false); cin.tie(NULL);

void solve() {
    
}

int main() {
    fast_io;
    
    #ifndef ONLINE_JUDGE
    freopen("input.txt", "r", stdin);
    freopen("output.txt", "w", stdout);
    #endif
    
    int t = 1;
    cin >> t;
    while (t--) {
        solve();
    }
    
    return 0;
}
`;
  }

  if (!fs.existsSync(solutionFile)) {
    fs.writeFileSync(solutionFile, templateContent, 'utf8');
    console.log(`\x1b[32m✔ Created C++ solution file:\x1b[0m ${solutionFile}`);
  } else {
    console.log(`\x1b[33m! Solution file already exists:\x1b[0m ${solutionFile}`);
  }

  // 2. Code::Blocks project (.cbp)
  const cbpFile = path.join(problemFolder, `${cleanSlug}.cbp`);
  if (!fs.existsSync(cbpFile)) {
    fs.writeFileSync(cbpFile, generateCbpContent(cleanSlug), 'utf8');
    console.log(`\x1b[32m✔ Created Code::Blocks project:\x1b[0m ${cbpFile}`);
  }

  // 3. input.txt & output.txt for local Code::Blocks execution
  const inputFile = path.join(problemFolder, 'input.txt');
  const outputFile = path.join(problemFolder, 'output.txt');
  if (!fs.existsSync(inputFile)) {
    fs.writeFileSync(inputFile, sampleInput ? sampleInput + '\n' : '', 'utf8');
    console.log(`\x1b[32m✔ Created input.txt\x1b[0m (Pre-populated with Toph Sample Input)`);
  }
  if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, '', 'utf8');
    console.log(`\x1b[32m✔ Created output.txt\x1b[0m (For Code::Blocks redirected output)`);
  }

  // 4. Problem README.md
  const readmeFile = path.join(problemFolder, 'README.md');
  if (!fs.existsSync(readmeFile)) {
    let readmeContent = `# [${formattedTitle}](https://toph.co/p/${cleanSlug})

- **Platform:** [Toph.co](https://toph.co)
- **Problem Link:** https://toph.co/p/${cleanSlug}
- **Language:** C++
- **Solution:** [\`solution.cpp\`](./solution.cpp)
- **Code::Blocks Project:** [\`${cleanSlug}.cbp\`](./${cleanSlug}.cbp)
`;
    if (problemData && problemData.desc) {
      readmeContent += `\n---\n\n## Description\n\n${problemData.desc}\n`;
    }
    if (problemData && problemData.inputFormat) {
      readmeContent += `\n### Input\n\n${problemData.inputFormat}\n`;
    }
    if (problemData && problemData.outputFormat) {
      readmeContent += `\n### Output\n\n${problemData.outputFormat}\n`;
    }
    if (sampleInput || sampleExpected) {
      readmeContent += `\n### Sample Test Case\n\n**Input:**\n\`\`\`\n${sampleInput}\n\`\`\`\n\n**Output:**\n\`\`\`\n${sampleExpected}\n\`\`\`\n`;
    }

    fs.writeFileSync(readmeFile, readmeContent, 'utf8');
    console.log(`\x1b[32m✔ Created problem documentation:\x1b[0m ${readmeFile}`);
  }

  // 5. Update workspace
  updateCodeBlocksWorkspace(cleanSlug);

  console.log(`
\x1b[36m🚀 Problem & Code::Blocks setup ready for:\x1b[0m ${formattedTitle}
URL: https://toph.co/p/${cleanSlug}
Workspace: toph/${cleanSlug}/

\x1b[33mCode::Blocks Quick Commands:\x1b[0m
  Open in Code::Blocks:  \x1b[32mnode toph.js cb ${cleanSlug}\x1b[0m
  Push to GitHub:        \x1b[32mnode toph.js push ${cleanSlug}\x1b[0m
`);
}

function pushProblem(slug) {
  if (!slug) {
    console.error('\x1b[31mError: Please specify the problem slug to push.\x1b[0m');
    return;
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const problemFolder = path.join(tophDir, cleanSlug);

  if (!fs.existsSync(problemFolder)) {
    console.error(`\x1b[31mError: Problem folder toph/${cleanSlug} does not exist.\x1b[0m`);
    return;
  }

  const formattedTitle = formatTitle(cleanSlug);

  // Update root README table if not already added
  const rootReadme = path.join(rootDir, 'README.md');
  if (fs.existsSync(rootReadme)) {
    let content = fs.readFileSync(rootReadme, 'utf8');
    if (!content.includes(`toph/${cleanSlug}/`)) {
      const row = `| - | [${formattedTitle}](https://toph.co/p/${cleanSlug}) | \`C++\` | [solution.cpp](./toph/${cleanSlug}/solution.cpp) |\n`;
      content += row;
      fs.writeFileSync(rootReadme, content, 'utf8');
    }
  }

  try {
    console.log('\x1b[34m[+] Staging solution & documentation with git...\x1b[0m');
    // Only stage solution.cpp, README.md, and root README.md (keeps Code::Blocks build files out of Git)
    execSync(`git add toph/${cleanSlug}/solution.cpp toph/${cleanSlug}/README.md README.md`, { cwd: rootDir, stdio: 'inherit' });

    console.log('\x1b[34m[+] Committing solution...\x1b[0m');
    execSync(`git commit -m "Solve: ${formattedTitle} in C++ [Accepted]"`, { cwd: rootDir, stdio: 'inherit' });

    console.log('\x1b[34m[+] Pushing to remote GitHub repository...\x1b[0m');
    execSync(`git push`, { cwd: rootDir, stdio: 'inherit' });

    console.log(`\x1b[32m✔ Successfully pushed ${formattedTitle} to GitHub!\x1b[0m`);
  } catch (err) {
    console.error('\x1b[31m! Git command completed. (If push failed, check your remote repository settings)\x1b[0m');
  }
}

switch (command) {
  case 'init':
    init();
    break;
  case 'new':
    newProblem(problemSlug);
    break;
  case 'cb':
  case 'codeblocks':
  case 'open':
    openInCodeBlocks(problemSlug);
    break;
  case 'push':
    pushProblem(problemSlug);
    break;
  default:
    printHelp();
    break;
}
