// CodeToGit (CTG) Background Service Worker - Handles GitHub REST API Operations & Multi-Platform Problem Fetching

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'COMMIT_SOLUTION') {
    handleCommit(request.payload)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('[CodeToGit Background] Error:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error occurred' });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'FETCH_TOPH_PROBLEM') {
    fetchTophProblem(request.slug)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.warn('[CodeToGit Background] Toph problem fetch error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === 'FETCH_CF_SUBMISSION') {
    fetchCodeforcesSubmission(request.url)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.warn('[CodeToGit Background] Codeforces submission fetch error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === 'FETCH_CF_PROBLEM') {
    fetchCodeforcesProblem(request.contestId, request.problemIndex)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => {
        console.warn('[CodeToGit Background] Codeforces problem fetch error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function handleCommit(data) {
  const {
    platform = (data.problemUrl && data.problemUrl.includes('codeforces') ? 'codeforces' : 'toph'),
    problemSlug,
    contestId,
    problemIndex,
    problemTitle,
    language,
    cpuTime,
    memory,
    code,
    problemDescription,
    problemUrl,
    submissionId
  } = data;

  if (!code || !code.trim()) {
    throw new Error('No source code found to commit.');
  }

  // Retrieve configuration
  const config = await getStorage(['githubToken', 'repo', 'branch', 'langPreference', 'syncedCount', 'userInfo']);
  const token = (config.githubToken || '').trim();
  let rawRepo = (config.repo || '').trim();
  const branch = (config.branch || 'main').trim();

  if (!token || !rawRepo) {
    throw new Error('GitHub token or repository not configured in CodeToGit settings.');
  }

  // Sanitize repo string: handles "owner/repo", "https://github.com/owner/repo", or "repo" with userInfo
  rawRepo = rawRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/^\/+|\/+$/g, '');
  let parts = rawRepo.split('/').filter(Boolean);
  let owner = '', repoName = '';
  if (parts.length >= 2) {
    owner = parts[0];
    repoName = parts[1];
  } else if (parts.length === 1 && config.userInfo && config.userInfo.login) {
    owner = config.userInfo.login;
    repoName = parts[0];
  }

  if (!owner || !repoName) {
    throw new Error(`Repository "${config.repo}" is invalid. Please set as "username/repository" in CodeToGit settings.`);
  }

  // Determine file extension (defaults to .cpp)
  const ext = getFileExtension(language, config.langPreference);
  const rootReadmePath = `README.md`;

  let solutionPath = '';
  let problemReadmePath = '';
  let commitMsg = '';
  let problemReadmeContent = '';
  const isCF = platform.toLowerCase() === 'codeforces';

  if (isCF) {
    const cleanContest = (contestId || 'contest').toString().trim();
    const cleanIndex = (problemIndex || 'A').toString().trim().toUpperCase();
    const cleanTitle = (problemTitle || `${cleanContest}${cleanIndex}`).trim();
    const safeUrl = problemUrl || `https://codeforces.com/contest/${cleanContest}/problem/${cleanIndex}`;

    solutionPath = `codeforces/${cleanContest}/${cleanIndex}/solution.${ext}`;
    problemReadmePath = `codeforces/${cleanContest}/${cleanIndex}/README.md`;
    commitMsg = `Solve: Codeforces ${cleanContest}${cleanIndex} - ${cleanTitle} [Accepted] (${language || 'C++'})`;

    problemReadmeContent =
`# [${cleanTitle}](${safeUrl})

- **Platform:** [Codeforces](https://codeforces.com)
- **Contest:** \`${cleanContest}\`
- **Problem Index:** \`${cleanIndex}\`
- **Verdict:** Accepted (AC)
- **Language:** ${language || 'C++'}
- **CPU Time:** \`${cpuTime || '-'}\`
- **Memory:** \`${memory || '-'}\`
- **Submission ID:** \`${submissionId || '-'}\`
- **Solution:** [\`solution.${ext}\`](./solution.${ext})

---

## Problem Description

${problemDescription || '_Problem statement not available. View directly on [Codeforces](' + safeUrl + ')._'}
`;
  } else {
    // Toph.co platform
    const cleanSlug = (problemSlug || 'problem').trim().toLowerCase();
    const cleanTitle = (problemTitle || cleanSlug).trim();
    const safeUrl = problemUrl || `https://toph.co/p/${cleanSlug}`;

    solutionPath = `toph/${cleanSlug}/solution.${ext}`;
    problemReadmePath = `toph/${cleanSlug}/README.md`;
    commitMsg = `Solve: ${cleanTitle} [Accepted] (${language || 'C++'})`;

    problemReadmeContent =
`# [${cleanTitle}](${safeUrl})

- **Platform:** [Toph.co](https://toph.co)
- **Problem Slug:** \`${cleanSlug}\`
- **Verdict:** Accepted (AC)
- **Language:** ${language || 'C++'}
- **CPU Time:** \`${cpuTime || '-'}\`
- **Memory:** \`${memory || '-'}\`
- **Submission ID:** \`${submissionId || '-'}\`
- **Solution:** [\`solution.${ext}\`](./solution.${ext})

---

## Problem Description

${problemDescription || '_Problem statement not available. View directly on [Toph.co](' + safeUrl + ')._'}
`;
  }

  // 1. Solution Content
  const solutionContent = code.trim() + '\n';

  // 2. Commit Solution File
  await putGitHubFile(owner, repoName, solutionPath, commitMsg, solutionContent, branch, token);

  // 3. Commit Problem README
  try {
    const readmeDocMsg = `Docs: Add problem statement for ${problemTitle || (isCF ? `${contestId}${problemIndex}` : problemSlug)}`;
    await putGitHubFile(owner, repoName, problemReadmePath, readmeDocMsg, problemReadmeContent, branch, token);
  } catch (e) {
    console.warn('[CodeToGit] Failed to update problem README (non-critical):', e);
  }

  // 4. Update Root README (Index Table of Solved Problems)
  try {
    await updateRootReadme(owner, repoName, rootReadmePath, {
      platform: isCF ? 'Codeforces' : 'Toph.co',
      title: problemTitle || (isCF ? `Codeforces ${contestId}${problemIndex}` : problemSlug),
      slug: isCF ? `${contestId}/${problemIndex}` : problemSlug,
      url: problemUrl || (isCF ? `https://codeforces.com/contest/${contestId}/problem/${problemIndex}` : `https://toph.co/p/${problemSlug}`),
      solutionPath: solutionPath,
      language: language || 'C++',
      cpuTime: cpuTime || '-',
      memory: memory || '-',
      ext
    }, branch, token);
  } catch (e) {
    console.warn('[CodeToGit] Failed to update root README index:', e);
  }

  // Increment synced count
  const newCount = (config.syncedCount || 0) + 1;
  await chrome.storage.local.set({ 
    syncedCount: newCount,
    lastSyncedProblem: problemTitle || (isCF ? `CF ${contestId}${problemIndex}` : problemSlug)
  });

  return {
    success: true,
    fileUrl: `https://github.com/${owner}/${repoName}/blob/${branch}/${solutionPath}`
  };
}

// GitHub API Helper: Fetch existing file SHA
async function getFileSha(owner, repo, path, branch, token) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const authHeader = (token.startsWith('Bearer ') || token.startsWith('token ')) ? token : `Bearer ${token}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CodeToGit-Extension/1.0.0'
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

  const authHeader = (token.startsWith('Bearer ') || token.startsWith('token ')) ? token : `Bearer ${token}`;
  const commonHeaders = {
    'Authorization': authHeader,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'CodeToGit-Extension/1.0.0'
  };

  const payload = {
    message: message,
    content: encodedContent
  };

  if (branch) {
    payload.branch = branch;
  }

  if (existing.sha) {
    payload.sha = existing.sha;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let res = await fetch(url, {
    method: 'PUT',
    headers: commonHeaders,
    body: JSON.stringify(payload)
  });

  // If branch doesn't exist on a new repository, retry without branch parameter
  if (!res.ok && (res.status === 404 || res.status === 409 || res.status === 422) && payload.branch) {
    console.warn(`[CodeToGit] PUT ${path} failed with status ${res.status}. Retrying without branch...`);
    delete payload.branch;
    res = await fetch(url, {
      method: 'PUT',
      headers: commonHeaders,
      body: JSON.stringify(payload)
    });
  }

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

  const tableHeader = '| Platform | Problem | Language | Time | Memory | Solution |\n|---|---|---|---|---|---|';
  const newRow = `| ${problemData.platform} | [${problemData.title}](${problemData.url}) | \`${problemData.language}\` | \`${problemData.cpuTime}\` | \`${problemData.memory}\` | [solution.${problemData.ext}](./${problemData.solutionPath}) |`;

  if (!content) {
    // Initial README template
    content = 
`# Competitive Programming Solutions (C++)

A collection of competitive programming solutions solved on [Codeforces](https://codeforces.com) and [Toph.co](https://toph.co), automatically synced using [CodeToGit](https://github.com/${owner}/${repo}).

## 📊 Solved Problems

${tableHeader}
${newRow}

---
*Created automatically by CodeToGit (CTG) Extension.*
`;
  } else {
    // Check if solution path is already in the table
    if (content.includes(problemData.solutionPath)) {
      return;
    }

    if (content.includes(tableHeader)) {
      content = content.replace(tableHeader, `${tableHeader}\n${newRow}`);
    } else {
      // Check legacy table format: | # | Problem | ...
      const legacyHeader = '| # | Problem | Language | Time | Memory | Solution |\n|---|---|---|---|---|---|';
      if (content.includes(legacyHeader)) {
        content = content.replace(legacyHeader, `${tableHeader}\n${newRow}`);
      } else {
        content += `\n\n## 📊 Solved Problems\n\n${tableHeader}\n${newRow}\n`;
      }
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

// Fetch Problem Data directly from Toph.co
async function fetchTophProblem(slug) {
  const cleanSlug = (slug || '')
    .replace(/.*toph\.co\/p\//i, '')
    .replace(/[\/?#].*$/, '')
    .trim()
    .toLowerCase();

  if (!cleanSlug) {
    throw new Error('Invalid problem slug');
  }

  // 1. Try toph.co JSON endpoint
  try {
    const jsonRes = await fetch(`https://toph.co/p/${cleanSlug}.json`, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeToGit/1.0'
      }
    });

    if (jsonRes.ok) {
      const json = await jsonRes.json();
      const statement = (json.statement && json.statement.en_us) 
        ? json.statement.en_us 
        : (json.statement ? Object.values(json.statement)[0] : {});
      const rawSamples = json.samples || [];
      const samples = rawSamples.map(s => ({
        stdin: (s.input || '').replace(/\r\n/g, '\n').trim(),
        expected: (s.output || '').replace(/\r\n/g, '\n').trim()
      })).filter(s => s.stdin || s.expected);

      const title = (statement && statement.title)
        ? statement.title.trim()
        : cleanSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

      return {
        slug: cleanSlug,
        title: title,
        desc: stripHtml(statement ? statement.bodyHTML || '' : ''),
        input: stripHtml(statement ? statement.inputHTML || '' : ''),
        output: stripHtml(statement ? statement.outputHTML || '' : ''),
        samples: samples.length > 0 ? samples : [{ stdin: '', expected: '' }]
      };
    }
  } catch (err) {
    console.warn('[CodeToGit Background] Toph JSON fetch error:', err);
  }

  // 2. Fallback to scraping the HTML problem page
  try {
    const htmlRes = await fetch(`https://toph.co/p/${cleanSlug}`);
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      let title = '';
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].split('|')[0].trim();
      }
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match && stripHtml(h1Match[1])) {
        title = stripHtml(h1Match[1]);
      }

      return {
        slug: cleanSlug,
        title: title || cleanSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        desc: `Problem statement for ${title || cleanSlug}. Visit https://toph.co/p/${cleanSlug} for details.`,
        input: 'Standard input format.',
        output: 'Standard output format.',
        samples: [{ stdin: '', expected: '' }]
      };
    }
  } catch (err) {
    console.warn('[CodeToGit Background] Toph HTML fetch error:', err);
  }

  throw new Error(`Could not fetch problem "${cleanSlug}" from Toph.co`);
}

// Fetch Codeforces Submission Source Code directly
async function fetchCodeforcesSubmission(url) {
  if (!url) throw new Error('No Codeforces submission URL provided');

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeToGit/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Codeforces submission (${res.status} ${res.statusText})`);
  }

  const html = await res.text();

  // Codeforces puts source in <pre id="program-source-text">...code...</pre>
  const match = html.match(/<pre[^>]*id=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i);
  if (match && match[1]) {
    const code = decodeHtmlEntities(match[1]).trim();
    return { code };
  }

  throw new Error('Could not find program source code in Codeforces submission response.');
}

// Fetch Codeforces Problem Statement & Samples
async function fetchCodeforcesProblem(contestId, problemIndex) {
  if (!contestId || !problemIndex) throw new Error('Missing contestId or problemIndex');

  const cleanContest = contestId.toString().trim();
  const cleanIndex = problemIndex.toString().trim().toUpperCase();
  const storageKey = `cf_problem_${cleanContest}${cleanIndex}`;

  // 1. Storage check (instant hit if already cached by content script)
  try {
    const stored = await getStorage([storageKey, 'cf_active_problem']);
    if (stored[storageKey] && stored[storageKey].samples && stored[storageKey].samples.length > 0 && (stored[storageKey].samples[0].stdin || stored[storageKey].desc)) {
      return stored[storageKey];
    }
    if (stored.cf_active_problem && 
        stored.cf_active_problem.contestId == cleanContest && 
        String(stored.cf_active_problem.problemIndex).toUpperCase() === cleanIndex &&
        stored.cf_active_problem.samples && stored.cf_active_problem.samples.length > 0 &&
        (stored.cf_active_problem.samples[0].stdin || stored.cf_active_problem.desc)) {
      return stored.cf_active_problem;
    }
  } catch (e) {}

  // 2. Query open tabs for any active Codeforces tab with this problem
  try {
    const tabs = await new Promise(r => chrome.tabs.query({ url: '*://*.codeforces.com/*' }, r));
    if (tabs && tabs.length > 0) {
      for (const t of tabs) {
        const u = t.url || '';
        if (u.includes(`/${cleanContest}/`) && u.toUpperCase().includes(`/${cleanIndex}`)) {
          const tabData = await new Promise(resolve => {
            chrome.tabs.sendMessage(t.id, { action: 'GET_PAGE_PROBLEM_DATA' }, res => {
              if (res && res.success && res.data) resolve(res.data);
              else resolve(null);
            });
          });
          if (tabData && tabData.samples && tabData.samples.length > 0 && (tabData.samples[0].stdin || tabData.desc)) {
            chrome.storage.local.set({ [storageKey]: tabData, cf_active_problem: tabData });
            return tabData;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[CodeToGit Background] Tab query check failed:', e);
  }

  // 3. Official Codeforces REST API query for problem metadata
  let apiProblem = null;
  try {
    const apiRes = await fetch('https://codeforces.com/api/problemset.problems');
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData.status === 'OK' && apiData.result && apiData.result.problems) {
        apiProblem = apiData.result.problems.find(p => p.contestId == cleanContest && String(p.index).toUpperCase() === cleanIndex);
      }
    }
  } catch (e) {
    console.warn('[CodeToGit Background] CF API query failed:', e);
  }

  const cfUrl = `https://codeforces.com/contest/${cleanContest}/problem/${cleanIndex}`;

  // 4. Try opening a background tab to let content script scrape the real statement and sample tests
  try {
    const tempTab = await new Promise(r => chrome.tabs.create({ url: cfUrl, active: false }, r));
    if (tempTab && tempTab.id) {
      const scraped = await new Promise(resolve => {
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const data = await getStorage([storageKey]);
          if (data[storageKey] && data[storageKey].samples && data[storageKey].samples[0] && (data[storageKey].samples[0].stdin || data[storageKey].samples[0].expected)) {
            clearInterval(interval);
            try { chrome.tabs.remove(tempTab.id); } catch(e) {}
            resolve(data[storageKey]);
          } else if (attempts >= 12) { // 3.6s timeout
            clearInterval(interval);
            try { chrome.tabs.remove(tempTab.id); } catch(e) {}
            resolve(null);
          }
        }, 300);
      });
      if (scraped) return scraped;
    }
  } catch (e) {
    console.warn('[CodeToGit Background] Background tab scrape failed:', e);
  }

  // 5. Fallback compiled metadata with official API info
  const problemTitle = apiProblem ? `${cleanContest}${cleanIndex} - ${apiProblem.name}` : `Codeforces ${cleanContest}${cleanIndex}`;
  const tagsStr = (apiProblem && apiProblem.tags && apiProblem.tags.length > 0) ? apiProblem.tags.join(', ') : 'competitive programming';
  const ratingStr = (apiProblem && apiProblem.rating) ? `Rating: ${apiProblem.rating}` : 'Unrated';

  const fallback = {
    slug: `cf_${cleanContest}${cleanIndex}`,
    contestId: cleanContest,
    problemIndex: cleanIndex,
    title: problemTitle,
    timeLimit: '1.0s',
    memoryLimit: '256MB',
    desc: `Problem: ${problemTitle}\n${ratingStr} | Tags: ${tagsStr}\n\nOfficial Link: ${cfUrl}\n\nPaste sample tests into the workbench or open the problem in your browser. When finished, click "Submit on Codeforces" or "Push to GitHub".`,
    input: 'Standard input format (cin >> ...)',
    output: 'Standard output format (cout << ...)',
    samples: [{ stdin: '', expected: '' }],
    platform: 'codeforces',
    url: cfUrl
  };

  chrome.storage.local.set({ [storageKey]: fallback });
  return fallback;
}

function cleanSampleText(str) {
  if (!str) return '';
  return decodeHtmlEntities(str)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div class=["']test-example-line["']>([\s\S]*?)<\/div>/gi, '$1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}
