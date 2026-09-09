// TophHub Background Service Worker - Handles GitHub REST API Operations

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'COMMIT_SOLUTION') {
    handleCommit(request.payload)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('[TophHub Background] Error:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error occurred' });
      });
    return true; // Keep message channel open for async response
  }
});

async function handleCommit(data) {
  const {
    problemSlug,
    problemTitle,
    language,
    cpuTime,
    memory,
    code,
    problemDescription,
    problemUrl,
    submissionId
  } = data;

  // Retrieve configuration
  const config = await getStorage(['githubToken', 'repo', 'branch', 'langPreference', 'syncedCount']);
  const token = config.githubToken;
  const repo = config.repo;
  const branch = config.branch || 'main';

  if (!token || !repo) {
    throw new Error('GitHub token or repository not configured in TophHub.');
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error('Invalid repository format. Expected "owner/repo".');
  }

  // Determine file extension (defaults to .cpp)
  const ext = getFileExtension(language, config.langPreference);
  const solutionPath = `toph/${problemSlug}/solution.${ext}`;
  const problemReadmePath = `toph/${problemSlug}/README.md`;
  const rootReadmePath = `README.md`;

  // 1. Prepare Solution Content with Clean C++ Header
  const dateStr = new Date().toISOString().split('T')[0];
  const solutionContent = 
`/**
 * Problem: ${problemTitle}
 * Problem URL: ${problemUrl || `https://toph.co/p/${problemSlug}`}
 * Language: ${language}
 * Verdict: Accepted
 * CPU Time: ${cpuTime} | Memory: ${memory}
 * Submission ID: ${submissionId}
 * Synced: ${dateStr}
 *
 * Synced by TophHub - Competitive Programming to GitHub
 */

${code}
`;

  // 2. Commit Solution File
  const commitMsg = `Solve: ${problemTitle} [Accepted] (${language})`;
  await putGitHubFile(owner, repoName, solutionPath, commitMsg, solutionContent, branch, token);

  // 3. Commit Problem README
  const problemReadmeContent =
`# [${problemTitle}](${problemUrl || `https://toph.co/p/${problemSlug}`})

- **Platform:** [Toph.co](https://toph.co)
- **Problem Slug:** \`${problemSlug}\`
- **Verdict:** Accepted (AC)
- **Language:** ${language}
- **CPU Time:** \`${cpuTime}\`
- **Memory:** \`${memory}\`
- **Submission ID:** \`${submissionId}\`
- **Solution:** [\`solution.${ext}\`](./solution.${ext})

---

## Problem Description

${problemDescription || '_Problem statement not available. View directly on [Toph.co](' + problemUrl + ')._'}
`;

  try {
    await putGitHubFile(owner, repoName, problemReadmePath, `Docs: Add problem statement for ${problemTitle}`, problemReadmeContent, branch, token);
  } catch (e) {
    console.warn('[TophHub] Failed to update problem README (non-critical):', e);
  }

  // 4. Update Root README (Index Table of Solved Problems)
  try {
    await updateRootReadme(owner, repoName, rootReadmePath, {
      title: problemTitle,
      slug: problemSlug,
      url: problemUrl || `https://toph.co/p/${problemSlug}`,
      language,
      cpuTime,
      memory,
      ext
    }, branch, token);
  } catch (e) {
    console.warn('[TophHub] Failed to update root README index:', e);
  }

  // Increment synced count
  const newCount = (config.syncedCount || 0) + 1;
  await chrome.storage.local.set({ syncedCount: newCount });

  return {
    success: true,
    fileUrl: `https://github.com/${owner}/${repoName}/blob/${branch}/${solutionPath}`
  };
}

// GitHub API Helper: Fetch existing file SHA
async function getFileSha(owner, repo, path, branch, token) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 200) {
      const data = await res.json();
      return { sha: data.sha, content: decodeBase64(data.content) };
    }
    return { sha: null, content: null };
  } catch (err) {
    return { sha: null, content: null };
  }
}

// GitHub API Helper: Create or Update File
async function putGitHubFile(owner, repo, path, message, contentStr, branch, token) {
  const existing = await getFileSha(owner, repo, path, branch, token);
  const encodedContent = encodeBase64(contentStr);

  const payload = {
    message: message,
    content: encodedContent,
    branch: branch
  };

  if (existing.sha) {
    payload.sha = existing.sha;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub API error (${res.status} ${res.statusText})`);
  }

  return await res.json();
}

// Automatically maintains a structured table of solved problems in the root README
async function updateRootReadme(owner, repo, rootPath, problemData, branch, token) {
  const existing = await getFileSha(owner, repo, rootPath, branch, token);
  let content = existing.content;

  const tableHeader = '| # | Problem | Language | Time | Memory | Solution |\n|---|---|---|---|---|---|';
  const newRow = `| - | [${problemData.title}](${problemData.url}) | \`${problemData.language}\` | \`${problemData.cpuTime}\` | \`${problemData.memory}\` | [solution.${problemData.ext}](./toph/${problemData.slug}/solution.${problemData.ext}) |`;

  if (!content) {
    // Initial README template
    content = 
`# Toph.co Solutions (C++)

A collection of competitive programming solutions solved on [Toph.co](https://toph.co), automatically synced using [TophHub](https://github.com/${owner}/${repo}).

## 📊 Solved Problems

${tableHeader}
${newRow}

---
*Created automatically by TophHub Extension.*
`;
  } else {
    // Check if problem is already in the table
    if (content.includes(`toph/${problemData.slug}/`)) {
      // Already present in README, no update needed
      return;
    }

    if (content.includes(tableHeader)) {
      // Append row to existing table
      content = content.replace(tableHeader, `${tableHeader}\n${newRow}`);
    } else {
      // Table doesn't exist, append section
      content += `\n\n## 📊 Solved Problems\n\n${tableHeader}\n${newRow}\n`;
    }
  }

  await putGitHubFile(owner, repo, rootPath, `Docs: Update solved index for ${problemData.title}`, content, branch, token);
}

// Extension resolution
function getFileExtension(lang, pref) {
  if (pref === 'cpp') return 'cpp';
  const l = (lang || '').toLowerCase();
  if (l.includes('c++') || l.includes('cpp')) return 'cpp';
  if (l.includes('python')) return 'py';
  if (l.includes('java')) return 'java';
  if (l.includes('c#') || l.includes('csharp')) return 'cs';
  if (l.includes('rust')) return 'rs';
  if (l.includes('go')) return 'go';
  if (l.includes('kotlin')) return 'kt';
  if (l.includes('c')) return 'c';
  return 'cpp'; // default to C++
}

// UTF-8 safe base64 encoding/decoding
function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
  } catch (e) {
    return atob(str.replace(/\s/g, ''));
  }
}

function getStorage(keys) {
  return new Promise(resolve => {
    chrome.storage.local.get(keys, resolve);
  });
}
