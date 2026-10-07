/**
 * CodeToGit (CTG) IDE — Core Application Logic
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
    githubRepo: 'yasir-newb/CodeToGit',
    githubBranch: 'main',
    compilerEngine: 'piston-gcc10',
    soundEnabled: true,
    soundVolume: 0.35
  };

  // Zero-Dependency Native Web Audio API Sound Engine
  const SoundManager = (function () {
    let audioCtx = null;
    let enabled = true;
    let volume = 0.35;

    function initCtx() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtx = new AudioContext();
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    // Accepted (AC) Chime: Ascending jubilant 4-note arpeggio with sparkling decay
    function playAccepted() {
      if (!enabled) return;
      try {
        initCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        // E5 (659Hz), G#5 (831Hz), B5 (988Hz), E6 (1319Hz)
        const notes = [
          { freq: 659.25, time: 0.00, dur: 0.25, gain: 0.35 },
          { freq: 830.61, time: 0.07, dur: 0.25, gain: 0.40 },
          { freq: 987.77, time: 0.14, dur: 0.30, gain: 0.45 },
          { freq: 1318.51, time: 0.21, dur: 0.52, gain: 0.55 }
        ];

        notes.forEach(({ freq, time, dur, gain: noteGain }) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + time);

          const peak = volume * noteGain;
          gainNode.gain.setValueAtTime(0.0001, now + time);
          gainNode.gain.exponentialRampToValueAtTime(peak, now + time + 0.015);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } catch (err) {
        console.warn('[SoundManager] playAccepted failed:', err);
      }
    }

    // Not Accepted (WA/Error) Tone: Warm descending 2-note minor tone
    function playNotAccepted() {
      if (!enabled) return;
      try {
        initCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        // Two-tone descending buzzer/chime: 360Hz -> 240Hz with gentle lowpass warmth
        const tones = [
          { freq: 360.0, time: 0.00, dur: 0.22, gain: 0.45 },
          { freq: 240.0, time: 0.12, dur: 0.38, gain: 0.50 }
        ];

        tones.forEach(({ freq, time, dur, gain: toneGain }) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          const filter = audioCtx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + time);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(750, now + time);
          filter.Q.setValueAtTime(2.5, now + time);

          const peak = volume * toneGain;
          gainNode.gain.setValueAtTime(0.0001, now + time);
          gainNode.gain.exponentialRampToValueAtTime(peak, now + time + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          osc.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur);
        });
      } catch (err) {
        console.warn('[SoundManager] playNotAccepted failed:', err);
      }
    }

    // Snippet Accepted / Insert Sound: Subtle tactile tick
    function playSnippetAccepted() {
      if (!enabled) return;
      try {
        initCtx();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.035);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.3, now + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
      } catch (err) {}
    }

    return {
      init: initCtx,
      playAccepted,
      playNotAccepted,
      playSnippetAccepted,
      setEnabled: (v) => { enabled = !!v; },
      isEnabled: () => enabled,
      setVolume: (v) => { volume = Math.max(0, Math.min(1, v)); },
      getVolume: () => volume
    };
  })();

  // Comprehensive C++ Competitive Programming Snippets & Autocomplete Catalog
  const CP_SNIPPETS = [
    {
      prefix: 'for',
      label: 'for (int i = 0; i < n; i++)',
      category: 'cp',
      desc: 'Standard ascending loop from 0 to n - 1',
      template: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${0}\n}',
      preview: 'for (int i = 0; i < n; i++) {\n    \n}'
    },
    {
      prefix: 'forr',
      label: 'for (int i = n - 1; i >= 0; i--)',
      category: 'cp',
      desc: 'Reverse loop from n - 1 down to 0',
      template: 'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; ${1:i}--) {\n    ${0}\n}',
      preview: 'for (int i = n - 1; i >= 0; i--) {\n    \n}'
    },
    {
      prefix: 'fore',
      label: 'for (auto& x : v)',
      category: 'cp',
      desc: 'Range-based for loop over elements',
      template: 'for (auto& ${1:x} : ${2:v}) {\n    ${0}\n}',
      preview: 'for (auto& x : v) {\n    \n}'
    },
    {
      prefix: 'forij',
      label: 'Nested 2D for loop (i, j)',
      category: 'cp',
      desc: 'Double loop for 2D grids and matrices',
      template: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    for (int ${3:j} = 0; ${3:j} < ${4:m}; ${3:j}++) {\n        ${0}\n    }\n}',
      preview: 'for (int i = 0; i < n; i++) {\n    for (int j = 0; j < m; j++) {\n        \n    }\n}'
    },
    {
      prefix: 'cin',
      label: 'cin >> ...',
      category: 'cp',
      desc: 'Read standard input variable',
      template: 'cin >> ${1:x};${0}',
      preview: 'cin >> x;'
    },
    {
      prefix: 'cout',
      label: 'cout << ... << "\\n"',
      category: 'cp',
      desc: 'Print to standard output with newline',
      template: 'cout << ${1:ans} << "\\n";${0}',
      preview: 'cout << ans << "\\n";'
    },
    {
      prefix: 'cinv',
      label: 'cin >> a[i] (Vector Input)',
      category: 'cp',
      desc: 'Loop to read an n-element vector from stdin',
      template: 'for (int i = 0; i < ${1:n}; i++) {\n    cin >> ${2:a}[i];\n}${0}',
      preview: 'for (int i = 0; i < n; i++) {\n    cin >> a[i];\n}'
    },
    {
      prefix: 'coutv',
      label: 'cout << a[i] (Vector Output)',
      category: 'cp',
      desc: 'Print vector elements separated by spaces',
      template: 'for (int i = 0; i < ${1:n}; i++) {\n    cout << ${2:a}[i] << (i + 1 == ${1:n} ? "\\n" : " ");\n}${0}',
      preview: 'for (int i = 0; i < n; i++) {\n    cout << a[i] << (i + 1 == n ? "\\n" : " ");\n}'
    },
    {
      prefix: 'while',
      label: 'while (t--)',
      category: 'cp',
      desc: 'Standard competitive programming testcase loop',
      template: 'while (${1:t--}) {\n    ${0}\n}',
      preview: 'while (t--) {\n    \n}'
    },
    {
      prefix: 'if',
      label: 'if (condition)',
      category: 'cp',
      desc: 'Conditional statement block',
      template: 'if (${1:condition}) {\n    ${0}\n}',
      preview: 'if (condition) {\n    \n}'
    },
    {
      prefix: 'ifelse',
      label: 'if (cond) { ... } else { ... }',
      category: 'cp',
      desc: 'If-Else conditional branch',
      template: 'if (${1:condition}) {\n    ${2}\n} else {\n    ${0}\n}',
      preview: 'if (condition) {\n    \n} else {\n    \n}'
    },
    {
      prefix: 'fastio',
      label: 'Fast I/O Setup',
      category: 'cp',
      desc: 'Accelerate standard I/O streams for CP',
      template: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);${0}',
      preview: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);'
    },
    {
      prefix: 'vec',
      label: 'vector<int> v(n)',
      category: 'type',
      desc: 'Standard dynamic vector container',
      template: 'vector<${1:int}> ${2:v}(${3:n});${0}',
      preview: 'vector<int> v(n);'
    },
    {
      prefix: 'vvi',
      label: 'vector<vector<int>> adj(n)',
      category: 'type',
      desc: '2D vector / Graph adjacency list',
      template: 'vector<vector<${1:int}>> ${2:adj}(${3:n});${0}',
      preview: 'vector<vector<int>> adj(n);'
    },
    {
      prefix: 'map',
      label: 'map<key, val> mp',
      category: 'type',
      desc: 'Ordered key-value map (Red-Black tree, O(log N))',
      template: 'map<${1:int}, ${2:int}> ${3:mp};${0}',
      preview: 'map<int, int> mp;'
    },
    {
      prefix: 'umap',
      label: 'unordered_map<key, val> mp',
      category: 'type',
      desc: 'Hash table map with O(1) average lookup',
      template: 'unordered_map<${1:int}, ${2:int}> ${3:mp};${0}',
      preview: 'unordered_map<int, int> mp;'
    },
    {
      prefix: 'set',
      label: 'set<int> st',
      category: 'type',
      desc: 'Ordered unique element container',
      template: 'set<${1:int}> ${2:st};${0}',
      preview: 'set<int> st;'
    },
    {
      prefix: 'uset',
      label: 'unordered_set<int> st',
      category: 'type',
      desc: 'Hash set with O(1) average lookup',
      template: 'unordered_set<${1:int}> ${2:st};${0}',
      preview: 'unordered_set<int> st;'
    },
    {
      prefix: 'pair',
      label: 'pair<int, int> p',
      category: 'type',
      desc: 'Pair container of two types',
      template: 'pair<${1:int}, ${2:int}> ${3:p};${0}',
      preview: 'pair<int, int> p;'
    },
    {
      prefix: 'pq',
      label: 'priority_queue<int> pq (Max-Heap)',
      category: 'type',
      desc: 'Max priority queue',
      template: 'priority_queue<${1:int}> ${2:pq};${0}',
      preview: 'priority_queue<int> pq;'
    },
    {
      prefix: 'pqmin',
      label: 'priority_queue min-heap',
      category: 'type',
      desc: 'Min priority queue (smallest element on top)',
      template: 'priority_queue<${1:int}, vector<${1:int}>, greater<${1:int}>> ${2:pq};${0}',
      preview: 'priority_queue<int, vector<int>, greater<int>> pq;'
    },
    {
      prefix: 'sort',
      label: 'sort(v.begin(), v.end())',
      category: 'fn',
      desc: 'Sort container elements in non-decreasing order',
      template: 'sort(${1:v}.begin(), ${1:v}.end());${0}',
      preview: 'sort(v.begin(), v.end());'
    },
    {
      prefix: 'sortd',
      label: 'sort(v.rbegin(), v.rend())',
      category: 'fn',
      desc: 'Sort container elements in descending order',
      template: 'sort(${1:v}.rbegin(), ${1:v}.rend());${0}',
      preview: 'sort(v.rbegin(), v.rend());'
    },
    {
      prefix: 'reverse',
      label: 'reverse(v.begin(), v.end())',
      category: 'fn',
      desc: 'Reverse range of elements in place',
      template: 'reverse(${1:v}.begin(), ${1:v}.end());${0}',
      preview: 'reverse(v.begin(), v.end());'
    },
    {
      prefix: 'all',
      label: 'v.begin(), v.end()',
      category: 'cp',
      desc: 'Convenient container range expression',
      template: '${1:v}.begin(), ${1:v}.end()${0}',
      preview: 'v.begin(), v.end()'
    },
    {
      prefix: 'pb',
      label: 'v.push_back(x)',
      category: 'fn',
      desc: 'Append element to vector/deque',
      template: 'push_back(${1:x});${0}',
      preview: 'push_back(x);'
    },
    {
      prefix: 'gcd',
      label: 'gcd(a, b) Function',
      category: 'fn',
      desc: 'Greatest common divisor using Euclidean algorithm',
      template: 'long long gcd(long long a, long long b) {\n    return b ? gcd(b, a % b) : a;\n}\n${0}',
      preview: 'long long gcd(long long a, long long b) {\n    return b ? gcd(b, a % b) : a;\n}'
    },
    {
      prefix: 'lcm',
      label: 'lcm(a, b) Function',
      category: 'fn',
      desc: 'Least common multiple via GCD',
      template: 'long long lcm(long long a, long long b) {\n    return (a / gcd(a, b)) * b;\n}\n${0}',
      preview: 'long long lcm(long long a, long long b) {\n    return (a / gcd(a, b)) * b;\n}'
    },
    {
      prefix: 'binpow',
      label: 'binpow(a, b, mod) - Binary Exponentiation',
      category: 'cp',
      desc: 'O(log B) modular exponentiation algorithm',
      template: 'long long binpow(long long a, long long b, long long m = 1e9 + 7) {\n    a %= m;\n    long long res = 1;\n    while (b > 0) {\n        if (b & 1) res = res * a % m;\n        a = a * a % m;\n        b >>= 1;\n    }\n    return res;\n}\n${0}',
      preview: 'long long binpow(long long a, long long b, long long m = 1e9 + 7) {\n    // O(log B) Fast Modular Power\n}'
    },
    {
      prefix: 'sieve',
      label: 'sieve() - Prime Sieve of Eratosthenes',
      category: 'cp',
      desc: 'Generate all primes up to 10^6 in O(N log log N)',
      template: 'const int MAXP = 1e6 + 5;\nvector<bool> is_prime(MAXP, true);\nvector<int> primes;\nvoid sieve() {\n    is_prime[0] = is_prime[1] = false;\n    for (int p = 2; p * p < MAXP; p++) {\n        if (is_prime[p]) {\n            for (int i = p * p; i < MAXP; i += p) is_prime[i] = false;\n        }\n    }\n    for (int p = 2; p < MAXP; p++) {\n        if (is_prime[p]) primes.push_back(p);\n    }\n}\n${0}',
      preview: 'const int MAXP = 1e6 + 5;\nvector<bool> is_prime(MAXP, true);\nvector<int> primes;\nvoid sieve() {\n    // Prime Sieve Implementation\n}'
    },
    {
      prefix: 'dfs',
      label: 'dfs(u, p) - Graph Depth First Search',
      category: 'cp',
      desc: 'Standard recursive DFS traversal template',
      template: 'void dfs(int u, int p = -1) {\n    vis[u] = true;\n    for (int v : adj[u]) {\n        if (v != p && !vis[v]) {\n            dfs(v, u);\n        }\n    }\n}\n${0}',
      preview: 'void dfs(int u, int p = -1) {\n    vis[u] = true;\n    for (int v : adj[u]) if (v != p && !vis[v]) dfs(v, u);\n}'
    },
    {
      prefix: 'bfs',
      label: 'bfs(src) - Breadth First Search',
      category: 'cp',
      desc: 'Standard queue-based BFS traversal template',
      template: 'void bfs(int src) {\n    queue<int> q;\n    q.push(src);\n    vis[src] = true;\n    while (!q.empty()) {\n        int u = q.front();\n        q.pop();\n        for (int v : adj[u]) {\n            if (!vis[v]) {\n                vis[v] = true;\n                q.push(v);\n            }\n        }\n    }\n}\n${0}',
      preview: 'void bfs(int src) {\n    queue<int> q;\n    q.push(src); vis[src] = true;\n    while (!q.empty()) { ... }\n}'
    },
    {
      prefix: 'dsu',
      label: 'DSU - Disjoint Set Union',
      category: 'cp',
      desc: 'Union-Find with path compression and union by rank',
      template: 'struct DSU {\n    vector<int> parent, size;\n    DSU(int n) {\n        parent.resize(n + 1);\n        iota(parent.begin(), parent.end(), 0);\n        size.assign(n + 1, 1);\n    }\n    int find(int i) {\n        return (parent[i] == i) ? i : (parent[i] = find(parent[i]));\n    }\n    bool unite(int i, int j) {\n        int root_i = find(i), root_j = find(j);\n        if (root_i != root_j) {\n            if (size[root_i] < size[root_j]) swap(root_i, root_j);\n            parent[root_j] = root_i;\n            size[root_i] += size[root_j];\n            return true;\n        }\n        return false;\n    }\n};\n${0}',
      preview: 'struct DSU {\n    vector<int> parent, size;\n    DSU(int n) { ... }\n    int find(int i) { ... }\n    bool unite(int i, int j) { ... }\n};'
    },
    {
      prefix: 'prefix',
      label: 'Prefix Sum Array',
      category: 'cp',
      desc: 'Compute prefix sums for O(1) range sum queries',
      template: 'vector<long long> pref(${1:n} + 1, 0);\nfor (int i = 0; i < ${1:n}; i++) {\n    pref[i + 1] = pref[i] + ${2:a}[i];\n}${0}',
      preview: 'vector<long long> pref(n + 1, 0);\nfor (int i = 0; i < n; i++) pref[i + 1] = pref[i] + a[i];'
    },
    {
      prefix: 'yes',
      label: 'cout << "YES\\n"',
      category: 'cp',
      desc: 'Output YES to stdout',
      template: 'cout << "YES\\n";${0}',
      preview: 'cout << "YES\\n";'
    },
    {
      prefix: 'no',
      label: 'cout << "NO\\n"',
      category: 'cp',
      desc: 'Output NO to stdout',
      template: 'cout << "NO\\n";${0}',
      preview: 'cout << "NO\\n";'
    },
    {
      prefix: 'solve',
      label: 'void solve()',
      category: 'cp',
      desc: 'Standard competitive programming solve function',
      template: 'void solve() {\n    ${0}\n}',
      preview: 'void solve() {\n    \n}'
    },
    {
      prefix: 'll',
      label: 'long long',
      category: 'type',
      desc: '64-bit integer type',
      template: 'long long ${1:x};${0}',
      preview: 'long long x;'
    },
    {
      prefix: 'string',
      label: 'string s',
      category: 'type',
      desc: 'Standard C++ string type',
      template: 'string ${1:s};${0}',
      preview: 'string s;'
    },
    {
      prefix: 'double',
      label: 'double',
      category: 'type',
      desc: 'Double precision floating point type',
      template: 'double ${1:x};${0}',
      preview: 'double x;'
    },
    {
      prefix: 'auto',
      label: 'auto',
      category: 'kw',
      desc: 'Automatic type deduction',
      template: 'auto ${1:x} = ${0};',
      preview: 'auto x = ...;'
    },
    {
      prefix: 'return',
      label: 'return',
      category: 'kw',
      desc: 'Return statement',
      template: 'return ${0};',
      preview: 'return;'
    }
  ];

  // Curated catalog of Toph.co problems with descriptions and sample test cases
  const TOPH_CATALOG = {
    'formatted-numbers': {
      title: 'Formatted Numbers',
      desc: 'In this problem, you need to print a given integer with comma (,) separated thousands place.',
      input: 'The input contains an integer A (0 ≤ A ≤ 10^9).',
      output: 'Print the integer A formatted with commas separating thousands.',
      samples: [
        { stdin: '1000000', expected: '1,000,000' },
        { stdin: '500', expected: '500' },
        { stdin: '123456789', expected: '123,456,789' }
      ]
    },
    'copycat': {
      title: 'Copycat',
      desc: 'Read a single integer and print it exactly as it is.',
      input: 'A single integer A (-10^9 ≤ A ≤ 10^9).',
      output: 'Print the same integer.',
      samples: [
        { stdin: '42', expected: '42' },
        { stdin: '0', expected: '0' },
        { stdin: '-150', expected: '-150' }
      ]
    },
    'is-prime': {
      title: 'Is Prime',
      desc: 'Determine if a given positive integer N is prime or not.',
      input: 'An integer N (1 < N < 1000).',
      output: 'Print "Yes" if prime, otherwise "No".',
      samples: [
        { stdin: '13', expected: 'Yes' },
        { stdin: '12', expected: 'No' },
        { stdin: '2', expected: 'Yes' }
      ]
    },
    'divisors': {
      title: 'Divisors',
      desc: 'Print all positive divisors of a given integer in ascending order.',
      input: 'An integer N (1 ≤ N ≤ 100).',
      output: 'Print all divisors, each on a new line.',
      samples: [
        { stdin: '6', expected: '1\n2\n3\n6' },
        { stdin: '12', expected: '1\n2\n3\n4\n6\n12' },
        { stdin: '7', expected: '1\n7' }
      ]
    },
    'thought-game': {
      title: 'Thought Game',
      desc: 'Given T test cases, each containing two integers X and Y. If their average is even, print "Sadia will be happy.", otherwise "Oops!".',
      input: 'An integer T, followed by T lines each with X and Y.',
      output: 'Print verdict for each case.',
      samples: [
        { stdin: '2\n3 5\n2 5', expected: 'Sadia will be happy.\nOops!' }
      ]
    },
    'clock-math': {
      title: 'Clock Math',
      desc: 'Calculate the minimum angle between the hour and minute hands of a clock.',
      input: 'Two integers H (1 ≤ H ≤ 12) and M (0 ≤ M < 60).',
      output: 'Print the angle in degrees with up to 7 decimal places.',
      samples: [
        { stdin: '12 0', expected: '0' },
        { stdin: '6 0', expected: '180' }
      ]
    },
    'pie-are-squared': {
      title: 'Pie Are Squared',
      desc: 'Calculate the area of a circle with given radius R using Pi = 3.141592653589793.',
      input: 'A single positive integer R (R ≤ 1000).',
      output: 'Print the area of the circle.',
      samples: [
        { stdin: '5', expected: '78.53981633974483' },
        { stdin: '10', expected: '314.1592653589793' }
      ]
    },
    'running-average': {
      title: 'Running Average',
      desc: 'Given N integers, calculate and print the running average after reading each integer.',
      input: 'An integer N followed by N integers.',
      output: 'Print running average after each number.',
      samples: [
        { stdin: '3\n1 2 3', expected: '1\n1.5\n2' }
      ]
    },
    'byang-and-addition': {
      title: 'Byang\'s Additions',
      desc: 'Determine if adding two positive integers produces any carry or not.',
      input: 'Two positive integers A and B.',
      output: 'Print "Yes" if there is a carry, otherwise "No".',
      samples: [
        { stdin: '123 456', expected: 'No' },
        { stdin: '555 555', expected: 'Yes' }
      ]
    }
  };

  // Helper: Generates a clean C++ CP template with zero comments
  function generateCpTemplate(problem, slug) {
    return `#include <bits/stdc++.h>
using namespace std;

using ll = long long;
using pii = pair<int, int>;
using vi = vector<int>;

#define pb push_back
#define all(x) (x).begin(), (x).end()
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

  // Preloaded working solution for Formatted Numbers (clean, zero comments)
  const DEFAULT_CPP_CODE = 
`#include <bits/stdc++.h>
using namespace std;

using ll = long long;
using pii = pair<int, int>;
using vi = vector<int>;

#define pb push_back
#define all(x) (x).begin(), (x).end()
#define fast_io ios_base::sync_with_stdio(false); cin.tie(NULL);

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
    fast_io;
    
    #ifndef ONLINE_JUDGE
    freopen("input.txt", "r", stdin);
    freopen("output.txt", "w", stdout);
    #endif
    
    int t = 1;
    while (t--) {
        solve();
    }
    
    return 0;
}
`;

  // DOM Elements
  const codeEditor = document.getElementById('codeEditor');
  const editorContainer = document.getElementById('editorContainer');
  const lineNumbers = document.getElementById('lineNumbers');
  const cursorPosition = document.getElementById('cursorPosition');
  const dirtyIndicator = document.getElementById('dirtyIndicator');
  const resetTemplateBtn = document.getElementById('resetTemplateBtn');
  const formatCodeBtn = document.getElementById('formatCodeBtn');
  const snippetsBtn = document.getElementById('snippetsBtn');
  const snippetsMenu = document.getElementById('snippetsMenu');
  const snippetsMenuList = document.getElementById('snippetsMenuList');

  // Dynamic Suggestion Box Elements
  const suggestionBox = document.getElementById('suggestionBox');
  const suggestionList = document.getElementById('suggestionList');
  const suggestionPreview = document.getElementById('suggestionPreview');
  const previewTitle = document.getElementById('previewTitle');
  const previewBadge = document.getElementById('previewBadge');
  const previewDesc = document.getElementById('previewDesc');
  const previewCode = document.getElementById('previewCode');

  // Sound Elements
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const soundLabel = document.getElementById('soundLabel');
  const modalSoundEnabled = document.getElementById('modalSoundEnabled');
  const modalSoundVolume = document.getElementById('modalSoundVolume');
  const volumePercent = document.getElementById('volumePercent');
  const testAcceptedSoundBtn = document.getElementById('testAcceptedSoundBtn');
  const testNotAcceptedSoundBtn = document.getElementById('testNotAcceptedSoundBtn');

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
  const codeblocksBtn = document.getElementById('codeblocksBtn');
  const codeblocksMenu = document.getElementById('codeblocksMenu');
  const openInCodeblocksBtn = document.getElementById('openInCodeblocksBtn');
  const exportCbpBtn = document.getElementById('exportCbpBtn');
  const exportZipBtn = document.getElementById('exportZipBtn');

  const settingsModal = document.getElementById('settingsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const modalToken = document.getElementById('modalToken');
  const modalRepo = document.getElementById('modalRepo');
  const modalBranch = document.getElementById('modalBranch');
  const modalCompiler = document.getElementById('modalCompiler');
  const toastContainer = document.getElementById('toastContainer');

  // Suggestion State
  const suggestionState = {
    isOpen: false,
    items: [],
    selectedIndex: 0,
    activeWord: '',
    start: 0,
    end: 0,
    charWidth: 7.85
  };

  // Initialization
  init();

  function init() {
    initMeasure();
    loadSettings();
    updateLineNumbers();
    renderCaseTabs();
    loadActiveCase();
    renderQuickSnippetsMenu();
    attachEventListeners();

    // Check for problem parameter in URL (e.g. ?problem=1900A or ?problem=copycat)
    const urlParams = new URLSearchParams(window.location.search);
    const querySlug = urlParams.get('problem') || urlParams.get('slug') || urlParams.get('p');

    if (querySlug) {
      loadProblem(querySlug);
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['activeProblemSlug', 'lastProblemSlug', 'cf_active_problem', 'last_problem_platform'], (data) => {
        let target = '';
        if (data.last_problem_platform === 'codeforces' && data.cf_active_problem && data.cf_active_problem.contestId) {
          target = `${data.cf_active_problem.contestId}${data.cf_active_problem.problemIndex}`;
        } else if (data.activeProblemSlug) {
          target = data.activeProblemSlug;
        } else if (data.cf_active_problem && data.cf_active_problem.contestId) {
          target = `${data.cf_active_problem.contestId}${data.cf_active_problem.problemIndex}`;
        } else if (data.lastProblemSlug) {
          target = data.lastProblemSlug;
        }

        if (target) {
          loadProblem(target);
        } else {
          codeEditor.value = DEFAULT_CPP_CODE;
          updateLineNumbers();
        }
      });
    } else {
      codeEditor.value = DEFAULT_CPP_CODE;
      updateLineNumbers();
    }
  }

  function initMeasure() {
    try {
      const span = document.createElement('span');
      span.style.fontFamily = 'var(--font-mono)';
      span.style.fontSize = '13px';
      span.style.visibility = 'hidden';
      span.style.position = 'absolute';
      span.textContent = 'WWWWWWWWWW';
      document.body.appendChild(span);
      suggestionState.charWidth = (span.getBoundingClientRect().width / 10) || 7.85;
      span.remove();
    } catch (e) {
      suggestionState.charWidth = 7.85;
    }
  }

  function attachEventListeners() {
    // Editor Input & Line Numbers + Autocomplete
    codeEditor.addEventListener('input', () => {
      updateLineNumbers();
      dirtyIndicator.classList.add('dirty');

      // Auto-suggest on typing
      const { word } = getWordBeforeCursor();
      if (word && word.length >= 1) {
        showSuggestions(false);
      } else {
        hideSuggestions();
      }
    });

    codeEditor.addEventListener('scroll', () => {
      lineNumbers.scrollTop = codeEditor.scrollTop;
      if (suggestionState.isOpen) {
        updateSuggestionPosition();
      }
    });

    codeEditor.addEventListener('keyup', updateCursorStats);
    codeEditor.addEventListener('click', () => {
      updateCursorStats();
      hideSuggestions();
    });

    // Smart Tab, Auto-Indent, & Auto-Pairing in Editor
    codeEditor.addEventListener('keydown', handleEditorShortcuts);

    // Quick Snippets Menu in Editor Header
    if (snippetsBtn && snippetsMenu) {
      snippetsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        snippetsMenu.classList.toggle('hidden');
      });
    }

    // Audio Feedback Quick Toggle
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        SoundManager.setEnabled(state.soundEnabled);
        updateSoundUI();
        saveSettings();
        if (state.soundEnabled) {
          SoundManager.playAccepted();
          showToast('🔊 Audio feedback enabled (Accepted / WA sounds)', 'info');
        } else {
          showToast('🔇 Audio feedback muted', 'info');
        }
      });
    }

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

    // Code::Blocks Actions
    if (codeblocksBtn && codeblocksMenu) {
      codeblocksBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        codeblocksMenu.classList.toggle('hidden');
      });
    }

    if (openInCodeblocksBtn) {
      openInCodeblocksBtn.addEventListener('click', () => {
        if (codeblocksMenu) codeblocksMenu.classList.add('hidden');
        openInCodeBlocksIde();
      });
    }

    if (exportCbpBtn) {
      exportCbpBtn.addEventListener('click', () => {
        if (codeblocksMenu) codeblocksMenu.classList.add('hidden');
        exportCodeBlocksProject();
      });
    }

    if (exportZipBtn) {
      exportZipBtn.addEventListener('click', () => {
        if (codeblocksMenu) codeblocksMenu.classList.add('hidden');
        exportStarterPack();
      });
    }

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
      if (modalSoundEnabled) modalSoundEnabled.checked = state.soundEnabled;
      if (modalSoundVolume) {
        modalSoundVolume.value = Math.round(state.soundVolume * 100);
        if (volumePercent) volumePercent.textContent = `${modalSoundVolume.value}%`;
      }
      settingsModal.classList.remove('hidden');
    });

    // Sound Test Buttons in Settings
    if (testAcceptedSoundBtn) {
      testAcceptedSoundBtn.addEventListener('click', () => {
        SoundManager.playAccepted();
      });
    }
    if (testNotAcceptedSoundBtn) {
      testNotAcceptedSoundBtn.addEventListener('click', () => {
        SoundManager.playNotAccepted();
      });
    }
    if (modalSoundVolume) {
      modalSoundVolume.addEventListener('input', () => {
        const val = parseInt(modalSoundVolume.value, 10);
        state.soundVolume = val / 100;
        SoundManager.setVolume(state.soundVolume);
        if (volumePercent) volumePercent.textContent = `${val}%`;
      });
    }
    if (modalSoundEnabled) {
      modalSoundEnabled.addEventListener('change', () => {
        state.soundEnabled = modalSoundEnabled.checked;
        SoundManager.setEnabled(state.soundEnabled);
      });
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }
    if (settingsModal) {
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
      });
    }

    // Dismiss modals and dropdowns on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsModal && !settingsModal.classList.contains('hidden')) {
          settingsModal.classList.add('hidden');
        }
        if (snippetsMenu) snippetsMenu.classList.add('hidden');
        if (codeblocksMenu) codeblocksMenu.classList.add('hidden');
        hideSuggestions();
      }
    });

    // Dismiss dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (snippetsMenu && !snippetsMenu.contains(e.target) && e.target !== snippetsBtn && !snippetsBtn.contains(e.target)) {
        snippetsMenu.classList.add('hidden');
      }
      if (codeblocksMenu && !codeblocksMenu.contains(e.target) && e.target !== codeblocksBtn && !codeblocksBtn.contains(e.target)) {
        codeblocksMenu.classList.add('hidden');
      }
      if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== codeEditor) {
        hideSuggestions();
      }
    });

    saveSettingsBtn.addEventListener('click', () => {
      state.githubToken = modalToken.value.trim();
      state.githubRepo = modalRepo.value.trim();
      state.githubBranch = modalBranch.value.trim() || 'main';
      state.compilerEngine = modalCompiler.value;
      if (modalSoundEnabled) state.soundEnabled = modalSoundEnabled.checked;
      if (modalSoundVolume) state.soundVolume = parseInt(modalSoundVolume.value, 10) / 100;
      SoundManager.setEnabled(state.soundEnabled);
      SoundManager.setVolume(state.soundVolume);
      updateSoundUI();
      saveSettings();
      settingsModal.classList.add('hidden');
      showToast('Settings saved successfully!', 'success');
    });
  }

  // Handle Editor Shortcuts (Ctrl+Enter to Run, Tab for 4 spaces, Auto-Brackets, Suggestions)
  function handleEditorShortcuts(e) {
    // If suggestion box is open, handle autocomplete keys
    if (suggestionState.isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestionState.selectedIndex = (suggestionState.selectedIndex + 1) % suggestionState.items.length;
        updateActiveSuggestionItem();
        renderSuggestionPreview();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestionState.selectedIndex = (suggestionState.selectedIndex - 1 + suggestionState.items.length) % suggestionState.items.length;
        updateActiveSuggestionItem();
        renderSuggestionPreview();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSelectedSuggestion();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSuggestions();
        return;
      }
    }

    // Ctrl + Space to trigger code suggestions manually
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      showSuggestions(true);
      return;
    }

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

  // --- Code Suggestion & Snippet Autocomplete Logic ---
  function getWordBeforeCursor() {
    const text = codeEditor.value;
    const pos = codeEditor.selectionStart;
    let start = pos;
    while (start > 0 && /[a-zA-Z0-9_#]/.test(text[start - 1])) {
      start--;
    }
    let end = pos;
    while (end < text.length && /[a-zA-Z0-9_#]/.test(text[end])) {
      end++;
    }
    const word = text.substring(start, pos);
    return { word, start, end, pos };
  }

  function showSuggestions(forceAll = false) {
    const { word, start, end } = getWordBeforeCursor();
    suggestionState.start = start;
    suggestionState.end = end;
    suggestionState.activeWord = word;

    let matches = [];
    if (forceAll || !word) {
      matches = CP_SNIPPETS.slice();
    } else {
      const q = word.toLowerCase();
      matches = CP_SNIPPETS.filter(item => {
        return item.prefix.toLowerCase().startsWith(q) ||
               item.prefix.toLowerCase().includes(q) ||
               item.label.toLowerCase().includes(q);
      }).sort((a, b) => {
        const aStarts = a.prefix.toLowerCase().startsWith(q);
        const bStarts = b.prefix.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.prefix.localeCompare(b.prefix);
      });
    }

    if (matches.length === 0) {
      hideSuggestions();
      return;
    }

    suggestionState.items = matches;
    suggestionState.selectedIndex = 0;
    suggestionState.isOpen = true;

    renderSuggestionList();
    renderSuggestionPreview();
    updateSuggestionPosition();
    suggestionBox.classList.remove('hidden');
  }

  function hideSuggestions() {
    suggestionState.isOpen = false;
    if (suggestionBox) suggestionBox.classList.add('hidden');
  }

  function renderSuggestionList() {
    if (!suggestionList) return;
    suggestionList.innerHTML = '';
    const q = (suggestionState.activeWord || '').toLowerCase();

    suggestionState.items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = `suggestion-item ${index === suggestionState.selectedIndex ? 'active' : ''}`;
      
      const badge = document.createElement('span');
      badge.className = `sug-badge cat-${item.category}`;
      badge.textContent = item.category.toUpperCase();

      const label = document.createElement('span');
      label.className = 'sug-name';
      
      if (q && item.prefix.toLowerCase().includes(q)) {
        const idx = item.prefix.toLowerCase().indexOf(q);
        label.innerHTML = `${escapeHtml(item.prefix.substring(0, idx))}<span class="hl">${escapeHtml(item.prefix.substring(idx, idx + q.length))}</span>${escapeHtml(item.prefix.substring(idx + q.length))}`;
      } else {
        label.textContent = item.prefix;
      }

      div.appendChild(badge);
      div.appendChild(label);

      div.addEventListener('mouseenter', () => {
        suggestionState.selectedIndex = index;
        updateActiveSuggestionItem();
        renderSuggestionPreview();
      });

      div.addEventListener('click', (e) => {
        e.stopPropagation();
        insertSelectedSuggestion();
      });

      suggestionList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateActiveSuggestionItem() {
    if (!suggestionList) return;
    const items = suggestionList.querySelectorAll('.suggestion-item');
    items.forEach((it, idx) => {
      if (idx === suggestionState.selectedIndex) {
        it.classList.add('active');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('active');
      }
    });
  }

  function renderSuggestionPreview() {
    const item = suggestionState.items[suggestionState.selectedIndex];
    if (!item) return;

    if (previewTitle) previewTitle.textContent = item.label;
    if (previewBadge) {
      previewBadge.textContent = item.category.toUpperCase();
      previewBadge.className = `preview-badge sug-badge cat-${item.category}`;
    }
    if (previewDesc) previewDesc.textContent = item.desc;
    if (previewCode) {
      previewCode.textContent = item.preview || item.template.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\{0\}|\|/g, '');
    }
  }

  function updateSuggestionPosition() {
    if (!editorContainer || !codeEditor || !suggestionBox) return;
    const textBefore = codeEditor.value.substring(0, codeEditor.selectionStart);
    const lines = textBefore.split('\n');
    const lineIndex = lines.length - 1;
    const colIndex = lines[lines.length - 1].length;

    const lineHeight = 22;
    const gutterWidth = 48;
    const padLeft = 12;
    const padTop = 12;

    const editorRect = editorContainer.getBoundingClientRect();
    const scrollTop = codeEditor.scrollTop;
    const scrollLeft = codeEditor.scrollLeft;

    let top = padTop + (lineIndex + 1) * lineHeight - scrollTop;
    let left = gutterWidth + padLeft + (colIndex * suggestionState.charWidth) - scrollLeft;

    const boxWidth = 520;
    const boxHeight = 240;

    if (left + boxWidth > editorRect.width - 16) {
      left = Math.max(gutterWidth + 10, editorRect.width - boxWidth - 16);
    }
    if (top + boxHeight > editorRect.height - 16) {
      top = Math.max(8, padTop + lineIndex * lineHeight - boxHeight - scrollTop);
    }

    suggestionBox.style.top = `${Math.max(0, top)}px`;
    suggestionBox.style.left = `${Math.max(0, left)}px`;
  }

  function insertSelectedSuggestion() {
    const item = suggestionState.items[suggestionState.selectedIndex];
    if (!item) return;

    const text = codeEditor.value;
    const start = suggestionState.start;
    const end = suggestionState.end;

    const { cleanText, targetOffset, targetLength } = expandSnippetTemplate(item.template);

    codeEditor.value = text.substring(0, start) + cleanText + text.substring(end);

    const newCursorStart = start + targetOffset;
    const newCursorEnd = newCursorStart + targetLength;
    codeEditor.focus();
    codeEditor.setSelectionRange(newCursorStart, newCursorEnd);

    updateLineNumbers();
    dirtyIndicator.classList.add('dirty');
    hideSuggestions();
    SoundManager.playSnippetAccepted();
  }

  function expandSnippetTemplate(template) {
    let targetOffset = -1;
    let targetLength = 0;

    const firstPlaceholderMatch = template.match(/\$\{1:([^}]+)\}/);
    const zeroMatch = template.match(/\$\{0\}|\|/);

    let cleanText = template;

    if (firstPlaceholderMatch) {
      const full = firstPlaceholderMatch[0];
      const val = firstPlaceholderMatch[1];
      const idx = cleanText.indexOf(full);
      cleanText = cleanText.replace(/\$\{1:[^}]+\}/g, val);
      cleanText = cleanText.replace(/\$\{\d+:([^}]+)\}/g, '$1');
      cleanText = cleanText.replace(/\$\{0\}|\|/g, '');
      targetOffset = idx;
      targetLength = val.length;
    } else if (zeroMatch) {
      const idx = cleanText.indexOf(zeroMatch[0]);
      cleanText = cleanText.replace(/\$\{\d+:([^}]+)\}/g, '$1');
      cleanText = cleanText.replace(/\$\{0\}|\|/g, '');
      targetOffset = idx;
      targetLength = 0;
    } else {
      cleanText = cleanText.replace(/\$\{\d+:([^}]+)\}/g, '$1');
      cleanText = cleanText.replace(/\$\{0\}|\|/g, '');
      targetOffset = cleanText.length;
      targetLength = 0;
    }

    return { cleanText, targetOffset, targetLength };
  }

  function renderQuickSnippetsMenu() {
    if (!snippetsMenuList) return;
    snippetsMenuList.innerHTML = '';
    const featured = CP_SNIPPETS.slice(0, 15);

    featured.forEach(s => {
      const div = document.createElement('div');
      div.className = 'snippet-chip-item';
      div.innerHTML = `
        <span class="chip-title"><span class="sug-badge cat-${s.category}">${s.category.toUpperCase()}</span> ${s.prefix}</span>
        <span class="chip-desc">${s.desc.length > 28 ? s.desc.substring(0, 26) + '...' : s.desc}</span>
      `;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        snippetsMenu.classList.add('hidden');
        insertSnippetDirect(s);
      });
      snippetsMenuList.appendChild(div);
    });
  }

  function insertSnippetDirect(snippet) {
    const text = codeEditor.value;
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    const { cleanText, targetOffset, targetLength } = expandSnippetTemplate(snippet.template);

    codeEditor.value = text.substring(0, start) + cleanText + text.substring(end);
    const newStart = start + targetOffset;
    codeEditor.focus();
    codeEditor.setSelectionRange(newStart, newStart + targetLength);
    updateLineNumbers();
    dirtyIndicator.classList.add('dirty');
    SoundManager.playSnippetAccepted();
    showToast(`⚡ Inserted snippet: ${snippet.prefix}`, 'info');
  }

  function updateSoundUI() {
    if (soundToggleBtn && soundIcon && soundLabel) {
      if (state.soundEnabled) {
        soundToggleBtn.classList.remove('muted');
        soundToggleBtn.classList.add('active');
        soundIcon.textContent = '🔊';
        soundLabel.textContent = 'Sound: ON';
      } else {
        soundToggleBtn.classList.remove('active');
        soundToggleBtn.classList.add('muted');
        soundIcon.textContent = '🔇';
        soundLabel.textContent = 'Sound: OFF';
      }
    }
    if (modalSoundEnabled) modalSoundEnabled.checked = state.soundEnabled;
    if (modalSoundVolume) {
      modalSoundVolume.value = Math.round(state.soundVolume * 100);
      if (volumePercent) volumePercent.textContent = `${modalSoundVolume.value}%`;
    }
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
        SoundManager.playNotAccepted();
      } else {
        showToast(`Case ${active.id} finished in ${active.time}`, 'success');
      }
    } catch (err) {
      console.error(err);
      outputConsole.textContent = `Execution Error: ${err.message}\n\nPlease verify your internet connection for compiler API or check syntax.`;
      showToast(err.message, 'error');
      SoundManager.playNotAccepted();
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
      SoundManager.playAccepted();
    } else {
      overallVerdict.innerHTML = `<span class="verdict-tag failed">${passedCount}/${state.cases.length} Passed</span>`;
      showToast(`Failed on test case(s): ${failedCases.join(', ')}`, 'error');
      SoundManager.playNotAccepted();
    }
  }

  // Core C++ Compilation Engine (Judge0 CE GCC 14.1 API or Local Server)
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

    // Default: Fast, Free Public Judge0 CE (GCC 14.1.0, modern C++20 / C++23)
    try {
      const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          source_code: code,
          language_id: 105, // C++ (GCC 14.1.0)
          stdin: stdin || ''
        })
      });

      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      if (response.ok) {
        const data = await response.json();
        let stdout = (data.stdout || '').trim();
        let stderr = (data.compile_output || data.stderr || '').trim();

        if (!stdout && stderr) {
          stdout = stderr;
        }

        return {
          stdout: stdout,
          stderr: stderr,
          durationMs,
          time: data.time ? `${data.time}s` : `${(durationMs / 1000).toFixed(2)}s`,
          memory: data.memory ? `${(data.memory / 1024).toFixed(1)}MB` : '1.2MB',
          exitCode: data.status && data.status.id === 3 ? 0 : 1
        };
      }
    } catch (err) {
      console.warn('Judge0 CE GCC 14 failed, trying fallback...', err);
    }

    // Fallback: Judge0 GCC 9.2.0 (Language ID 54)
    try {
      const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          source_code: code,
          language_id: 54, // GCC 9.2.0
          stdin: stdin || ''
        })
      });
      if (response.ok) {
        const data = await response.json();
        let stdout = (data.stdout || '').trim();
        let stderr = (data.compile_output || data.stderr || '').trim();
        if (!stdout && stderr) stdout = stderr;
        return {
          stdout,
          stderr,
          time: data.time ? `${data.time}s` : '0.01s',
          memory: data.memory ? `${(data.memory / 1024).toFixed(1)}MB` : '1.2MB',
          exitCode: data.status && data.status.id === 3 ? 0 : 1
        };
      }
    } catch (e) {}

    // Fallback to local server if available
    try {
      const localRes = await fetch('http://localhost:3000/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin, language: 'cpp' })
      });
      if (localRes.ok) return await localRes.json();
    } catch (e) {}

    throw new Error('Compiler API unavailable. Please check your internet connection.');
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
      diffBanner.className = 'diff-banner pass celebrate';
      diffIcon.textContent = '✅';
      diffTitle.textContent = 'Accepted (Sample Match)';
      diffDesc.textContent = 'Your program output matches the expected result!';
      SoundManager.playAccepted();
      setTimeout(() => diffBanner.classList.remove('celebrate'), 600);
    } else {
      diffBanner.className = 'diff-banner fail shake';
      diffIcon.textContent = '❌';
      diffTitle.textContent = 'Wrong Answer (Mismatch)';
      diffDesc.textContent = `Expected: "${testCase.expected.trim()}" | Got: "${testCase.stdout.trim()}"`;
      SoundManager.playNotAccepted();
      setTimeout(() => diffBanner.classList.remove('shake'), 400);
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

  // Load Problem Details & Extract Official Test Cases (Toph.co & Codeforces)
  async function loadProblem(query, preserveCode = false) {
    if (!query) return;
    const trimmed = query.trim();
    if (!trimmed) return;

    // Detect if Codeforces problem:
    const cfUrlMatch = trimmed.match(/(?:codeforces\.com\/)?(?:contest|gym|problemset\/problem)\/([0-9]+)(?:\/problem)?\/([a-zA-Z0-9]+)/i);
    const cfShortMatch = trimmed.match(/^(?:cf[:_\s-]*)?([0-9]{1,6})[\/_\s-]*([a-zA-Z][0-9]?)$/i);

    let isCodeforces = false;
    let cfContest = '';
    let cfIndex = '';

    if (cfUrlMatch) {
      isCodeforces = true;
      cfContest = cfUrlMatch[1];
      cfIndex = cfUrlMatch[2].toUpperCase();
    } else if (cfShortMatch) {
      isCodeforces = true;
      cfContest = cfShortMatch[1];
      cfIndex = cfShortMatch[2].toUpperCase();
    }

    if (isCodeforces) {
      state.platform = 'codeforces';
      state.contestId = cfContest;
      state.problemIndex = cfIndex;
      state.problemSlug = `cf_${cfContest}${cfIndex}`;
      if (problemInput) problemInput.value = `${cfContest}${cfIndex}`;

      showToast(`Loading Codeforces ${cfContest}${cfIndex}...`, 'info');

      let problem = null;
      const storageKey = `cf_problem_${cfContest}${cfIndex}`;

      // 1. Check Chrome Extension storage cache first (direct hit from content script)
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        try {
          const stored = await new Promise(r => chrome.storage.local.get([storageKey, 'cf_active_problem'], r));
          const candidate = stored[storageKey] || (
            stored.cf_active_problem && 
            stored.cf_active_problem.contestId == cfContest && 
            String(stored.cf_active_problem.problemIndex).toUpperCase() === cfIndex
              ? stored.cf_active_problem
              : null
          );
          if (candidate && candidate.samples && candidate.samples.length > 0 && (candidate.samples[0].stdin || candidate.samples[0].expected || candidate.desc)) {
            problem = candidate;
          }
        } catch (e) {}
      }

      // 2. Check open tabs
      if (!problem && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
        try {
          const cfTabs = await new Promise(r => chrome.tabs.query({ url: '*://*.codeforces.com/*' }, r));
          if (cfTabs && cfTabs.length > 0) {
            for (const t of cfTabs) {
              const u = t.url || '';
              if (u.includes(`/${cfContest}/`) && u.toUpperCase().includes(`/${cfIndex}`)) {
                const tabData = await new Promise(resolve => {
                  chrome.tabs.sendMessage(t.id, { action: 'GET_PAGE_PROBLEM_DATA' }, res => {
                    if (res && res.success && res.data) resolve(res.data);
                    else resolve(null);
                  });
                });
                if (tabData && tabData.samples && tabData.samples.length > 0) {
                  problem = tabData;
                  chrome.storage.local.set({ [storageKey]: problem, cf_active_problem: problem });
                  break;
                }
              }
            }
          }
        } catch (e) {}
      }

      // 3. Request background worker to fetch/scrape
      if (!problem && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const bgRes = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'FETCH_CF_PROBLEM', contestId: cfContest, problemIndex: cfIndex }, res => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else if (res && res.success && res.data) resolve(res.data);
              else reject(new Error(res ? res.error : 'Background fetch failed'));
            });
          });
          if (bgRes && (bgRes.title || (bgRes.samples && bgRes.samples.length > 0))) {
            problem = bgRes;
          }
        } catch (e) {
          console.warn('Background worker CF problem fetch failed:', e);
        }
      }

      // 4. Local dev proxy if running standalone node server
      if (!problem) {
        try {
          const proxyRes = await fetch(`/api/problem?slug=${cfContest}${cfIndex}&platform=codeforces`);
          if (proxyRes.ok) {
            problem = await proxyRes.json();
          }
        } catch (e) {}
      }

      // 5. Official Codeforces REST API direct fetch fallback
      if (!problem) {
        try {
          const apiRes = await fetch('https://codeforces.com/api/problemset.problems');
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.status === 'OK' && apiData.result && apiData.result.problems) {
              const p = apiData.result.problems.find(item => item.contestId == cfContest && String(item.index).toUpperCase() === cfIndex);
              if (p) {
                problem = {
                  contestId: cfContest,
                  problemIndex: cfIndex,
                  title: `${cfContest}${cfIndex} - ${p.name}`,
                  timeLimit: '1.0s',
                  memoryLimit: '256MB',
                  desc: `Codeforces Problem: ${cfContest}${cfIndex} - ${p.name}\nRating: ${p.rating || 'Unrated'}\nTags: ${p.tags ? p.tags.join(', ') : 'none'}\n\nOfficial Link: https://codeforces.com/contest/${cfContest}/problem/${cfIndex}`,
                  input: 'Standard input format (cin >> ...)',
                  output: 'Standard output format (cout << ...)',
                  samples: [{ stdin: '', expected: '' }]
                };
              }
            }
          }
        } catch (e) {}
      }

      if (!problem) {
        problem = {
          title: `Codeforces ${cfContest}${cfIndex}`,
          desc: `Codeforces problem ${cfContest}${cfIndex}. Visit https://codeforces.com/contest/${cfContest}/problem/${cfIndex} for complete description.`,
          samples: [{ stdin: '', expected: '' }]
        };
      }

      state.problemTitle = problem.title;

      // Update UI
      displayProblemTitle.textContent = problem.title;
      displaySlug.textContent = `CF ${cfContest}${cfIndex}`;
      problemDescriptionText.textContent = problem.desc;
      problemInputFormat.textContent = problem.input || 'Standard Input (Codeforces)';
      problemOutputFormat.textContent = problem.output || 'Standard Output (Codeforces)';
      problemExternalLink.href = `https://codeforces.com/contest/${cfContest}/problem/${cfIndex}`;
      problemExternalLink.textContent = `Codeforces ${cfContest}${cfIndex} ↗`;

      if (submitTophBtn) {
        submitTophBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span>Submit on Codeforces</span>
        `;
      }

      // Populate test cases
      state.cases = (problem.samples && problem.samples.length > 0 ? problem.samples : [{ stdin: '', expected: '' }]).map((s, idx) => ({
        id: idx + 1,
        stdin: s.stdin,
        expected: s.expected,
        stdout: '',
        status: 'ready',
        time: '--',
        memory: '--'
      }));
      state.activeCaseId = 1;
      renderCaseTabs();
      loadActiveCase();

      if (!preserveCode) {
        codeEditor.value = generateCpTemplate(problem, `${cfContest}${cfIndex}`);
        updateLineNumbers();
        dirtyIndicator.classList.remove('dirty');
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          [storageKey]: problem,
          cf_active_problem: problem,
          last_problem_platform: 'codeforces'
        });
      }

      showToast(`Loaded Codeforces ${cfContest}${cfIndex}!`, 'success');
      return;
    }

    // Otherwise: Toph.co problem
    state.platform = 'toph';
    const slug = trimmed
      .replace(/.*toph\.co\/p\//i, '')
      .replace(/[\/?#].*$/, '')
      .trim()
      .toLowerCase();

    if (!slug) return;
    state.problemSlug = slug;
    if (problemInput) problemInput.value = slug;

    if (submitTophBtn) {
      submitTophBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <span>Submit to Toph</span>
      `;
    }

    showToast(`Loading problem: ${slug}...`, 'info');

    let problem = null;

    // 1. If inside Chrome Extension, use background service worker (bypasses CORS with host permissions)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'FETCH_TOPH_PROBLEM', slug }, res => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (res && res.success && res.data) {
              resolve(res.data);
            } else {
              reject(new Error(res ? res.error : 'Background fetch failed'));
            }
          });
        });
        if (bgRes && bgRes.title) {
          problem = bgRes;
        }
      } catch (e) {
        console.warn('Background worker problem fetch failed, trying direct/proxy...', e);
      }
    }

    // 2. Direct fetch from Toph.co JSON endpoint (works in local dev if CORS allowed)
    if (!problem) {
      try {
        const res = await fetch(`https://toph.co/p/${slug}.json`);
        if (res.ok) {
          const json = await res.json();
          const statement = (json.statement && json.statement.en_us) 
            ? json.statement.en_us 
            : (json.statement ? Object.values(json.statement)[0] : {});
          const rawSamples = json.samples || [];

          const samples = rawSamples.map(s => ({
            stdin: (s.input || '').replace(/\r\n/g, '\n').trim(),
            expected: (s.output || '').replace(/\r\n/g, '\n').trim()
          })).filter(s => s.stdin || s.expected);

          problem = {
            slug,
            title: (statement && statement.title) 
              ? statement.title.trim() 
              : slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            desc: stripHtml(statement ? statement.bodyHTML || '' : ''),
            input: stripHtml(statement ? statement.inputHTML || '' : ''),
            output: stripHtml(statement ? statement.outputHTML || '' : ''),
            samples: samples.length > 0 ? samples : [{ stdin: '', expected: '' }]
          };
        }
      } catch (e) {
        console.warn('Direct Toph JSON fetch unavailable, trying local proxy...', e);
      }
    }

    // 3. Local server proxy if running standalone node server
    if (!problem) {
      try {
        const proxyRes = await fetch(`/api/problem?slug=${slug}`);
        if (proxyRes.ok) {
          problem = await proxyRes.json();
        }
      } catch (e) {
        console.warn('Local proxy unavailable, checking catalog...', e);
      }
    }

    // 4. Fallback to catalog if offline
    if (!problem) {
      problem = TOPH_CATALOG[slug];
    }

    // 5. Default fallback
    if (!problem) {
      problem = {
        slug,
        title: slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        desc: `Problem ${slug} from Toph.co. Check official page for complete description.`,
        input: 'Standard input format.',
        output: 'Standard output format.',
        samples: [{ stdin: '', expected: '' }]
      };
    }

    state.problemTitle = problem.title;

    // 1. Update Problem Pane UI
    displayProblemTitle.textContent = problem.title;
    displaySlug.textContent = slug;
    problemDescriptionText.textContent = problem.desc;
    problemInputFormat.textContent = problem.input || 'Standard input format.';
    problemOutputFormat.textContent = problem.output || 'Standard output format.';
    sampleInputPreview.textContent = (problem.samples[0] && problem.samples[0].stdin) ? problem.samples[0].stdin : '--';
    sampleOutputPreview.textContent = (problem.samples[0] && problem.samples[0].expected) ? problem.samples[0].expected : '--';
    problemExternalLink.href = `https://toph.co/p/${slug}`;
    problemExternalLink.textContent = `Toph.co ↗`;

    // 2. Automatically Populate Problem Test Cases into the Workbench Tabs
    state.cases = problem.samples.map((s, idx) => ({
      id: idx + 1,
      stdin: s.stdin,
      expected: s.expected,
      stdout: '',
      status: 'ready',
      time: '--',
      memory: '--'
    }));
    state.activeCaseId = 1;
    renderCaseTabs();
    loadActiveCase();

    // 3. Clean C++ Code with Zero Comments
    if (!preserveCode) {
      if (slug === 'formatted-numbers') {
        codeEditor.value = DEFAULT_CPP_CODE;
      } else {
        codeEditor.value = generateCpTemplate(problem, slug);
      }
      updateLineNumbers();
      dirtyIndicator.classList.remove('dirty');
    }

    // Save active problem in storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastProblemSlug: slug, lastProblemTitle: problem.title, last_problem_platform: 'toph' });
    }

    showToast(`Loaded "${problem.title}" from Toph.co!`, 'success');
  }

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  // 1-Click Push to GitHub
  async function syncSolutionToGitHub() {
    syncGitHubBtn.disabled = true;
    syncGitHubBtn.innerHTML = `<span>⏳ Committing...</span>`;

    const payload = {
      platform: state.platform || (state.contestId ? 'codeforces' : 'toph'),
      contestId: state.contestId || '',
      problemIndex: state.problemIndex || '',
      problemSlug: state.problemSlug,
      problemTitle: displayProblemTitle.textContent,
      language: 'C++',
      cpuTime: (cpuTimeBadge.textContent || '').replace('Time: ', '').trim() || '0.01s',
      memory: (memoryBadge.textContent || '').replace('Memory: ', '').trim() || '1.2MB',
      code: codeEditor.value,
      problemDescription: problemDescriptionText.textContent,
      problemUrl: problemExternalLink.href,
      submissionId: 'ide-' + Date.now()
    };

    // If inside Chrome extension, commit via background worker (avoids CORS and uses popup settings)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'COMMIT_SOLUTION',
        payload
      }, (response) => {
        syncGitHubBtn.disabled = false;
        syncGitHubBtn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>Push to GitHub</span>
        `;

        if (chrome.runtime.lastError) {
          showToast(`GitHub Error: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }

        if (response && response.success) {
          dirtyIndicator.classList.remove('dirty');
          showToast(`🎉 Pushed solution to GitHub!`, 'success');
        } else {
          showToast(`Commit failed: ${response ? response.error : 'Unknown error'}`, 'error');
          if (response && response.error && response.error.toLowerCase().includes('token')) {
            settingsModal.classList.remove('hidden');
          }
        }
      });
      return;
    }

    // Standalone fallback
    if (!state.githubToken) {
      settingsModal.classList.remove('hidden');
      showToast('Please enter your GitHub Personal Access Token first.', 'error');
      syncGitHubBtn.disabled = false;
      return;
    }

    const [owner, repoName] = state.githubRepo.split('/');
    if (!owner || !repoName) {
      showToast('Invalid repository name. Format: username/repo', 'error');
      syncGitHubBtn.disabled = false;
      return;
    }

    const slug = state.problemSlug;
    const filePath = `toph/${slug}/solution.cpp`;
    const message = `Solve: ${displayProblemTitle.textContent} in C++ [Accepted]`;
    const content = codeEditor.value;

    try {
      let sha = null;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${state.githubBranch}`, {
        headers: {
          'Authorization': state.githubToken.startsWith('Bearer ') ? state.githubToken : `Bearer ${state.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeToGit-Extension'
        }
      });

      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
      }

      const putPayload = {
        message: message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: state.githubBranch
      };
      if (sha) putPayload.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': state.githubToken.startsWith('Bearer ') ? state.githubToken : `Bearer ${state.githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'CodeToGit-Extension'
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

  // Auto-Submit directly to Platform (Toph.co or Codeforces)
  function submitToToph() {
    const code = codeEditor.value;
    const slug = state.problemSlug;

    if (!code || !code.trim()) {
      showToast('Please write your C++ solution first!', 'error');
      return;
    }

    // Copy to clipboard as immediate backup
    navigator.clipboard.writeText(code).catch(() => {});

    // Codeforces submission
    if (state.platform === 'codeforces' && state.contestId && state.problemIndex) {
      const cfUrl = `https://codeforces.com/contest/${state.contestId}/problem/${state.problemIndex}`;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          cf_pending_code: {
            contestId: state.contestId,
            problemIndex: state.problemIndex,
            title: state.problemTitle || `${state.contestId}${state.problemIndex}`,
            code: code,
            timestamp: Date.now()
          }
        }, () => {
          showToast('📋 Code copied! Opening Codeforces to submit...', 'success');
          if (chrome.tabs && chrome.tabs.create) {
            chrome.tabs.create({ url: cfUrl });
          } else {
            window.open(cfUrl, '_blank');
          }
        });
      } else {
        showToast('📋 Code copied! Opening Codeforces...', 'success');
        window.open(cfUrl, '_blank');
      }
      return;
    }

    // Toph submission
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
        const tophUrl = `https://toph.co/p/${slug}#codetogit-submit`;
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: tophUrl });
        } else {
          window.open(tophUrl, '_blank');
        }
      });
    } else {
      showToast('📋 Code copied! Opening Toph.co for submission...', 'success');
      window.open(`https://toph.co/p/${slug}#codetogit-submit`, '_blank');
    }
  }

  // Copy Code
  function copyCodeToClipboard() {
    navigator.clipboard.writeText(codeEditor.value).then(() => {
      showToast('📋 Code copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  // Reset Template with Clean C++ code
  function resetTemplate() {
    const slug = state.problemSlug;
    const problem = TOPH_CATALOG[slug] || {
      title: displayProblemTitle.textContent,
      desc: problemDescriptionText.textContent,
      samples: state.cases.map(c => ({ stdin: c.stdin, expected: c.expected }))
    };

    if (confirm('Reset editor to the standard clean C++ template?')) {
      codeEditor.value = (slug === 'formatted-numbers') ? DEFAULT_CPP_CODE : generateCpTemplate(problem, slug);
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

  // --- Code::Blocks IDE Integration Helpers ---
  function generateCbpXml(slug) {
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

  function downloadFile(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 250);
  }

  function exportCodeBlocksProject() {
    const slug = state.problemSlug || 'solution';
    const xml = generateCbpXml(slug);
    downloadFile(`${slug}.cbp`, xml, 'application/xml');
    showToast(`✔ Downloaded Code::Blocks project: ${slug}.cbp`, 'success');
  }

  function exportStarterPack() {
    const slug = state.problemSlug || 'solution';
    const cbpXml = generateCbpXml(slug);
    const code = codeEditor.value;
    const input = customInput.value || (state.cases[0] ? state.cases[0].stdin : '');

    downloadFile(`${slug}.cbp`, cbpXml, 'application/xml');
    setTimeout(() => downloadFile('solution.cpp', code, 'text/x-c++src'), 250);
    setTimeout(() => downloadFile('input.txt', input, 'text/plain'), 500);

    showToast(`📦 Downloaded starter files: ${slug}.cbp, solution.cpp, input.txt`, 'success');
  }

  async function openInCodeBlocksIde() {
    const slug = state.problemSlug || 'solution';
    const code = codeEditor.value;
    const stdin = customInput.value || (state.cases[0] ? state.cases[0].stdin : '');
    const expected = expectedOutput.value || (state.cases[0] ? state.cases[0].expected : '');

    showToast('🚀 Launching Code::Blocks...', 'info');

    // Try posting to local server if running
    try {
      const res = await fetch('http://localhost:3000/api/codeblocks/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code, stdin, expected })
      });

      if (res.ok) {
        showToast(`✔ Code::Blocks launched! Problem saved in toph/${slug}/`, 'success');
        return;
      }
    } catch (e) {
      // Local server not running
    }

    // Fallback if local server is not active
    exportCodeBlocksProject();
    showToast(`✔ Downloaded ${slug}.cbp! Run "npm run ide" to enable 1-click launch.`, 'info');
  }

  // Local Storage Management
  function loadSettings() {
    try {
      const saved = localStorage.getItem('codetogit_ide_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.githubToken = parsed.githubToken || state.githubToken;
        state.githubRepo = parsed.githubRepo || state.githubRepo;
        state.githubBranch = parsed.githubBranch || state.githubBranch;
        state.compilerEngine = parsed.compilerEngine || state.compilerEngine;
        if (typeof parsed.soundEnabled !== 'undefined') state.soundEnabled = parsed.soundEnabled;
        if (typeof parsed.soundVolume !== 'undefined') state.soundVolume = parsed.soundVolume;
      }
    } catch (e) {}

    // Also check chrome.storage if running inside extension context
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['githubToken', 'repo', 'branch', 'soundEnabled', 'soundVolume'], (data) => {
        if (data.githubToken) state.githubToken = data.githubToken;
        if (data.repo) state.githubRepo = data.repo;
        if (data.branch) state.githubBranch = data.branch;
        if (typeof data.soundEnabled !== 'undefined') state.soundEnabled = data.soundEnabled;
        if (typeof data.soundVolume !== 'undefined') state.soundVolume = data.soundVolume;
        SoundManager.setEnabled(state.soundEnabled);
        SoundManager.setVolume(state.soundVolume);
        updateSoundUI();
      });
    }

    SoundManager.setEnabled(state.soundEnabled);
    SoundManager.setVolume(state.soundVolume);
    updateSoundUI();
  }

  function saveSettings() {
    try {
      localStorage.setItem('codetogit_ide_settings', JSON.stringify({
        githubToken: state.githubToken,
        githubRepo: state.githubRepo,
        githubBranch: state.githubBranch,
        compilerEngine: state.compilerEngine,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume
      }));
    } catch (e) {}

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume
      });
    }
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
