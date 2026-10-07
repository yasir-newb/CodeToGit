#include <bits/stdc++.h>
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
    cout << res << "\n";
}

int main() {
    fast_io;
    
    int t = 1;
    while (t--) {
        solve();
    }
    
    return 0;
}
