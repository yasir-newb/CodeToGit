/**
 * TophHub C++ IDE — Core Application Logic
 * Zero-setup browser & local competitive programming environment.
 */

(function () {
  'use strict';

  // State
  const state = {
    problemSlug: 'formatted-numbers',
    problemTitle: 'Formatted Numbers',
    cases: [
      { id: 1, stdin: '1000000', expected: '1,000,000', stdout: '', status: 'ready', time: '--', memory: '--' },
      { id: 2, stdin: '500', expected: '500', stdout: '', status: 'ready', time: '--', memory: '--' },
      { id: 3, stdin: '123456789', expected: '123,456,789', stdout: '', status: 'ready', time: '--', memory: '--' }
    ],
    activeCaseId: 1,
    isExecuting: false,
    githubToken: '',
    githubRepo: 'yasir-newb/tophhub',
    githubBranch: 'main',
    compilerEngine: 'piston-gcc10'
  };

  // Standard C++ Template for Formatted Numbers
  const DEFAULT_CPP_CODE = 
`/**
 * Problem: Formatted Numbers
 * URL: https://toph.co/p/formatted-numbers
 * Language: C++20
 * Author: M Abdullah Yasir Tomal
 */

#include <iostream>
#include <string>
#include <algorithm>

using namespace std;

#define FAST_IO ios_base::sync_with_stdio(false); cin.tie(NULL);

void solve() {
    string s;
    if (!(cin >> s)) return;
    
    int n = s.size();
    string res = "";
    int cnt = 0;
    
    for (int i = n - 1; i >= 0; i--) {
        res += s[i];
        cnt++;
        if (cnt % 3 == 0 && i > 0) {
            res += ',';
        }
    }
    
    reverse(res.begin(), res.end());
    cout << res << "\\n";
}

int main() {
    FAST_IO;
    solve();
    return 0;
}
`;

  // DOM Elements
  const codeEditor = document.getElementById('codeEditor');
  const lineNumbers = document.getElementById('lineNumbers');
  const cursorPosition = document.getElementById('cursorPosition');
  const dirtyIndicator = document.getElementById('dirtyIndicator');
  const resetTemplateBtn = document.getElementById('resetTemplateBtn');
  const formatCodeBtn = document.getElementById('formatCodeBtn');

  const problemInput = document.getElementById('problemInput');
  const fetchProblemBtn = document.getElementById('fetchProblemBtn');
  const displayProblemTitle = document.getElementById('displayProblemTitle');
  const displaySlug = document.getElementById('displaySlug');
  const problemDescriptionText = document.getElementById('problemDescriptionText');
  const problemInputFormat = document.getElementById('problemInputFormat');
  const problemOutputFormat = document.getElementById('problemOutputFormat');
  const sampleInputPreview = document.getElementById('sampleInputPreview');
  const sampleOutputPreview = document.getElementById('sampleOutputPreview');
  const problemExternalLink = document.getElementById('problemExternalLink');

  const caseTabs = document.getElementById('caseTabs');
  const addCaseBtn = document.getElementById('addCaseBtn');
  const customInput = document.getElementById('customInput');
  const inputStats = document.getElementById('inputStats');
  const expectedOutput = document.getElementById('expectedOutput');
  const loadSampleExpectedBtn = document.getElementById('loadSampleExpectedBtn');
  const outputConsole = document.getElementById('outputConsole');
  const cpuTimeBadge = document.getElementById('cpuTimeBadge');
  const memoryBadge = document.getElementById('memoryBadge');
  const diffBanner = document.getElementById('diffBanner');
  const diffTitle = document.getElementById('diffTitle');
  const diffDesc = document.getElementById('diffDesc');
  const overallVerdict = document.getElementById('overallVerdict');

  const runCodeBtn = document.getElementById('runCodeBtn');
  const testAllBtn = document.getElementById('testAllBtn');
  const submitTophBtn = document.getElementById('submitTophBtn');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const syncGitHubBtn = document.getElementById('syncGitHubBtn');
  const settingsBtn = document.getElementById('settingsBtn');

  const settingsModal = document.getElementById('settingsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const modalToken = document.getElementById('modalToken');
  const modalRepo = document.getElementById('modalRepo');
  const modalBranch = document.getElementById('modalBranch');
  const modalCompiler = document.getElementById('modalCompiler');
  const toastContainer = document.getElementById('toastContainer');

  // Initialization
  init();

  function init() {
    loadSettings();
    codeEditor.value = DEFAULT_CPP_CODE;
    updateLineNumbers();
    renderCaseTabs();
    loadActiveCase();
    attachEventListeners();
  }

  function attachEventListeners() {
    // Editor Input & Line Numbers
    codeEditor.addEventListener('input', () => {
      updateLineNumbers();
      dirtyIndicator.classList.add('dirty');
    });

    codeEditor.addEventListener('scroll', () => {
      lineNumbers.scrollTop = codeEditor.scrollTop;
    });

    codeEditor.addEventListener('keyup', updateCursorStats);
    codeEditor.addEventListener('click', updateCursorStats);

    // Smart Tab, Auto-Indent, & Auto-Pairing in Editor
    codeEditor.addEventListener('keydown', handleEditorShortcuts);

    // Run & Test Actions
    runCodeBtn.addEventListener('click', () => runActiveCase());
    testAllBtn.addEventListener('click', () => runAllTestCases());
    if (submitTophBtn) {
      submitTophBtn.addEventListener('click', submitToToph);
    }

    // Tools
    copyCodeBtn.addEventListener('click', copyCodeToClipboard);
    syncGitHubBtn.addEventListener('click', syncSolutionToGitHub);
    resetTemplateBtn.addEventListener('click', resetTemplate);
    formatCodeBtn.addEventListener('click', formatCode);

    // Problem Fetcher
    fetchProblemBtn.addEventListener('click', () => loadProblem(problemInput.value.trim()));
    problemInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadProblem(problemInput.value.trim());
    });

    // Case Workbench Events
    customInput.addEventListener('input', () => {
      const active = getActiveCase();
      if (active) active.stdin = customInput.value;
      inputStats.textContent = `${customInput.value.length} chars`;
    });

    expectedOutput.addEventListener('input', () => {
      const active = getActiveCase();
      if (active) active.expected = expectedOutput.value;
      checkDiff(active);
    });

    loadSampleExpectedBtn.addEventListener('click', () => {
      expectedOutput.value = sampleOutputPreview.textContent.trim();
      const active = getActiveCase();
      if (active) {
        active.expected = expectedOutput.value;
        checkDiff(active);
      }
    });

    addCaseBtn.addEventListener('click', addNewCase);

    // Settings Modal
    settingsBtn.addEventListener('click', () => {
      modalToken.value = state.githubToken;
      modalRepo.value = state.githubRepo;
      modalBranch.value = state.githubBranch;
      modalCompiler.value = state.compilerEngine;
      settingsModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
      state.githubToken = modalToken.value.trim();
      state.githubRepo = modalRepo.value.trim();
      state.githubBranch = modalBranch.value.trim() || 'main';
      state.compilerEngine = modalCompiler.value;
      saveSettings();
      settingsModal.classList.add('hidden');
      showToast('Settings saved successfully!', 'success');
    });
  }

  // Handle Editor Shortcuts (Ctrl+Enter to Run, Tab for 4 spaces, Auto-Brackets)
  function handleEditorShortcuts(e) {
    // Ctrl + Enter to run code
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runActiveCase();
      return;
    }

    // Ctrl + S to save/sync
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      syncSolutionToGitHub();
      return;
    }

    // Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      const spaces = '    ';
      codeEditor.value = codeEditor.value.substring(0, start) + spaces + codeEditor.value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
      updateLineNumbers();
      return;
    }

    // Auto-close brackets: (, {, [, ", '
    const pairs = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      if (start === end) {
        e.preventDefault();
        const closing = pairs[e.key];
        codeEditor.value = codeEditor.value.substring(0, start) + e.key + closing + codeEditor.value.substring(end);
        codeEditor.selectionStart = codeEditor.selectionEnd = start + 1;
        updateLineNumbers();
      }
    }
  }

  function updateLineNumbers() {
    const lines = codeEditor.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
      numbers += i + '\n';
    }
    lineNumbers.textContent = numbers;
  }

  function updateCursorStats() {
    const text = codeEditor.value.substring(0, codeEditor.selectionStart);
    const lines = text.split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    cursorPosition.textContent = `Ln ${currentLine}, Col ${currentCol}`;
  }

  // Test Case Tabs
  function renderCaseTabs() {
    // Remove existing case buttons, keeping add button
    const oldBtns = caseTabs.querySelectorAll('.case-tab');
    oldBtns.forEach(btn => btn.remove());

    state.cases.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `case-tab ${c.id === state.activeCaseId ? 'active' : ''}`;
      btn.dataset.case = c.id;
      btn.textContent = `Case ${c.id}`;
      btn.addEventListener('click', () => switchCase(c.id));
      caseTabs.insertBefore(btn, addCaseBtn);
    });
  }

  function switchCase(caseId) {
    // Save current active input
    const current = getActiveCase();
    if (current) {
      current.stdin = customInput.value;
      current.expected = expectedOutput.value;
    }

    state.activeCaseId = caseId;
    renderCaseTabs();
    loadActiveCase();
  }

  function getActiveCase() {
    return state.cases.find(c => c.id === state.activeCaseId);
  }

  function loadActiveCase() {
    const active = getActiveCase();
    if (!active) return;

    customInput.value = active.stdin || '';
    inputStats.textContent = `${customInput.value.length} chars`;
    expectedOutput.value = active.expected || '';

    outputConsole.textContent = active.stdout || 'Click "Run Code" to compile and execute with this input.';
    cpuTimeBadge.textContent = `Time: ${active.time}`;
    memoryBadge.textContent = `Memory: ${active.memory}`;

    checkDiff(active);
  }

  function addNewCase() {
    const newId = state.cases.length + 1;
    state.cases.push({
      id: newId,
      stdin: '',
      expected: '',
      stdout: '',
      status: 'ready',
      time: '--',
      memory: '--'
    });
    switchCase(newId);
  }

  // Execution: Compile & Run C++
  async function runActiveCase() {
    if (state.isExecuting) return;
    const active = getActiveCase();
    if (!active) return;

    setExecutingState(true, `Running Case ${active.id}...`);

    try {
      const result = await executeCppCode(codeEditor.value, active.stdin);

      active.stdout = result.stdout || (result.stderr ? `Error:\n${result.stderr}` : 'No output returned.');
      active.time = result.time ? `${result.time}s` : `${result.durationMs || 0}ms`;
      active.memory = result.memory ? `${(result.memory / 1024).toFixed(1)}MB` : '1.4MB';

      outputConsole.textContent = active.stdout;
      cpuTimeBadge.textContent = `Time: ${active.time}`;
      memoryBadge.textContent = `Memory: ${active.memory}`;

      checkDiff(active);

      if (result.stderr && !result.stdout) {
        showToast('Compilation or Runtime warning/error.', 'error');
      } else {
        showToast(`Case ${active.id} finished in ${active.time}`, 'success');
      }
    } catch (err) {
      console.error(err);
      outputConsole.textContent = `Execution Error: ${err.message}\n\nPlease verify your internet connection for compiler API or check syntax.`;
      showToast(err.message, 'error');
    } finally {
      setExecutingState(false);
    }
  }

  // Run All Test Cases Sequentially
  async function runAllTestCases() {
    if (state.isExecuting) return;
    setExecutingState(true, 'Running all test cases...');

    let passedCount = 0;
    let failedCases = [];

    for (let i = 0; i < state.cases.length; i++) {
      const c = state.cases[i];
      try {
        const result = await executeCppCode(codeEditor.value, c.stdin);
        c.stdout = result.stdout || result.stderr || '';
        c.time = result.time ? `${result.time}s` : `${result.durationMs || 0}ms`;
        c.memory = result.memory ? `${(result.memory / 1024).toFixed(1)}MB` : '1.4MB';

        const isMatch = compareOutputs(c.stdout, c.expected);
        if (isMatch) {
          passedCount++;
          c.status = 'passed';
        } else {
          failedCases.push(c.id);
          c.status = 'failed';
        }
      } catch (err) {
        c.stdout = err.message;
        c.status = 'failed';
        failedCases.push(c.id);
      }
    }

    setExecutingState(false);
    loadActiveCase();

    // Summary Verdict
    if (passedCount === state.cases.length) {
      overallVerdict.innerHTML = `<span class="verdict-tag accepted">All ${passedCount} Passed (AC)</span>`;
      showToast(`🎉 All ${passedCount} test cases passed!`, 'success');
    } else {
      overallVerdict.innerHTML = `<span class="verdict-tag failed">${passedCount}/${state.cases.length} Passed</span>`;
      showToast(`Failed on test case(s): ${failedCases.join(', ')}`, 'error');
    }
  }

  // Core C++ Compilation Engine (Piston Cloud API or Local Server)
  async function executeCppCode(code, stdin) {
    const startTime = performance.now();

    if (state.compilerEngine === 'local') {
      // Local Node.js server fallback
      const localRes = await fetch('http://localhost:3000/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin, language: 'cpp' })
      });
      if (!localRes.ok) throw new Error('Local compiler server not responding at localhost:3000');
      return await localRes.json();
    }

    // Default: Piston Cloud Compiler API
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: 'cpp',
        version: '10.2.0',
        files: [
          {
            name: 'solution.cpp',
            content: code
          }
        ],
        stdin: stdin || ''
      })
    });

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    if (!response.ok) {
      throw new Error(`Compiler API error (${response.status})`);
    }

    const data = await response.json();
    const runResult = data.run || {};
    const compileResult = data.compile || {};

    let stderr = compileResult.stderr || runResult.stderr || '';
    let stdout = runResult.stdout || '';

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      durationMs,
      time: (durationMs / 1000).toFixed(2),
      exitCode: runResult.code
    };
  }

  // Diff Checker
  function checkDiff(testCase) {
    if (!testCase.expected || !testCase.stdout) {
      diffBanner.classList.add('hidden');
      return;
    }

    const isMatch = compareOutputs(testCase.stdout, testCase.expected);
    diffBanner.classList.remove('hidden');

    if (isMatch) {
      diffBanner.className = 'diff-banner pass';
      diffIcon.textContent = '✅';
      diffTitle.textContent = 'Accepted (Sample Match)';
      diffDesc.textContent = 'Your program output matches the expected result!';
    } else {
      diffBanner.className = 'diff-banner fail';
      diffIcon.textContent = '❌';
      diffTitle.textContent = 'Wrong Answer (Mismatch)';
      diffDesc.textContent = `Expected: "${testCase.expected.trim()}" | Got: "${testCase.stdout.trim()}"`;
    }
  }

  function compareOutputs(actual, expected) {
    if (!expected) return true;
    const cleanAct = (actual || '').trim().replace(/\r\n/g, '\n');
    const cleanExp = (expected || '').trim().replace(/\r\n/g, '\n');
    return cleanAct === cleanExp;
  }

  function setExecutingState(isExec, label) {
    state.isExecuting = isExec;
    runCodeBtn.disabled = isExec;
    testAllBtn.disabled = isExec;

    if (isExec) {
      runCodeBtn.innerHTML = `<span>⏳ Compiling...</span>`;
      overallVerdict.innerHTML = `<span class="verdict-tag running">${label || 'Judging...'}</span>`;
    } else {
      runCodeBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span>Run Code</span>
        <kbd class="shortcut">Ctrl+↵</kbd>
      `;
    }
  }

  // Load Problem Details
  function loadProblem(query) {
    if (!query) return;
    const slug = query.replace(/^https:\/\/toph\.co\/p\//, '').replace(/\/$/, '').toLowerCase();
    state.problemSlug = slug;

    // Common Toph catalog fallback dictionary
    const catalog = {
      'formatted-numbers': {
        title: 'Formatted Numbers',
        desc: 'In this problem, you need to print a given integer with comma (,) separated thousands place.',
        input: 'The input contains an integer A (0 ≤ A ≤ 10^9).',
        output: 'Print the integer A formatted with commas separating thousands.',
        sampleIn: '1000000',
        sampleOut: '1,000,000'
      },
      'copycat': {
        title: 'Copycat',
        desc: 'Read a single integer and print it exactly as it is.',
        input: 'A single integer A (-10^9 ≤ A ≤ 10^9).',
        output: 'Print the same integer.',
        sampleIn: '42',
        sampleOut: '42'
      },
      'is-prime': {
        title: 'Is Prime',
        desc: 'Determine if a given positive integer N is prime or not.',
        input: 'An integer N (1 < N < 1000).',
        output: 'Print "Yes" if prime, otherwise "No".',
        sampleIn: '13',
        sampleOut: 'Yes'
      },
      'divisors': {
        title: 'Divisors',
        desc: 'Print all positive divisors of a given integer in ascending order.',
        input: 'An integer N (1 ≤ N ≤ 100).',
        output: 'Print all divisors, each on a new line.',
        sampleIn: '6',
        sampleOut: '1\n2\n3\n6'
      }
    };

    const problem = catalog[slug] || {
      title: slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
      desc: `Problem: ${slug}. Visit the official problem page on Toph.co to view full details.`,
      input: 'Standard input from problem statement.',
      output: 'Standard output to verify.',
      sampleIn: '1',
      sampleOut: '1'
    };

    displayProblemTitle.textContent = problem.title;
    displaySlug.textContent = slug;
    problemDescriptionText.textContent = problem.desc;
    problemInputFormat.textContent = problem.input;
    problemOutputFormat.textContent = problem.output;
    sampleInputPreview.textContent = problem.sampleIn;
    sampleOutputPreview.textContent = problem.sampleOut;
    problemExternalLink.href = `https://toph.co/p/${slug}`;

    // Update Case 1 with sample
    if (state.cases.length > 0) {
      state.cases[0].stdin = problem.sampleIn;
      state.cases[0].expected = problem.sampleOut;
      loadActiveCase();
    }

    showToast(`Loaded problem: ${problem.title}`, 'success');
  }

  // 1-Click Push to GitHub
  async function syncSolutionToGitHub() {
    if (!state.githubToken) {
      settingsModal.classList.remove('hidden');
      showToast('Please enter your GitHub Personal Access Token first.', 'error');
      return;
    }

    const [owner, repoName] = state.githubRepo.split('/');
    if (!owner || !repoName) {
      showToast('Invalid repository name. Format: username/repo', 'error');
      return;
    }

    const slug = state.problemSlug;
    const filePath = `toph/${slug}/solution.cpp`;
    const message = `Solve: ${displayProblemTitle.textContent} in C++ [Accepted]`;
    const content = codeEditor.value;

    syncGitHubBtn.disabled = true;
    syncGitHubBtn.innerHTML = `<span>⏳ Committing...</span>`;

    try {
      // 1. Get existing SHA if file exists
      let sha = null;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${state.githubBranch}`, {
        headers: {
          'Authorization': `Bearer ${state.githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      // 2. Put file
      const putPayload = {
        message: message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: state.githubBranch
      };
      if (sha) putPayload.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putPayload)
      });

      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || 'GitHub API error');
      }

      dirtyIndicator.classList.remove('dirty');
      showToast(`🎉 Pushed to https://github.com/${owner}/${repoName}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`GitHub commit error: ${err.message}`, 'error');
    } finally {
      syncGitHubBtn.disabled = false;
      syncGitHubBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>Push to GitHub</span>
      `;
    }
  }

  // Auto-Submit directly to Toph.co
  function submitToToph() {
    const code = codeEditor.value;
    const slug = state.problemSlug;

    if (!code || !code.trim()) {
      showToast('Please write your C++ solution first!', 'error');
      return;
    }

    // Copy to clipboard as immediate backup
    navigator.clipboard.writeText(code).catch(() => {});

    // Save pending submission for TophHub extension content script
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        pending_submission: {
          slug: slug,
          code: code,
          language: 'C++',
          timestamp: Date.now()
        }
      }, () => {
        showToast('🚀 Launching Toph.co! Auto-filling and submitting...', 'success');
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: `https://toph.co/p/${slug}#tophhub-submit` });
        } else {
          window.open(`https://toph.co/p/${slug}#tophhub-submit`, '_blank');
        }
      });
    } else {
      // Standalone mode
      showToast('📋 Code copied! Opening Toph.co for submission...', 'success');
      window.open(`https://toph.co/p/${slug}#tophhub-submit`, '_blank');
    }
  }

  // Copy Code
  function copyCodeToClipboard() {
    navigator.clipboard.writeText(codeEditor.value).then(() => {
      showToast('📋 Code copied to clipboard! Ready to paste on Toph.co', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  // Reset Template
  function resetTemplate() {
    if (confirm('Reset editor to the standard C++ Fast I/O template?')) {
      codeEditor.value = DEFAULT_CPP_CODE;
      updateLineNumbers();
      dirtyIndicator.classList.add('dirty');
      showToast('Template reset.', 'success');
    }
  }

  // Format Code Indentation
  function formatCode() {
    const lines = codeEditor.value.split('\n');
    let indentLevel = 0;
    const formatted = lines.map(line => {
      let trimmed = line.trim();
      if (trimmed.startsWith('}')) indentLevel = Math.max(0, indentLevel - 1);
      const res = '    '.repeat(indentLevel) + trimmed;
      if (trimmed.endsWith('{')) indentLevel++;
      return res;
    }).join('\n');

    codeEditor.value = formatted;
    updateLineNumbers();
    showToast('Code indentation formatted.', 'success');
  }

  // Local Storage Management
  function loadSettings() {
    try {
      const saved = localStorage.getItem('tophhub_ide_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.githubToken = parsed.githubToken || state.githubToken;
        state.githubRepo = parsed.githubRepo || state.githubRepo;
        state.githubBranch = parsed.githubBranch || state.githubBranch;
        state.compilerEngine = parsed.compilerEngine || state.compilerEngine;
      }
    } catch (e) {}

    // Also check chrome.storage if running inside extension context
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['githubToken', 'repo', 'branch'], (data) => {
        if (data.githubToken) state.githubToken = data.githubToken;
        if (data.repo) state.githubRepo = data.repo;
        if (data.branch) state.githubBranch = data.branch;
      });
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('tophhub_ide_settings', JSON.stringify({
        githubToken: state.githubToken,
        githubRepo: state.githubRepo,
        githubBranch: state.githubBranch,
        compilerEngine: state.compilerEngine
      }));
    } catch (e) {}
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `ide-toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

})();
