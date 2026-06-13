#include "graph_loader.h"
#include <fstream>
#include <queue>
#include <algorithm>
#include <iostream>

bool Graph::loadFromFile(const std::string& filename) {
    std::ifstream file(filename);
    if (!file.is_open()) {
        std::cerr << "无法打开文件: " << filename << std::endl;
        return false;
    }

    int E;
    file >> V >> E;
    adj.assign(V, std::vector<int>());
    edges.clear();
    edges.reserve(E);

    int u, v;
    for (int i = 0; i < E; ++i) {
        if (!(file >> u >> v)) {
            std::cerr << "边数据读取失败，位置: " << i << std::endl;
            return false;
        }
        if (u < 0 || u >= V || v < 0 || v >= V) {
            std::cerr << "顶点编号越界: " << u << " " << v << std::endl;
            return false;
        }
        if (u == v) continue;                       // 忽略自环
        // 简单去重（若原始数据无重边可移除此检查以加速）
        if (std::find(adj[u].begin(), adj[u].end(), v) == adj[u].end()) {
            adj[u].push_back(v);
            adj[v].push_back(u);
            if (u < v) edges.emplace_back(u, v);
            else       edges.emplace_back(v, u);
        }
    }
    file.close();
    return true;
}

int Graph::countComponents() const {
    std::vector<bool> visited(V, false);
    int components = 0;
    for (int i = 0; i < V; ++i) {
        if (!visited[i]) {
            ++components;
            std::queue<int> q;
            q.push(i);
            visited[i] = true;
            while (!q.empty()) {
                int curr = q.front(); q.pop();
                for (int next : adj[curr]) {
                    if (!visited[next]) {
                        visited[next] = true;
                        q.push(next);
                    }
                }
            }
        }
    }
    return components;
}
