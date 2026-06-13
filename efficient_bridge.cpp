#include "efficient_bridge.h"
#include <vector>
#include <algorithm>
#include <iostream>

using namespace std;

// ---------- 并查集 ----------
class UnionFind {
    vector<int> parent;
public:
    UnionFind(int n) {
        parent.resize(n);
        for (int i = 0; i < n; ++i) parent[i] = i;
    }

    int find(int x) {
        int root = x;
        while (parent[root] != root)
            root = parent[root];
        // 路径压缩
        while (x != root) {
            int next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    }

    void unite(int x, int y) {
        int rx = find(x);
        int ry = find(y);
        if (rx != ry) parent[rx] = ry;
    }
};

// ---------- 高效找桥主函数 ----------
vector<pair<int, int>> findBridgesEfficient(const Graph& graph) {
    int V = graph.V;
    const vector<vector<int>>& adj = graph.adj;
    
    vector<bool> visited(V, false);
    vector<int> parent(V, -1);
    vector<int> depth(V, 0);
    vector<pair<int, int>> nonTreeEdges;   // 存储非树边 (u, v)，u < v

    // 1. 用显式栈构建生成森林，收集非树边
    // 使用显式栈避免递归溢出
    vector<int> stack;
    for (int start = 0; start < V; ++start) {
        if (visited[start]) continue;
        
        stack.push_back(start);
        visited[start] = true;
        parent[start] = -1;
        depth[start] = 0;
        
        while (!stack.empty()) {
            int u = stack.back(); stack.pop_back();
            for (int v : adj[u]) {
                if (v == parent[u]) continue;
                if (!visited[v]) {
                    visited[v] = true;
                    parent[v] = u;
                    depth[v] = depth[u] + 1;
                    stack.push_back(v);
                } else if (u < v) {   // 避免重复收集同一条非树边
                    nonTreeEdges.push_back({u, v});
                }
            }
        }
    }

    // 2. 初始化所有树边为桥
    // is_bridge[i] = true 表示边 (parent[i], i) 是桥，i 从 0 开始
    vector<bool> is_bridge(V, true);
    // 根节点没有父边，所以不算桥
    for (int i = 0; i < V; ++i) {
        if (parent[i] == -1) is_bridge[i] = false;
    }

    // 3. 并查集处理每条非树边，标记基本环上的树边为非桥
    UnionFind uf(V);
    for (auto& e : nonTreeEdges) {
        int u = e.first, v = e.second;
        int ru = uf.find(u);
        int rv = uf.find(v);
        while (ru != rv) {
            // 选择深度较大的节点向上跳
            if (depth[ru] < depth[rv]) swap(ru, rv);
            // 标记 ru 的父边为非桥
            is_bridge[ru] = false;
            int p = parent[ru];
            uf.unite(ru, p);          // 将 ru 合并到其父节点
            ru = uf.find(p);
        }
    }

    // 4. 收集所有桥
    vector<pair<int, int>> bridges;
    for (int i = 0; i < V; ++i) {
        if (is_bridge[i]) {
            bridges.push_back({parent[i], i});
        }
    }
    
    return bridges;
}
