// TophHub Content Script - Monitors Toph.co submissions and extracts accepted C++ solutions

(function () {
  'use strict';

  // Route based on URL
  const currentPath = window.location.pathname;

  if (currentPath.startsWith('/s/')) {
    initSubmissionWatcher();
  } else if (currentPath.startsWith('/p/')) {
    initProblemAutoSubmit();
  }

  function initSubmissionWatcher() {
    const submissionId = currentPath.split('/')[2];
    if (!submissionId) return;

    console.log(`[TophHub] Watching submission: ${submissionId}`);

    let syncAttempted = false;
    let checkInterval = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // Check for up to 30 seconds

    checkVerdict();
    checkInterval = setInterval(() => {
      attempts++;
      if (syncAttempted || attempts >= MAX_ATTEMPTS) {
        clearInterval(checkInterval);
        return;
      }
      checkVerdict();
    }, 1000);

  async function checkVerdict() {
    if (syncAttempted) return;

    // Check if autoSync is enabled in extension storage
    const config = await getStorage(['autoSync', 'githubToken', 'repo']);
    if (!config.githubToken || !config.repo) {
      // User hasn't configured token or repo yet
      return;
    }
    if (config.autoSync === false) {
      return;
    }

    // Check if this submission has already been synced
    const syncedKey = `synced_${submissionId}`;
    const alreadySynced = await getStorage([syncedKey]);
    if (alreadySynced[syncedKey]) {
      return;
    }

    const verdict = findVerdictText();
    if (!verdict) return;

    if (verdict.toLowerCase().includes('accepted')) {
      syncAttempted = true;
      clearInterval(checkInterval);
      handleAcceptedSubmission(config);
    } else if (isPendingVerdict(verdict)) {
      // Still running/judging, keep polling
      console.log(`[TophHub] Submission ${submissionId} verdict: ${verdict} (waiting...)`);
    } else {
      // Final verdict is not accepted (e.g. Wrong Answer, TLE, etc.)
      clearInterval(checkInterval);
      console.log(`[TophHub] Submission ${submissionId} verdict: ${verdict} (not accepted)`);
    }
  }

  function isPendingVerdict(text) {
    const lower = text.toLowerCase();
    return lower.includes('queue') || lower.includes('run') || lower.includes('judg') || lower.includes('wait');
  }

  function findVerdictText() {
    // Look for verdict elements in Toph DOM
    // Common selectors on Toph: .verdict, .label-success, [data-verdict], or table cells
    const selectors = [
      '.verdict',
      '.submission-verdict',
      '.label-success',
      '.tag.is-success',
      '.text-success',
      'span[class*="verdict"]',
      'div[class*="verdict"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    // Fallback: search table rows or definition lists
    const tableCells = document.querySelectorAll('td, th, dd, dt, span, div');
    for (const cell of tableCells) {
      const text = cell.textContent.trim();
      if (text === 'Accepted' || text === 'Accepted (AC)' || text.startsWith('Accepted')) {
        return 'Accepted';
      }
    }

    return null;
  }

  async function handleAcceptedSubmission(config) {
    console.log('[TophHub] Submission is Accepted! Preparing to sync to GitHub...');
    showToast({
      title: 'TophHub: Accepted Submission Detected',
      desc: 'Extracting C++ source code & problem details...',
      type: 'loading'
    });

    try {
      const data = await extractSubmissionData();
      if (!data.code) {
        throw new Error('Could not find submission source code on this page.');
      }

      showToast({
        title: `TophHub: Syncing ${data.problemTitle}`,
        desc: 'Committing solution and README to GitHub...',
        type: 'loading'
      });

      // Send to background script to commit via GitHub API
      chrome.runtime.sendMessage({
        action: 'COMMIT_SOLUTION',
        payload: {
          ...data,
          submissionId: submissionId
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          showToast({
            title: 'TophHub Sync Error',
            desc: chrome.runtime.lastError.message,
            type: 'error'
          });
          return;
        }

        if (response && response.success) {
          // Mark this submission as synced in storage
          const saveObj = {};
          saveObj[`synced_${submissionId}`] = true;
          saveObj['lastSyncedProblem'] = data.problemTitle;
          chrome.storage.local.set(saveObj);

          showToast({
            title: `🎉 Synced with GitHub!`,
            desc: `${data.problemTitle} committed to ${config.repo}`,
            type: 'success',
            link: response.fileUrl,
            linkText: 'View on GitHub ↗'
          });
        } else {
          showToast({
            title: 'TophHub Sync Failed',
            desc: response ? response.error : 'Unknown GitHub API error',
            type: 'error'
          });
        }
      });
    } catch (err) {
      console.error('[TophHub] Error during sync:', err);
      showToast({
        title: 'TophHub Error',
        desc: err.message || 'Failed to extract submission details',
        type: 'error'
      });
    }
  }

  async function extractSubmissionData() {
    // 1. Extract Problem Slug and Title
    let problemSlug = '';
    let problemTitle = '';
    const problemLink = document.querySelector('a[href*="/p/"]');
    if (problemLink) {
      const href = problemLink.getAttribute('href');
      const match = href.match(/\/p\/([a-zA-Z0-9_-]+)/);
      if (match) {
        problemSlug = match[1];
      }
      problemTitle = problemLink.textContent.trim();
    }

    if (!problemSlug) {
      // Try from document title or URL
      const titleMatch = document.title.split('-')[0].trim();
      problemTitle = titleMatch || 'Toph Problem';
      problemSlug = problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    // 2. Extract Language, CPU Time, and Memory
    let language = 'C++';
    let cpuTime = '-';
    let memory = '-';

    const textNodes = document.querySelectorAll('tr, div, li, dd, p');
    for (const node of textNodes) {
      const t = node.textContent;
      if (t.includes('Language') || t.includes('Compiler')) {
        const langMatch = t.match(/(?:Language|Compiler)[:\s]+([^\n\r,]+)/i);
        if (langMatch) language = langMatch[1].trim();
      }
      if (t.includes('CPU') || t.includes('Time')) {
        const timeMatch = t.match(/(\d+(?:\.\d+)?\s*(?:s|ms|seconds))/i);
        if (timeMatch) cpuTime = timeMatch[1].trim();
      }
      if (t.includes('Memory')) {
        const memMatch = t.match(/(\d+(?:\.\d+)?\s*(?:MB|KB|GB|bytes))/i);
        if (memMatch) memory = memMatch[1].trim();
      }
    }

    // 3. Extract Source Code
    let code = '';
    const codeContainer = document.querySelector(
      'pre code, pre.source-code, .source-code pre, #source-code, .source-code, pre'
    );
    if (codeContainer) {
      code = codeContainer.innerText || codeContainer.textContent;
    }

    // Clean up code trailing spaces
    code = code.trim();

    // 4. Fetch problem statement content from Toph problem page or API
    let problemDescription = '';
    let sampleCases = [];
    try {
      const problemRes = await fetch(`https://toph.co/p/${problemSlug}`);
      if (problemRes.ok) {
        const htmlText = await problemRes.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Extract Title from problem page if not already clean
        const heading = doc.querySelector('h1, .problem-title, .title');
        if (heading && heading.textContent.trim()) {
          problemTitle = heading.textContent.trim();
        }

        // Extract body content or statement
        const statementEl = doc.querySelector('.problem-statement, .panel-body, article, .content');
        if (statementEl) {
          problemDescription = htmlToMarkdown(statementEl.innerHTML);
        }
      }
    } catch (e) {
      console.warn('[TophHub] Unable to fetch problem statement:', e);
    }

    return {
      problemSlug,
      problemTitle,
      language,
      cpuTime,
      memory,
      code,
      problemDescription,
      problemUrl: `https://toph.co/p/${problemSlug}`
    };
  }

  // Simple HTML to readable Markdown converter
  function htmlToMarkdown(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove scripts and styles
    temp.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());

    let text = temp.innerHTML;
    // Replace headings
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
    // Replace bold/italic
    text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    // Replace code
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
    // Replace paragraphs and line breaks
    text = text.replace(/<p[^>]*>/gi, '\n\n');
    text = text.replace(/<\/p>/gi, '');
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    const decoder = document.createElement('textarea');
    decoder.innerHTML = text;
    return decoder.value.trim();
  }

  // Floating Toast Notification
  function showToast({ title, desc, type, link, linkText }) {
    let toast = document.getElementById('tophhub-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tophhub-toast';
      toast.className = 'tophhub-toast';
      document.body.appendChild(toast);
    }

    const spinnerHtml = type === 'loading' ? '<span class="tophhub-spinner"></span>' : '';
    const linkHtml = link ? `<a href="${link}" target="_blank" class="tophhub-link">${linkText || 'View'}</a>` : '';

    toast.innerHTML = `
      <div class="tophhub-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div class="tophhub-content">
        <div class="tophhub-title">
          ${spinnerHtml}
          <span>${escapeHtml(title)}</span>
          <span class="badge">C++</span>
        </div>
        <div class="tophhub-desc">${escapeHtml(desc)}</div>
        ${linkHtml}
      </div>
      <button class="tophhub-close" title="Close">×</button>
    `;

    toast.querySelector('.tophhub-close').addEventListener('click', () => {
      toast.remove();
    });

    if (type === 'success') {
      setTimeout(() => {
        if (toast && toast.parentElement) {
          toast.remove();
        }
      }, 8000);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // Auto-Submission Handler for Toph.co Problem Pages
  async function initProblemAutoSubmit() {
    const slugMatch = currentPath.match(/\/p\/([a-zA-Z0-9_-]+)/);
    const pageSlug = slugMatch ? slugMatch[1] : '';
    const hasHash = window.location.hash === '#tophhub-submit';

    const storageData = await getStorage(['pending_submission']);
    const pending = storageData.pending_submission;

    if (!pending && !hasHash) return;

    // Check freshness (within 10 minutes)
    if (pending) {
      const isFresh = (Date.now() - (pending.timestamp || 0)) < 10 * 60 * 1000;
      if (!isFresh) {
        chrome.storage.local.remove(['pending_submission']);
        return;
      }
      if (pageSlug && pending.slug && pageSlug !== pending.slug) {
        return;
      }
    }

    console.log('[TophHub] Problem page loaded with auto-submit request! Auto-filling...', pending);

    showToast({
      title: 'TophHub: Auto-Submitting C++',
      desc: 'Injecting solution and submitting to Toph judge...',
      type: 'loading'
    });

    // Wait 1 second for Toph dynamic DOM components to load
    setTimeout(async () => {
      const code = pending ? pending.code : '';
      const success = await injectCodeAndSubmit(code);

      if (success) {
        chrome.storage.local.remove(['pending_submission']);
        if (window.location.hash === '#tophhub-submit') {
          history.replaceState(null, null, ' ');
        }
        showToast({
          title: '🚀 Auto-Submitted!',
          desc: 'Solution sent to Toph judge. Waiting for evaluation...',
          type: 'success'
        });
      } else {
        showToast({
          title: 'Auto-fill Notice',
          desc: 'Your solution has been copied to the clipboard. Please paste and submit.',
          type: 'error'
        });
      }
    }, 1200);
  }

  async function injectCodeAndSubmit(code) {
    if (!code) {
      try {
        code = await navigator.clipboard.readText();
      } catch (e) {}
    }
    if (!code) return false;

    // 1. Activate Submit Tab / Modal if exists
    const submitTriggers = [
      'a[href*="#submit"]',
      'a[href*="/submit"]',
      '.tabs a',
      '.btn-submit',
      'button[data-target*="submit"]',
      '#submit-tab'
    ];

    for (const sel of submitTriggers) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.textContent.toLowerCase().includes('submit')) {
          el.click();
          await sleep(400);
          break;
        }
      }
    }

    // 2. Select C++ in Compiler / Language Dropdown
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      for (const opt of select.options) {
        const txt = (opt.textContent || '').toLowerCase();
        const val = (opt.value || '').toLowerCase();
        if (txt.includes('c++') || txt.includes('cpp') || val.includes('cpp')) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }

    // 3. Inject Source Code
    let injected = false;

    // Check CodeMirror
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      cmEl.CodeMirror.setValue(code);
      injected = true;
    }

    // Check Ace Editor
    if (!injected && window.ace) {
      const aceEl = document.querySelector('.ace_editor');
      if (aceEl) {
        const editor = window.ace.edit(aceEl);
        if (editor) {
          editor.setValue(code, 1);
          injected = true;
        }
      }
    }

    // Check standard Textarea
    if (!injected) {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetParent !== null) { // visible
          ta.value = code;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          injected = true;
          break;
        }
      }
    }

    await sleep(600);

    // 4. Click Submit Button
    const submitBtns = document.querySelectorAll('form button, form input[type="submit"], button.btn-primary');
    for (const btn of submitBtns) {
      const txt = (btn.textContent || btn.value || '').toLowerCase();
      if (txt.includes('submit') || btn.type === 'submit') {
        btn.click();
        return true;
      }
    }

    return injected;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getStorage(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }
})();
