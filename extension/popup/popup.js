document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const profileCard = document.getElementById('profileCard');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const repoLink = document.getElementById('repoLink');
  const repoNameDisplay = document.getElementById('repoNameDisplay');
  const syncedCount = document.getElementById('syncedCount');
  const lastSynced = document.getElementById('lastSynced');

  const settingsForm = document.getElementById('settingsForm');
  const githubToken = document.getElementById('githubToken');
  const toggleTokenVisibility = document.getElementById('toggleTokenVisibility');
  const repoInput = document.getElementById('repoInput');
  const branchInput = document.getElementById('branchInput');
  const langPreference = document.getElementById('langPreference');
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  const alertBox = document.getElementById('alertBox');
  const saveBtn = document.getElementById('saveBtn');
  const btnText = saveBtn.querySelector('.btn-text');
  const spinner = saveBtn.querySelector('.spinner');
  const createRepoBtn = document.getElementById('createRepoBtn');

  // Load existing config
  chrome.storage.local.get([
    'githubToken',
    'repo',
    'branch',
    'langPreference',
    'autoSync',
    'userInfo',
    'syncedCount',
    'lastSyncedProblem'
  ], (data) => {
    if (data.githubToken) githubToken.value = data.githubToken;
    if (data.repo) repoInput.value = data.repo;
    if (data.branch) branchInput.value = data.branch;
    if (data.langPreference) langPreference.value = data.langPreference;
    if (data.autoSync !== undefined) autoSyncToggle.checked = data.autoSync;

    if (data.syncedCount !== undefined) syncedCount.textContent = data.syncedCount;
    if (data.lastSyncedProblem) lastSynced.textContent = data.lastSyncedProblem;

    if (data.userInfo && data.repo) {
      setConnectedState(data.userInfo, data.repo);
    }
  });

  // Toggle token visibility
  toggleTokenVisibility.addEventListener('click', () => {
    if (githubToken.type === 'password') {
      githubToken.type = 'text';
      toggleTokenVisibility.textContent = '🔒';
    } else {
      githubToken.type = 'password';
      toggleTokenVisibility.textContent = '👁️';
    }
  });

  // Auto-sync switch immediate update
  autoSyncToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoSync: autoSyncToggle.checked });
  });

  // Save & Connect Form Submission
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    setLoading(true);

    const token = githubToken.value.trim();
    let repo = repoInput.value.trim();
    const branch = branchInput.value.trim() || 'main';
    const lang = langPreference.value;
    const autoSync = autoSyncToggle.checked;

    // Normalize repo string
    repo = repo.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');

    try {
      // 1. Verify User Token
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!userRes.ok) {
        throw new Error('Invalid GitHub token. Please verify token permissions.');
      }
      const userData = await userRes.json();

      // If user typed only repo name without owner, prepend user's login
      if (!repo.includes('/')) {
        repo = `${userData.login}/${repo}`;
        repoInput.value = repo;
      }

      // 2. Verify Repository
      const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (repoRes.status === 404) {
        // Repo not found - offer to auto-create
        createRepoBtn.classList.remove('hidden');
        showAlert(`Repository "${repo}" not found on GitHub. Click "Create Repo For Me" below to create it automatically!`, 'error');
        setLoading(false);
        return;
      } else if (!repoRes.ok) {
        throw new Error(`Unable to access repository (${repoRes.status} ${repoRes.statusText}). Check repo permissions.`);
      }

      // Success: Save details
      const userInfo = {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url
      };

      await chrome.storage.local.set({
        githubToken: token,
        repo: repo,
        branch: branch,
        langPreference: lang,
        autoSync: autoSync,
        userInfo: userInfo
      });

      setConnectedState(userInfo, repo);
      createRepoBtn.classList.add('hidden');
      showAlert('Successfully connected to GitHub! Your C++ solutions will sync on Accepted.', 'success');
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'An error occurred while connecting.', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Create Repo Button Handler
  createRepoBtn.addEventListener('click', async () => {
    setLoading(true);
    hideAlert();

    const token = githubToken.value.trim();
    let repo = repoInput.value.trim();
    const repoName = repo.includes('/') ? repo.split('/')[1] : repo;

    try {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repoName,
          description: 'My Competitive Programming solutions for Toph.co in C++ (Synced by TophHub)',
          private: false,
          auto_init: true
        })
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.message || 'Failed to create repository');
      }

      const newRepoData = await createRes.json();
      repoInput.value = newRepoData.full_name;
      createRepoBtn.classList.add('hidden');
      
      // Re-trigger form save
      settingsForm.dispatchEvent(new Event('submit'));
    } catch (err) {
      console.error(err);
      showAlert(`Could not create repo: ${err.message}`, 'error');
      setLoading(false);
    }
  });

  function setConnectedState(userInfo, repo) {
    statusIndicator.className = 'status-pill connected';
    statusText.textContent = 'Connected';
    profileCard.classList.remove('hidden');

    if (userInfo.avatar_url) userAvatar.src = userInfo.avatar_url;
    userName.textContent = userInfo.name || userInfo.login;
    repoNameDisplay.textContent = repo;
    repoLink.href = `https://github.com/${repo}`;
  }

  function setLoading(loading) {
    saveBtn.disabled = loading;
    if (loading) {
      btnText.textContent = 'Connecting...';
      spinner.classList.remove('hidden');
    } else {
      btnText.textContent = 'Save & Connect';
      spinner.classList.add('hidden');
    }
  }

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`;
    alertBox.classList.remove('hidden');
  }

  function hideAlert() {
    alertBox.classList.add('hidden');
  }
});
