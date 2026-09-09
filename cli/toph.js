#!/usr/bin/env node

/**
 * Toph CLI - Local C++ Competitive Programming Helper for Toph.co
 * 
 * Commands:
 *   node toph.js init
 *   node toph.js new <problem-slug>
 *   node toph.js push <problem-slug>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const tophDir = path.join(rootDir, 'toph');
const templatePath = path.join(rootDir, 'templates', 'template.cpp');

const command = process.argv[2];
const problemSlug = process.argv[3];

function printHelp() {
  console.log(`
\x1b[36m⚡ Toph CLI - C++ Competitive Programming Helper for Toph.co\x1b[0m

Usage:
  node toph.js init              Initialize local repository & directory structure
  node toph.js new <slug>        Create a new C++ solution template for a problem
  node toph.js push <slug>       Stage, commit, and push solution to GitHub

Examples:
  node toph.js new formatted-numbers
  node toph.js push formatted-numbers
`);
}

function init() {
  console.log('\x1b[34m[+] Initializing Toph C++ workspace...\x1b[0m');
  if (!fs.existsSync(tophDir)) {
    fs.mkdirSync(tophDir, { recursive: true });
    console.log(`Created directory: ${tophDir}`);
  }

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

  console.log('\x1b[32m✔ Workspace setup complete! Start solving with:\x1b[0m node toph.js new <slug>');
}

function newProblem(slug) {
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

  const solutionFile = path.join(problemFolder, 'solution.cpp');
  const readmeFile = path.join(problemFolder, 'README.md');

  // Load template
  let templateContent = '';
  if (fs.existsSync(templatePath)) {
    templateContent = fs.readFileSync(templatePath, 'utf8');
  } else {
    templateContent = `#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n`;
  }

  const formattedTitle = cleanSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  templateContent = templateContent
    .replace('[Problem Title]', formattedTitle)
    .replace('[slug]', cleanSlug);

  if (!fs.existsSync(solutionFile)) {
    fs.writeFileSync(solutionFile, templateContent, 'utf8');
    console.log(`\x1b[32m✔ Created C++ solution file:\x1b[0m ${solutionFile}`);
  } else {
    console.log(`\x1b[33m! Solution file already exists:\x1b[0m ${solutionFile}`);
  }

  if (!fs.existsSync(readmeFile)) {
    const readmeContent = `# [${formattedTitle}](https://toph.co/p/${cleanSlug})

- **Platform:** [Toph.co](https://toph.co)
- **Problem Link:** https://toph.co/p/${cleanSlug}
- **Language:** C++
- **Solution:** [\`solution.cpp\`](./solution.cpp)
`;
    fs.writeFileSync(readmeFile, readmeContent, 'utf8');
    console.log(`\x1b[32m✔ Created problem README:\x1b[0m ${readmeFile}`);
  }

  console.log(`
\x1b[36m🚀 Problem workspace ready:\x1b[0m ${cleanSlug}
URL: https://toph.co/p/${cleanSlug}
Code file: toph/${cleanSlug}/solution.cpp

When finished and accepted, push to GitHub with:
  \x1b[33mnode toph.js push ${cleanSlug}\x1b[0m
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

  const formattedTitle = cleanSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

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
    console.log('\x1b[34m[+] Staging files with git...\x1b[0m');
    execSync(`git add toph/${cleanSlug} README.md`, { cwd: rootDir, stdio: 'inherit' });

    console.log('\x1b[34m[+] Committing solution...\x1b[0m');
    execSync(`git commit -m "Solve: ${formattedTitle} in C++ [Accepted]"`, { cwd: rootDir, stdio: 'inherit' });

    console.log('\x1b[34m[+] Pushing to remote GitHub repository...\x1b[0m');
    execSync(`git push`, { cwd: rootDir, stdio: 'inherit' });

    console.log(`\x1b[32m✔ Successfully pushed ${formattedTitle} to GitHub!\x1b[0m`);
  } catch (err) {
    console.error('\x1b[31m! Git command failed. Please verify your git remote configuration.\x1b[0m');
  }
}

switch (command) {
  case 'init':
    init();
    break;
  case 'new':
    newProblem(problemSlug);
    break;
  case 'push':
    pushProblem(problemSlug);
    break;
  default:
    printHelp();
    break;
}
