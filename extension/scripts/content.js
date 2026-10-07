// CodeToGit (CTG) Content Script - Monitors Toph.co & Codeforces submissions and syncs accepted solutions to GitHub

(function () {
  'use strict';

  // Native Web Audio API Sound Generator for Verdicts
  const SoundManager = (function () {
    let audioCtx = null;
    function initCtx() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
    function playAccepted() {
      try {
        initCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const notes = [
          { freq: 659.25, time: 0.00, dur: 0.25, gain: 0.35 },
          { freq: 830.61, time: 0.07, dur: 0.25, gain: 0.40 },
          { freq: 987.77, time: 0.14, dur: 0.30, gain: 0.45 },
          { freq: 1318.51, time: 0.21, dur: 0.52, gain: 0.55 }
        ];
        notes.forEach(({ freq, time, dur, gain: noteGain }) => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + time);
          g.gain.setValueAtTime(0.0001, now + time);
          g.gain.exponentialRampToValueAtTime(0.35 * noteGain, now + time + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
          osc.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } catch (e) {}
    }
    function playNotAccepted() {
      try {
        initCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const tones = [
          { freq: 360.0, time: 0.00, dur: 0.22, gain: 0.45 },
          { freq: 240.0, time: 0.12, dur: 0.38, gain: 0.50 }
        ];
        tones.forEach(({ freq, time, dur, gain: toneGain }) => {
          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          const filter = audioCtx.createBiquadFilter();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + time);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(750, now + time);
          filter.Q.setValueAtTime(2.5, now + time);
          g.gain.setValueAtTime(0.0001, now + time);
          g.gain.exponentialRampToValueAtTime(0.35 * toneGain, now + time + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
          osc.connect(filter);
          filter.connect(g);
          g.connect(audioCtx.destination);
          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } catch (e) {}
    }
    return { playAccepted, playNotAccepted };
  })();

  // Shared Floating Toast Notification
  function showToast({ title, desc, type, link, linkText }) {
    let toast = document.getElementById('codetogit-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'codetogit-toast';
      toast.className = 'codetogit-toast';
      document.body.appendChild(toast);
    }

    const spinnerHtml = type === 'loading' ? '<span class="codetogit-spinner"></span>' : '';
    const linkHtml = link ? `<a href="${link}" target="_blank" class="codetogit-link">${linkText || 'View'}</a>` : '';

    toast.innerHTML = `
      <div class="codetogit-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </div>
      <div class="codetogit-content">
        <div class="codetogit-title">
          ${spinnerHtml}
          <span>${escapeHtml(title)}</span>
          <span class="badge">CodeToGit</span>
        </div>
        <div class="codetogit-desc">${escapeHtml(desc)}</div>
        ${linkHtml}
      </div>
      <button class="codetogit-close" title="Close">×</button>
    `;

    toast.querySelector('.codetogit-close').addEventListener('click', () => {
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

  function getStorage(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // PLATFORM ROUTER
  // ==========================================
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('codeforces.com') || hostname.includes('codeforces.ml') || hostname.includes('codeforces.net')) {
    initCodeforces();
  } else if (hostname.includes('toph.co')) {
    initToph();
  }

  // ==========================================
  // CODEFORCES MODULE
  // ==========================================
  function initCodeforces() {
    console.log('[CodeToGit] Codeforces module initialized on:', window.location.pathname);
    const pathname = window.location.pathname;

    // 1. Single Submission View page: e.g. /contest/1900/submission/24000000 or /problemset/submission/1900/24000000
    if (pathname.includes('/submission/')) {
      initCodeforcesSubmissionPage();
      return;
    }

    // 2. Submissions / My Submissions / Status table page
    if (pathname.includes('/my') || pathname.includes('/status') || pathname.includes('/submissions/')) {
      initCodeforcesStatusWatcher();
      return;
    }

    // 3. Problem View page: e.g. /contest/1900/problem/A or /problemset/problem/1900/A
    if (pathname.includes('/problem/')) {
      initCodeforcesProblemPage();
    }
  }

  // A. Codeforces Single Submission Page (/submission/:id)
  function initCodeforcesSubmissionPage() {
    const subMatch = window.location.pathname.match(/\/submission\/([0-9]+)/);
    const submissionId = subMatch ? subMatch[1] : '';
    if (!submissionId) return;

    let syncAttempted = false;
    let attempts = 0;
    const maxAttempts = 30;

    const timer = setInterval(async () => {
      attempts++;
      if (syncAttempted || attempts > maxAttempts) {
        clearInterval(timer);
        return;
      }

      // Check verdict
      const verdictEl = document.querySelector('.verdict-accepted, .verdict-rejected, .verdict-waiting, span[class*="verdict"]');
      const verdictText = (verdictEl ? verdictEl.textContent : '') || '';

      if (isCodeforcesAccepted(verdictText)) {
        syncAttempted = true;
        clearInterval(timer);
        SoundManager.playAccepted();
        await handleAcceptedCodeforcesSubmission(submissionId);
      } else if (isCodeforcesFailed(verdictText)) {
        syncAttempted = true;
        clearInterval(timer);
        SoundManager.playNotAccepted();
      }
    }, 1200);
  }

  // B. Codeforces Status Table Watcher (/contest/:id/my or /problemset/status)
  function initCodeforcesStatusWatcher() {
    const processedSubs = new Set();

    async function checkRows() {
      const rows = document.querySelectorAll('table.status-frame-datatable tr[data-submission-id], .datatable tr[data-submission-id]');
      if (!rows || rows.length === 0) return;

      for (const row of rows) {
        const subId = row.getAttribute('data-submission-id');
        if (!subId || processedSubs.has(subId)) continue;

        const statusCell = row.querySelector('.status-cell, td[class*="status"]');
        if (!statusCell) continue;

        const cellText = statusCell.textContent.trim();
        if (isCodeforcesAccepted(cellText)) {
          processedSubs.add(subId);

          // Check if already synced in chrome storage
          const syncedKey = `synced_cf_${subId}`;
          const stored = await getStorage([syncedKey, 'autoSync', 'githubToken', 'repo']);
          if (stored[syncedKey]) continue;

          if (!stored.githubToken || !stored.repo) {
            showToast({
              title: 'CodeToGit: Accepted Submission Detected!',
              desc: 'Click CodeToGit extension icon to connect your GitHub repo and enable auto-sync.',
              type: 'warning'
            });
            continue;
          }

          if (stored.autoSync === false) {
            continue;
          }

          SoundManager.playAccepted();
          await handleAcceptedCodeforcesRow(row, subId, stored);
        } else if (isCodeforcesFailed(cellText)) {
          processedSubs.add(subId);
        }
      }
    }

    // Run immediately and poll periodically as judge evaluates
    checkRows();
    const interval = setInterval(checkRows, 2000);
    setTimeout(() => clearInterval(interval), 120000); // Poll for up to 2 minutes

    // MutationObserver for live updates
    const table = document.querySelector('table.status-frame-datatable, .datatable');
    if (table) {
      const observer = new MutationObserver(() => checkRows());
      observer.observe(table, { childList: true, subtree: true, characterData: true });
    }
  }

  // C. Codeforces Problem Page (/contest/:id/problem/:idx or /problemset/problem/:id/:idx)
  function initCodeforcesProblemPage() {
    const cfInfo = parseCodeforcesProblemUrl(window.location.pathname);
    if (!cfInfo) return;

    function processProblem() {
      const fullProblemData = extractCodeforcesPageProblem();
      if (fullProblemData) {
        chrome.storage.local.set({
          cf_active_problem: fullProblemData,
          [`cf_problem_${cfInfo.contestId}${cfInfo.problemIndex}`]: fullProblemData,
          last_problem_platform: 'codeforces'
        });
        injectCodeforcesIdeButton(cfInfo.contestId, cfInfo.problemIndex);
        return true;
      }
      return false;
    }

    if (!processProblem()) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (processProblem() || attempts >= 12) {
          clearInterval(interval);
        }
      }, 300);
    }

    // Auto-fill solution code if submitted from CodeToGit IDE
    chrome.storage.local.get(['cf_pending_code'], (data) => {
      const pending = data.cf_pending_code;
      if (pending && pending.contestId == cfInfo.contestId && String(pending.problemIndex).toUpperCase() === cfInfo.problemIndex) {
        const isFresh = (Date.now() - (pending.timestamp || 0)) < 15 * 60 * 1000;
        if (isFresh && pending.code) {
          setTimeout(() => {
            const textarea = document.querySelector('textarea[name="source"], #sourceCodeTextarea, textarea.source');
            if (textarea) {
              textarea.value = pending.code;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              showToast({
                title: 'CodeToGit IDE',
                desc: '✔ Automatically pasted your C++ solution into the submit box!',
                type: 'success'
              });
            }
          }, 800);
        }
      }
    });

    // Intercept submit form to cache solution code
    const submitForms = document.querySelectorAll('form.submitForm, form[action*="submit"]');
    submitForms.forEach(form => {
      form.addEventListener('submit', () => {
        try {
          const textarea = form.querySelector('textarea[name="source"], #sourceCodeTextarea');
          const fileInput = form.querySelector('input[type="file"][name="sourceFile"]');
          let code = '';

          if (textarea && textarea.value) {
            code = textarea.value.trim();
          }

          if (code) {
            chrome.storage.local.set({
              cf_pending_code: {
                contestId: cfInfo.contestId,
                problemIndex: cfInfo.problemIndex,
                title: `${cfInfo.contestId}${cfInfo.problemIndex}`,
                code: code,
                timestamp: Date.now()
              }
            });
          } else if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target && e.target.result) {
                chrome.storage.local.set({
                  cf_pending_code: {
                    contestId: cfInfo.contestId,
                    problemIndex: cfInfo.problemIndex,
                    title: `${cfInfo.contestId}${cfInfo.problemIndex}`,
                    code: e.target.result.trim(),
                    timestamp: Date.now()
                  }
                });
              }
            };
            reader.readAsText(file);
          }
        } catch (e) {}
      }, true);
    });
  }

  async function handleAcceptedCodeforcesRow(row, submissionId, config) {
    showToast({
      title: 'CodeToGit: Accepted Submission Detected',
      desc: `Extracting Codeforces submission #${submissionId}...`,
      type: 'loading'
    });

    try {
      // 1. Extract problem link
      const problemLink = row.querySelector('td[data-problemid] a, a[href*="/problem/"]');
      let problemTitle = problemLink ? problemLink.textContent.trim() : '';
      let problemUrl = problemLink ? problemLink.href : '';
      let parsed = parseCodeforcesProblemUrl(problemUrl || window.location.pathname);
      let contestId = parsed ? parsed.contestId : '';
      let problemIndex = parsed ? parsed.problemIndex : '';

      // 2. Language, Time, Memory
      const langCell = row.querySelector('td:nth-child(5), td[class*="lang"]');
      const language = langCell ? langCell.textContent.trim() : 'C++';
      const timeCell = row.querySelector('.time-consumed-cell, td[class*="time"]');
      const cpuTime = timeCell ? timeCell.textContent.trim() : '-';
      const memCell = row.querySelector('.memory-consumed-cell, td[class*="memory"]');
      const memory = memCell ? memCell.textContent.trim() : '-';

      // 3. Obtain Source Code
      let code = '';
      // Check cached pending code first
      const stored = await getStorage(['cf_pending_code']);
      if (stored.cf_pending_code && (Date.now() - (stored.cf_pending_code.timestamp || 0)) < 15 * 60 * 1000) {
        if (!contestId || stored.cf_pending_code.contestId === contestId) {
          code = stored.cf_pending_code.code;
        }
      }

      // If not cached, fetch via background worker from submission page
      if (!code) {
        let subUrl = `https://codeforces.com/contest/${contestId || '0'}/submission/${submissionId}`;
        const subLink = row.querySelector('a[href*="/submission/"]');
        if (subLink) subUrl = subLink.href;

        const subRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'FETCH_CF_SUBMISSION', url: subUrl }, resolve);
        });

        if (subRes && subRes.success && subRes.data && subRes.data.code) {
          code = subRes.data.code;
        }
      }

      if (!code) {
        throw new Error(`Could not retrieve source code for Codeforces submission #${submissionId}.`);
      }

      // 4. Fetch problem statement if needed
      let problemDescription = '';
      if (contestId && problemIndex) {
        const probRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'FETCH_CF_PROBLEM', contestId, problemIndex }, resolve);
        });
        if (probRes && probRes.success && probRes.data) {
          if (!problemTitle || problemTitle.includes(problemIndex)) {
            problemTitle = probRes.data.title || problemTitle;
          }
          problemDescription = probRes.data.desc || '';
        }
      }

      showToast({
        title: `CodeToGit: Syncing ${problemTitle || `CF ${contestId}${problemIndex}`}`,
        desc: 'Committing solution and README to GitHub...',
        type: 'loading'
      });

      // 5. Send commit payload to background
      chrome.runtime.sendMessage({
        action: 'COMMIT_SOLUTION',
        payload: {
          platform: 'codeforces',
          contestId,
          problemIndex,
          problemTitle: problemTitle || `CF ${contestId}${problemIndex}`,
          language,
          cpuTime,
          memory,
          code,
          problemDescription,
          problemUrl,
          submissionId
        }
      }, (res) => {
        if (chrome.runtime.lastError) {
          showToast({ title: 'CodeToGit Sync Error', desc: chrome.runtime.lastError.message, type: 'error' });
          return;
        }

        if (res && res.success) {
          const saveObj = {};
          saveObj[`synced_cf_${submissionId}`] = true;
          chrome.storage.local.set(saveObj);

          showToast({
            title: '🎉 Synced with GitHub!',
            desc: `${problemTitle || `CF ${contestId}${problemIndex}`} committed to ${config.repo}`,
            type: 'success',
            link: res.fileUrl,
            linkText: 'View on GitHub ↗'
          });
        } else {
          showToast({
            title: 'CodeToGit Sync Failed',
            desc: res ? res.error : 'Unknown GitHub API error',
            type: 'error'
          });
        }
      });
    } catch (err) {
      console.error('[CodeToGit] Codeforces sync error:', err);
      showToast({ title: 'CodeToGit Error', desc: err.message, type: 'error' });
    }
  }

  async function handleAcceptedCodeforcesSubmission(submissionId) {
    const config = await getStorage(['githubToken', 'repo', 'autoSync', `synced_cf_${submissionId}`]);
    if (!config.githubToken || !config.repo) {
      showToast({
        title: 'CodeToGit: Accepted Submission Detected!',
        desc: 'Click CodeToGit extension icon to connect your GitHub repo and enable auto-sync.',
        type: 'warning'
      });
      return;
    }
    if (config.autoSync === false || config[`synced_cf_${submissionId}`]) return;

    // Extract code from #program-source-text
    const sourceEl = document.getElementById('program-source-text');
    let code = sourceEl ? sourceEl.textContent.trim() : '';

    // Extract metadata from table
    const problemLink = document.querySelector('a[href*="/problem/"]');
    const problemUrl = problemLink ? problemLink.href : window.location.href;
    const problemTitle = problemLink ? problemLink.textContent.trim() : 'Codeforces Problem';
    const parsed = parseCodeforcesProblemUrl(problemUrl);
    const contestId = parsed ? parsed.contestId : '';
    const problemIndex = parsed ? parsed.problemIndex : '';

    let language = 'C++';
    let cpuTime = '-';
    let memory = '-';

    const cells = document.querySelectorAll('td, th, span');
    cells.forEach(c => {
      const txt = c.textContent.trim();
      if (txt.includes('GNU C++') || txt.includes('Clang') || txt.includes('Python')) language = txt;
      if (txt.match(/\d+\s*(?:ms|s)/i)) cpuTime = txt;
      if (txt.match(/\d+\s*(?:KB|MB)/i)) memory = txt;
    });

    if (!code) {
      showToast({ title: 'CodeToGit Notice', desc: 'Could not find source code on this page.', type: 'error' });
      return;
    }

    showToast({
      title: `CodeToGit: Syncing ${problemTitle}`,
      desc: 'Committing solution and README to GitHub...',
      type: 'loading'
    });

    chrome.runtime.sendMessage({
      action: 'COMMIT_SOLUTION',
      payload: {
        platform: 'codeforces',
        contestId,
        problemIndex,
        problemTitle,
        language,
        cpuTime,
        memory,
        code,
        problemUrl,
        submissionId
      }
    }, (res) => {
      if (res && res.success) {
        const saveObj = {};
        saveObj[`synced_cf_${submissionId}`] = true;
        chrome.storage.local.set(saveObj);

        showToast({
          title: '🎉 Synced with GitHub!',
          desc: `${problemTitle} committed to ${config.repo}`,
          type: 'success',
          link: res.fileUrl,
          linkText: 'View on GitHub ↗'
        });
      } else {
        showToast({
          title: 'CodeToGit Sync Failed',
          desc: res ? res.error : 'Unknown error',
          type: 'error'
        });
      }
    });
  }

  function isCodeforcesAccepted(text) {
    if (!text) return false;
    const lower = text.trim().toLowerCase();
    return lower === 'accepted' || lower === 'ok' || lower.startsWith('accepted') || lower.includes('verdict-accepted');
  }

  function isCodeforcesFailed(text) {
    if (!text) return false;
    const lower = text.trim().toLowerCase();
    return lower.includes('wrong') || lower.includes('time limit') || lower.includes('memory limit') || 
           lower.includes('runtime') || lower.includes('compilation error') || lower.includes('denial');
  }

  function parseCodeforcesProblemUrl(url) {
    if (!url) return null;
    const match = url.match(/(?:contest|gym|problemset\/problem)\/([0-9]+)\/(?:problem\/)?([a-zA-Z0-9]+)/i);
    if (match) {
      return {
        contestId: match[1],
        problemIndex: match[2].toUpperCase()
      };
    }
    return null;
  }

  function extractCodeforcesPageProblem() {
    const statementEl = document.querySelector('.problem-statement');
    if (!statementEl) return null;

    const cfInfo = parseCodeforcesProblemUrl(window.location.pathname);
    const contestId = cfInfo ? cfInfo.contestId : '';
    const problemIndex = cfInfo ? cfInfo.problemIndex : '';

    const titleEl = statementEl.querySelector('.header .title');
    const rawTitle = titleEl ? titleEl.textContent.trim() : `${contestId}${problemIndex}`;
    const cleanTitle = `${contestId}${problemIndex} - ${rawTitle.replace(/^[A-Z0-9]+\.\s*/, '')}`;

    const timeLimitEl = statementEl.querySelector('.time-limit');
    const memoryLimitEl = statementEl.querySelector('.memory-limit');
    const timeLimit = timeLimitEl ? timeLimitEl.textContent.replace(/.*time limit per test/i, '').trim() : '1.0s';
    const memoryLimit = memoryLimitEl ? memoryLimitEl.textContent.replace(/.*memory limit per test/i, '').trim() : '256MB';

    let bodyText = '';
    const bodyDivs = statementEl.querySelectorAll(':scope > div:not(.header):not(.input-specification):not(.output-specification):not(.sample-tests):not(.sample-test):not(.note)');
    bodyDivs.forEach(div => {
      const txt = (div.innerText || div.textContent || '').trim();
      if (txt) bodyText += txt + '\n\n';
    });

    const inputSpecEl = statementEl.querySelector('.input-specification');
    const outputSpecEl = statementEl.querySelector('.output-specification');
    const inputFormat = inputSpecEl ? inputSpecEl.innerText.replace(/^Input\s*/i, '').trim() : 'Standard input';
    const outputFormat = outputSpecEl ? outputSpecEl.innerText.replace(/^Output\s*/i, '').trim() : 'Standard output';

    const samples = [];
    const sampleTestEl = statementEl.querySelector('.sample-test, .sample-tests, .sample-test-wrapper');
    if (sampleTestEl) {
      const inputs = sampleTestEl.querySelectorAll('.input pre, pre.input');
      const outputs = sampleTestEl.querySelectorAll('.output pre, pre.output');
      const maxCount = Math.max(inputs.length, outputs.length);
      for (let i = 0; i < maxCount; i++) {
        const inText = inputs[i] ? cleanCfSamplePre(inputs[i]) : '';
        const outText = outputs[i] ? cleanCfSamplePre(outputs[i]) : '';
        if (inText || outText) {
          samples.push({ stdin: inText, expected: outText });
        }
      }
    }

    return {
      contestId,
      problemIndex,
      slug: `cf_${contestId}${problemIndex}`,
      title: cleanTitle,
      timeLimit,
      memoryLimit,
      desc: bodyText.trim() || cleanTitle,
      input: inputFormat,
      output: outputFormat,
      samples: samples.length > 0 ? samples : [{ stdin: '', expected: '' }],
      platform: 'codeforces',
      url: window.location.href
    };
  }

  function cleanCfSamplePre(preEl) {
    if (!preEl) return '';
    const lines = preEl.querySelectorAll('.test-example-line, .test-example-line-even, .test-example-line-odd');
    if (lines && lines.length > 0) {
      return Array.from(lines).map(l => l.innerText || l.textContent || '').join('\n').trim();
    }
    const clone = preEl.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return (clone.innerText || clone.textContent || '').replace(/\r\n/g, '\n').trim();
  }

  function injectCodeforcesIdeButton(contestId, problemIndex) {
    if (document.getElementById('ctg-cf-open-ide-btn')) return;
    const headerEl = document.querySelector('.problem-statement .header');
    if (!headerEl) return;

    const btn = document.createElement('button');
    btn.id = 'ctg-cf-open-ide-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: -2px; margin-right: 6px;">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      <span>Solve in CodeToGit IDE</span>
    `;
    btn.style.cssText = 'display: inline-flex; align-items: center; margin: 10px 0; padding: 7px 16px; background: linear-gradient(135deg, #4f46e5, #06b6d4); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; cursor: pointer; box-shadow: 0 2px 10px rgba(79,70,229,0.35); transition: all 0.15s ease;';
    btn.onmouseover = () => { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 4px 14px rgba(79,70,229,0.5)'; };
    btn.onmouseout = () => { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 2px 10px rgba(79,70,229,0.35)'; };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const probData = extractCodeforcesPageProblem();
      if (probData) {
        chrome.storage.local.set({
          cf_active_problem: probData,
          [`cf_problem_${contestId}${problemIndex}`]: probData,
          last_problem_platform: 'codeforces'
        }, () => {
          window.open(chrome.runtime.getURL(`ide/index.html?problem=${contestId}${problemIndex}`), '_blank');
        });
      } else {
        window.open(chrome.runtime.getURL(`ide/index.html?problem=${contestId}${problemIndex}`), '_blank');
      }
    });

    headerEl.appendChild(btn);
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'GET_PAGE_PROBLEM_DATA') {
      const data = extractCodeforcesPageProblem();
      sendResponse({ success: true, data });
      return true;
    }
  });

  // ==========================================
  // TOPH.CO MODULE
  // ==========================================
  function initToph() {
    console.log('[CodeToGit] Toph module initialized on:', window.location.pathname);
    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/s/')) {
      initTophSubmissionWatcher();
    } else if (currentPath.startsWith('/p/')) {
      initTophProblemAutoSubmit();
    }
  }

  function initTophSubmissionWatcher() {
    const submissionId = window.location.pathname.split('/')[2];
    if (!submissionId) return;

    console.log(`[CodeToGit] Watching Toph submission: ${submissionId}`);

    let syncAttempted = false;
    let checkInterval = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 45;

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

      const verdict = findTophVerdictText();
      if (!verdict) return;

      const isAC = isTophAcceptedVerdict(verdict);
      const isPending = isTophPendingVerdict(verdict);

      if (isAC) {
        SoundManager.playAccepted();
        syncAttempted = true;
        clearInterval(checkInterval);

        const config = await getStorage(['autoSync', 'githubToken', 'repo']);
        if (!config.githubToken || !config.repo) {
          showToast({
            title: 'CodeToGit (CTG): Accepted Problem Detected!',
            desc: 'Click the CodeToGit extension icon to connect your GitHub token & repo to auto-push.',
            type: 'warning'
          });
          return;
        }

        if (config.autoSync === false) {
          showToast({
            title: 'CodeToGit: Auto-sync is Paused',
            desc: 'Enable auto-sync in CodeToGit popup to automatically push solutions.',
            type: 'warning'
          });
          return;
        }

        const syncedKey = `synced_${submissionId}`;
        const alreadySynced = await getStorage([syncedKey]);
        if (alreadySynced[syncedKey]) {
          console.log(`[CodeToGit] Submission ${submissionId} already synced.`);
          return;
        }

        handleAcceptedTophSubmission(config, submissionId);
      } else if (isPending) {
        console.log(`[CodeToGit] Submission ${submissionId} verdict: ${verdict} (judging...)`);
      } else if (isTophFailedVerdict(verdict)) {
        SoundManager.playNotAccepted();
        clearInterval(checkInterval);
        console.log(`[CodeToGit] Submission ${submissionId} verdict: ${verdict} (not accepted)`);
      }
    }
  }

  function isTophAcceptedVerdict(text) {
    if (!text) return false;
    const clean = text.trim().toLowerCase();
    if (clean === 'ac' || clean === 'accepted') return true;
    if (clean.startsWith('accepted') || clean.startsWith('ac ') || clean.endsWith(' ac')) return true;
    if (clean.includes('accepted (ac)') || clean.includes('(ac)') || clean.includes('verdict: accepted')) return true;
    if (/\b(accepted|ac)\b/i.test(clean) && !clean.includes('not accepted')) return true;
    return false;
  }

  function isTophPendingVerdict(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('queue') || lower.includes('run') || lower.includes('judg') || 
           lower.includes('wait') || lower.includes('test') || lower.includes('compil') || lower.includes('pend');
  }

  function isTophFailedVerdict(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes('wrong') || lower.includes('wa') || lower.includes('time limit') || 
           lower.includes('tle') || lower.includes('memory limit') || lower.includes('mle') || 
           lower.includes('runtime error') || lower.includes('rte') || lower.includes('compilation error') || 
           lower.includes('compile error') || lower.includes('ce');
  }

  function findTophVerdictText() {
    const selectors = [
      '.verdict',
      '.submission-verdict',
      '[data-verdict]',
      '.tag.is-success',
      '.label-success',
      '.text-success',
      'span[class*="verdict"]',
      'div[class*="verdict"]',
      'td[class*="verdict"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }

    const candidates = document.querySelectorAll('td, th, span.tag, span.badge, div.verdict, .label');
    for (const cell of candidates) {
      const text = cell.textContent.trim();
      if (isTophAcceptedVerdict(text)) return text;
      if (isTophFailedVerdict(text)) return text;
      if (isTophPendingVerdict(text)) return text;
    }

    return null;
  }

  async function handleAcceptedTophSubmission(config, submissionId) {
    showToast({
      title: 'CodeToGit: Accepted Submission Detected',
      desc: 'Extracting C++ source code & problem details...',
      type: 'loading'
    });

    try {
      const data = await extractTophSubmissionData();
      if (!data.code) {
        throw new Error('Could not find submission source code on this page.');
      }

      showToast({
        title: `CodeToGit: Syncing ${data.problemTitle}`,
        desc: 'Committing solution and README to GitHub...',
        type: 'loading'
      });

      chrome.runtime.sendMessage({
        action: 'COMMIT_SOLUTION',
        payload: {
          platform: 'toph',
          ...data,
          submissionId: submissionId
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          showToast({
            title: 'CodeToGit Sync Error',
            desc: chrome.runtime.lastError.message,
            type: 'error'
          });
          return;
        }

        if (response && response.success) {
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
            title: 'CodeToGit Sync Failed',
            desc: response ? response.error : 'Unknown GitHub API error',
            type: 'error'
          });
        }
      });
    } catch (err) {
      console.error('[CodeToGit] Error during sync:', err);
      showToast({
        title: 'CodeToGit Error',
        desc: err.message || 'Failed to extract submission details',
        type: 'error'
      });
    }
  }

  async function extractTophSubmissionData() {
    let problemSlug = '';
    let problemTitle = '';

    const links = document.querySelectorAll('a[href*="/p/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/p\/([a-zA-Z0-9_-]+)/);
      if (match && match[1] && match[1] !== 'problems') {
        problemSlug = match[1];
        const text = link.textContent.trim();
        if (text && !text.toLowerCase().includes('problem')) {
          problemTitle = text;
        }
        break;
      }
    }

    if (!problemSlug) {
      const stored = await getStorage(['activeProblemSlug', 'activeProblemTitle', 'pending_submission']);
      if (stored.activeProblemSlug) {
        problemSlug = stored.activeProblemSlug;
        if (stored.activeProblemTitle) problemTitle = stored.activeProblemTitle;
      } else if (stored.pending_submission && stored.pending_submission.slug) {
        problemSlug = stored.pending_submission.slug;
      }
    }

    let problemDescription = '';
    if (problemSlug) {
      try {
        const bgData = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'FETCH_TOPH_PROBLEM', slug: problemSlug }, (res) => {
            if (res && res.success && res.data) {
              resolve(res.data);
            } else {
              resolve(null);
            }
          });
        });

        if (bgData) {
          problemTitle = bgData.title || problemTitle;
          problemDescription = bgData.desc || '';
        }
      } catch (err) {
        console.warn('[CodeToGit] Background fetch error:', err);
      }
    }

    if (!problemTitle) {
      const titleMatch = document.title.split('|')[0].trim();
      problemTitle = titleMatch || (problemSlug ? problemSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : 'Toph Problem');
    }

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

    let code = '';
    if (window.ace) {
      const aceEl = document.querySelector('.ace_editor');
      if (aceEl) {
        try {
          const editor = window.ace.edit(aceEl);
          if (editor && editor.getValue) code = editor.getValue();
        } catch (e) {}
      }
    }

    if (!code) {
      const cmEl = document.querySelector('.CodeMirror');
      if (cmEl && cmEl.CodeMirror) {
        try {
          code = cmEl.CodeMirror.getValue();
        } catch (e) {}
      }
    }

    if (!code) {
      const codeBlocks = Array.from(document.querySelectorAll('pre code, pre.source-code, .source-code pre, #source-code, .source-code, pre, textarea, code, .code, table.code, .ace_line'));
      let bestBlock = '';
      for (const block of codeBlocks) {
        const text = (block.value || block.innerText || block.textContent || '').trim();
        if (text.includes('#include') || text.includes('using namespace') || text.includes('int main')) {
          bestBlock = text;
          break;
        }
        if (text.length > bestBlock.length) {
          bestBlock = text;
        }
      }
      if (bestBlock.length > 20) {
        code = bestBlock;
      }
    }

    if (!code) {
      const stored = await getStorage(['last_submitted_code', 'pending_submission']);
      if (stored.last_submitted_code && stored.last_submitted_code.code) {
        code = stored.last_submitted_code.code;
      } else if (stored.pending_submission && stored.pending_submission.code) {
        code = stored.pending_submission.code;
      }
    }

    return {
      problemSlug,
      problemTitle,
      language,
      cpuTime,
      memory,
      code: (code || '').trim(),
      problemDescription,
      problemUrl: `https://toph.co/p/${problemSlug}`
    };
  }

  async function initTophProblemAutoSubmit() {
    const slugMatch = window.location.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
    const pageSlug = slugMatch ? slugMatch[1] : '';

    let pageTitle = '';
    if (pageSlug) {
      const heading = document.querySelector('h1, .problem-title, .title');
      pageTitle = (heading && heading.textContent.trim())
        ? heading.textContent.trim()
        : document.title.split('|')[0].trim();
      chrome.storage.local.set({
        activeProblemSlug: pageSlug,
        activeProblemTitle: pageTitle,
        last_problem_platform: 'toph'
      });
    }

    // Attach submit listener to capture manually submitted code directly on Toph
    document.addEventListener('submit', () => {
      try {
        let code = '';
        if (window.ace) {
          const aceEl = document.querySelector('.ace_editor');
          if (aceEl) {
            const editor = window.ace.edit(aceEl);
            if (editor && editor.getValue) code = editor.getValue();
          }
        }
        if (!code) {
          const cmEl = document.querySelector('.CodeMirror');
          if (cmEl && cmEl.CodeMirror) code = cmEl.CodeMirror.getValue();
        }
        if (!code) {
          const ta = document.querySelector('textarea[name*="source"], textarea[name*="code"], textarea');
          if (ta) code = ta.value;
        }
        if (code && code.trim().length > 15) {
          chrome.storage.local.set({
            last_submitted_code: {
              code: code.trim(),
              slug: pageSlug,
              title: pageTitle,
              timestamp: Date.now()
            }
          });
        }
      } catch (err) {}
    }, true);

    // Listen for file uploads from Code::Blocks (.cpp / .c / .cc / .txt)
    document.addEventListener('change', (e) => {
      try {
        const target = e.target;
        if (target && target.type === 'file' && target.files && target.files[0]) {
          const file = target.files[0];
          const fileName = file.name.toLowerCase();
          if (fileName.endsWith('.cpp') || fileName.endsWith('.c') || fileName.endsWith('.cc') || fileName.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const fileContent = (event.target && event.target.result) ? event.target.result : '';
              if (fileContent && fileContent.trim().length > 15) {
                chrome.storage.local.set({
                  last_submitted_code: {
                    code: fileContent.trim(),
                    slug: pageSlug,
                    title: pageTitle,
                    source: 'codeblocks_upload',
                    filename: file.name,
                    timestamp: Date.now()
                  }
                });
                console.log('[CodeToGit] Cached solution from Code::Blocks file upload:', file.name);
              }
            };
            reader.readAsText(file);
          }
        }
      } catch (err) {}
    }, true);

    const hasHash = window.location.hash === '#codetogit-submit' || window.location.hash === '#ctg-submit';
    const storageData = await getStorage(['pending_submission']);
    const pending = storageData.pending_submission;

    if (!pending && !hasHash) return;

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

    console.log('[CodeToGit] Problem page loaded with auto-submit request! Auto-filling...', pending);

    showToast({
      title: 'CodeToGit: Auto-Submitting C++',
      desc: 'Injecting solution and submitting to Toph judge...',
      type: 'loading'
    });

    setTimeout(async () => {
      const code = pending ? pending.code : '';
      if (code) {
        chrome.storage.local.set({
          last_submitted_code: {
            code: code,
            slug: pageSlug || (pending ? pending.slug : ''),
            title: pageTitle,
            timestamp: Date.now()
          }
        });
      }

      const success = await injectTophCodeAndSubmit(code);
      if (success) {
        chrome.storage.local.remove(['pending_submission']);
        if (window.location.hash === '#codetogit-submit' || window.location.hash === '#ctg-submit') {
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

  async function injectTophCodeAndSubmit(code) {
    if (!code) {
      try {
        code = await navigator.clipboard.readText();
      } catch (e) {}
    }
    if (!code) return false;

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

    let injected = false;
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      cmEl.CodeMirror.setValue(code);
      injected = true;
    }

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

    if (!injected) {
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetParent !== null) {
          ta.value = code;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          injected = true;
          break;
        }
      }
    }

    await sleep(600);

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
})();
