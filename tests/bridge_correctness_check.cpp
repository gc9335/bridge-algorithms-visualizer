#include <algorithm>
#include <iostream>
#include <random>
#include <set>
#include <utility>
#include <vector>

#include "../benchmark_bridge.h"
#include "../efficient_bridge.h"

using Edge = std::pair<int, int>;

static Graph makeGraph(int vertices, const std::vector<Edge>& inputEdges) {
    Graph graph;
    graph.V = vertices;
    graph.adj.assign(vertices, {});
    graph.edges.clear();

    std::set<Edge> uniqueEdges;
    for (auto [u, v] : inputEdges) {
        if (u == v) continue;
        if (u > v) std::swap(u, v);
        if (!uniqueEdges.insert({u, v}).second) continue;
        graph.adj[u].push_back(v);
        graph.adj[v].push_back(u);
        graph.edges.push_back({u, v});
    }
    return graph;
}

static std::vector<Edge> normalized(std::vector<Edge> edges) {
    for (auto& [u, v] : edges) {
        if (u > v) std::swap(u, v);
    }
    std::sort(edges.begin(), edges.end());
    return edges;
}

int main() {
    std::mt19937 rng(20260610);

    for (int vertices = 1; vertices <= 12; ++vertices) {
        int possibleEdges = vertices * (vertices - 1) / 2;
        for (int round = 0; round < 200; ++round) {
            std::vector<Edge> edges;
            for (int u = 0; u < vertices; ++u) {
                for (int v = u + 1; v < vertices; ++v) {
                    if ((rng() % 100) < 30) {
                        edges.push_back({u, v});
                    }
                }
            }

            if (possibleEdges > 0 && edges.empty() && (rng() % 2 == 0)) {
                int u = rng() % vertices;
                int v = rng() % vertices;
                if (u != v) edges.push_back({u, v});
            }

            Graph graph = makeGraph(vertices, edges);
            auto benchmark = normalized(findBridgesBenchmark(graph, false));
            auto efficient = normalized(findBridgesEfficient(graph));

            if (benchmark != efficient) {
                std::cerr << "Mismatch at V=" << vertices << ", round=" << round << "\n";
                std::cerr << "Benchmark:";
                for (auto [u, v] : benchmark) std::cerr << " (" << u << "," << v << ")";
                std::cerr << "\nEfficient:";
                for (auto [u, v] : efficient) std::cerr << " (" << u << "," << v << ")";
                std::cerr << "\n";
                return 1;
            }
        }
    }

    std::cout << "All randomized bridge checks passed.\n";
    return 0;
}
