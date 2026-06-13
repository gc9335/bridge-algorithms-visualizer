#include "benchmark_bridge.h"
#include <iostream>
#include <iomanip>
#include <chrono>
#include <algorithm>   // 必须包含，否则 std::find 无法使用

std::vector<std::pair<int, int>> findBridgesBenchmark(Graph& graph, bool verbose) {
    using namespace std;
    using namespace std::chrono;

    vector<pair<int, int>> bridges;
    int totalEdges = graph.edges.size();
    if (totalEdges == 0) return bridges;

    // 1. 计算原图的连通分量个数
    int originalComponents = graph.countComponents();

    auto start = high_resolution_clock::now();
    int progressStep = max(1, totalEdges / 10);   // 每 10% 打印一次

    for (int i = 0; i < totalEdges; ++i) {
        int u = graph.edges[i].first;
        int v = graph.edges[i].second;

        // 打印进度
        if (verbose && ((i + 1) % progressStep == 0 || i == totalEdges - 1)) {
            auto now = high_resolution_clock::now();
            auto elapsed = duration_cast<seconds>(now - start).count();
            cout << "\r进度: " << fixed << setprecision(1)
                 << (100.0 * (i + 1) / totalEdges) << "%  (已用时 "
                 << elapsed << "s)" << flush;
        }

        // 2. 临时删除边 (u, v)
        auto it_u = find(graph.adj[u].begin(), graph.adj[u].end(), v);
        auto it_v = find(graph.adj[v].begin(), graph.adj[v].end(), u);
        if (it_u != graph.adj[u].end()) graph.adj[u].erase(it_u);
        if (it_v != graph.adj[v].end()) graph.adj[v].erase(it_v);

        // 3. 删边后检查连通分量数
        int newComponents = graph.countComponents();
        if (newComponents > originalComponents) {
            bridges.emplace_back(u, v);
        }

        // 4. 恢复边
        graph.adj[u].push_back(v);
        graph.adj[v].push_back(u);
    }

    if (verbose) cout << endl;   // 换行
    return bridges;
}
