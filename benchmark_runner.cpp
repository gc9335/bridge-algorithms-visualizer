#include "benchmark_bridge.h"
#include "efficient_bridge.h"
#include "graph_loader.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <queue>
#include <random>
#include <set>
#include <string>
#include <vector>

using Clock = std::chrono::steady_clock;
using Edge = std::pair<int, int>;

struct CaseSpec {
    std::string name;
    std::string family;
    Graph graph;
    bool runBaseline = false;
    std::string note;
};

struct ComplexitySpec {
    std::string experiment;
    std::string name;
    Graph graph;
    std::string note;
};

struct ResultRow {
    std::string caseName;
    std::string family;
    int vertices = 0;
    int edges = 0;
    int components = 0;
    double density = 0.0;
    double avgDegree = 0.0;
    long double baselineWorkEstimate = 0.0L;
    double baselineMs = -1.0;
    double efficientMs = -1.0;
    int baselineBridges = -1;
    int efficientBridges = -1;
    double bridgeRatio = 0.0;
    double speedup = -1.0;
    double efficientEdgesPerMs = 0.0;
    double estimatedIndexMemoryMb = 0.0;
    std::string status;
    std::string note;
};

struct ComplexityRow {
    std::string experiment;
    std::string caseName;
    int vertices = 0;
    int edges = 0;
    int components = 0;
    int bridges = 0;
    long double baselineWorkEstimate = 0.0L;
    long double efficientWorkEstimate = 0.0L;
    double baselineMs = -1.0;
    double efficientMs = -1.0;
    int baselineBridges = -1;
    int efficientBridges = -1;
    double speedup = -1.0;
    std::string status;
    std::string note;
};

static Graph makeGraph(int vertices, const std::vector<Edge>& inputEdges) {
    Graph graph;
    graph.V = vertices;
    graph.adj.assign(vertices, {});
    graph.edges.clear();
    graph.edges.reserve(inputEdges.size());

    std::set<Edge> uniqueEdges;
    for (auto [u, v] : inputEdges) {
        if (u == v) continue;
        if (u > v) std::swap(u, v);
        if (u < 0 || v < 0 || u >= vertices || v >= vertices) continue;
        if (!uniqueEdges.insert({u, v}).second) continue;
        graph.adj[u].push_back(v);
        graph.adj[v].push_back(u);
        graph.edges.push_back({u, v});
    }
    for (auto& list : graph.adj) {
        std::sort(list.begin(), list.end());
    }
    return graph;
}

static Graph makePathGraph(int vertices) {
    std::vector<Edge> edges;
    edges.reserve(std::max(0, vertices - 1));
    for (int i = 0; i + 1 < vertices; ++i) {
        edges.push_back({i, i + 1});
    }
    return makeGraph(vertices, edges);
}

static Graph makeCycleGraph(int vertices) {
    std::vector<Edge> edges;
    edges.reserve(vertices);
    for (int i = 0; i < vertices; ++i) {
        edges.push_back({i, (i + 1) % vertices});
    }
    return makeGraph(vertices, edges);
}

static Graph makeStarGraph(int leaves) {
    std::vector<Edge> edges;
    edges.reserve(leaves);
    for (int i = 1; i <= leaves; ++i) {
        edges.push_back({0, i});
    }
    return makeGraph(leaves + 1, edges);
}

static Graph makeChainWithLocalCycles(int vertices, int cycleSpan) {
    std::vector<Edge> edges;
    for (int i = 0; i + 1 < vertices; ++i) {
        edges.push_back({i, i + 1});
    }
    for (int i = 0; i + cycleSpan < vertices; i += cycleSpan) {
        edges.push_back({i, i + cycleSpan});
    }
    return makeGraph(vertices, edges);
}

static Graph makeTwoCliquesWithBridge(int cliqueSize) {
    const int vertices = cliqueSize * 2;
    std::vector<Edge> edges;
    for (int base : {0, cliqueSize}) {
        for (int i = 0; i < cliqueSize; ++i) {
            for (int j = i + 1; j < cliqueSize; ++j) {
                edges.push_back({base + i, base + j});
            }
        }
    }
    edges.push_back({cliqueSize - 1, cliqueSize});
    return makeGraph(vertices, edges);
}

static Graph makeDisconnectedMixedGraph(int blocks, int blockSize) {
    std::vector<Edge> edges;
    const int vertices = blocks * blockSize;
    for (int b = 0; b < blocks; ++b) {
        int base = b * blockSize;
        for (int i = 0; i + 1 < blockSize; ++i) {
            edges.push_back({base + i, base + i + 1});
        }
        if (blockSize >= 4) {
            edges.push_back({base, base + 2});
            edges.push_back({base + 1, base + 3});
        }
    }
    return makeGraph(vertices, edges);
}

static Graph makeRandomConnectedGraph(int vertices, int extraEdges, unsigned seed) {
    std::vector<Edge> edges;
    edges.reserve(static_cast<size_t>(vertices - 1 + extraEdges));
    for (int i = 1; i < vertices; ++i) {
        edges.push_back({i - 1, i});
    }

    std::mt19937 rng(seed);
    std::uniform_int_distribution<int> dist(0, vertices - 1);
    std::set<Edge> seen;
    for (auto edge : edges) {
        seen.insert(edge);
    }

    while (static_cast<int>(edges.size()) < vertices - 1 + extraEdges) {
        int u = dist(rng);
        int v = dist(rng);
        if (u == v) continue;
        if (u > v) std::swap(u, v);
        if (seen.insert({u, v}).second) {
            edges.push_back({u, v});
        }
    }
    return makeGraph(vertices, edges);
}

static Graph makeRandomTreeWithExtraEdges(int vertices, int extraEdges, unsigned seed) {
    std::vector<Edge> edges;
    edges.reserve(static_cast<size_t>(vertices - 1 + extraEdges));
    std::mt19937 rng(seed);

    for (int i = 1; i < vertices; ++i) {
        std::uniform_int_distribution<int> parentDist(0, i - 1);
        edges.push_back({parentDist(rng), i});
    }

    std::uniform_int_distribution<int> vertexDist(0, vertices - 1);
    std::set<Edge> seen;
    for (auto edge : edges) {
        if (edge.first > edge.second) std::swap(edge.first, edge.second);
        seen.insert(edge);
    }

    while (static_cast<int>(edges.size()) < vertices - 1 + extraEdges) {
        int u = vertexDist(rng);
        int v = vertexDist(rng);
        if (u == v) continue;
        if (u > v) std::swap(u, v);
        if (seen.insert({u, v}).second) {
            edges.push_back({u, v});
        }
    }
    return makeGraph(vertices, edges);
}

static Graph makeRandomCycleCoreWithLeaves(int coreVertices, int leaves, int extraCoreEdges, unsigned seed) {
    std::vector<Edge> edges;
    const int vertices = coreVertices + leaves;
    edges.reserve(static_cast<size_t>(coreVertices + extraCoreEdges + leaves));

    std::set<Edge> seen;
    auto addEdge = [&](int u, int v) {
        if (u == v) return;
        if (u > v) std::swap(u, v);
        if (seen.insert({u, v}).second) {
            edges.push_back({u, v});
        }
    };

    for (int i = 0; i < coreVertices; ++i) {
        addEdge(i, (i + 1) % coreVertices);
    }

    std::mt19937 rng(seed);
    std::uniform_int_distribution<int> coreDist(0, coreVertices - 1);
    while (static_cast<int>(edges.size()) < coreVertices + extraCoreEdges) {
        addEdge(coreDist(rng), coreDist(rng));
    }

    for (int i = 0; i < leaves; ++i) {
        addEdge(coreDist(rng), coreVertices + i);
    }

    return makeGraph(vertices, edges);
}

static bool loadCase(const std::string& label, const std::string& family,
                     const std::string& filename, bool runBaseline,
                     std::vector<CaseSpec>& cases, const std::string& note) {
    Graph graph;
    if (!graph.loadFromFile(filename)) {
        std::cerr << "skip missing input: " << filename << "\n";
        return false;
    }
    cases.push_back({label, family, std::move(graph), runBaseline, note});
    return true;
}

static std::string csvEscape(const std::string& value) {
    if (value.find_first_of(",\"\n\r") == std::string::npos) return value;
    std::string escaped = "\"";
    for (char ch : value) {
        if (ch == '"') escaped += "\"\"";
        else escaped += ch;
    }
    escaped += "\"";
    return escaped;
}

template <typename Func>
static std::pair<double, std::vector<Edge>> timeCall(Func&& func) {
    auto start = Clock::now();
    auto bridges = func();
    auto end = Clock::now();
    auto us = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();
    return {static_cast<double>(us) / 1000.0, bridges};
}

template <typename Func>
static std::pair<double, std::vector<Edge>> averageOver(int repeats, Func&& func) {
    std::vector<Edge> bridges;
    auto start = Clock::now();
    for (int i = 0; i < repeats; ++i) {
        bridges = func();
    }
    auto end = Clock::now();
    auto us = std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();
    return {static_cast<double>(us) / 1000.0 / repeats, bridges};
}

static double graphDensity(int vertices, int edges) {
    if (vertices <= 1) return 0.0;
    long double possible = static_cast<long double>(vertices) * (vertices - 1) / 2.0L;
    return static_cast<double>(edges / possible);
}

static long double baselineWorkEstimate(int vertices, int edges) {
    return static_cast<long double>(edges) * static_cast<long double>(vertices + edges);
}

static double estimatedIndexMemoryMb(int vertices, int edges) {
    long double bytes = 0.0L;
    bytes += static_cast<long double>(edges) * sizeof(Edge);       // edge list
    bytes += static_cast<long double>(2LL * edges) * sizeof(int);  // adjacency entries
    bytes += static_cast<long double>(vertices) * (5 * sizeof(int) + 3); // helper arrays
    return static_cast<double>(bytes / (1024.0L * 1024.0L));
}

static bool shouldRunBaseline(const Graph& graph, bool requested) {
    if (!requested) return false;
    const long double limit = 5.0e7L;
    return baselineWorkEstimate(graph.V, static_cast<int>(graph.edges.size())) <= limit;
}

static int baselineRepeatsForWork(long double work) {
    if (work <= 5.0e6L) return 15;
    if (work <= 2.0e7L) return 7;
    if (work <= 5.0e7L) return 3;
    return 1;
}

static int efficientRepeats(const Graph& graph) {
    if (graph.edges.size() > 1000000) return 3;
    if (graph.edges.size() > 100000) return 5;
    if (graph.edges.size() > 10000) return 30;
    if (graph.edges.size() > 2000) return 100;
    return 300;
}

int main() {
    std::vector<CaseSpec> cases;
    cases.push_back({"path_100", "all_bridges", makePathGraph(100), true, "path graph: every edge is a bridge"});
    cases.push_back({"path_1000", "all_bridges", makePathGraph(1000), true, "larger path graph"});
    cases.push_back({"cycle_1000", "no_bridges", makeCycleGraph(1000), true, "single cycle: no bridge"});
    cases.push_back({"star_1000", "all_bridges", makeStarGraph(1000), true, "star graph: every edge is a bridge"});
    cases.push_back({"chain_cycle_1000", "mixed_sparse", makeChainWithLocalCycles(1000, 20), true,
                     "chain plus local cycle-closing edges"});
    cases.push_back({"two_cliques_80", "dense_blocks", makeTwoCliquesWithBridge(80), true,
                     "two dense blocks connected by one bridge"});
    cases.push_back({"disconnected_30x20", "disconnected", makeDisconnectedMixedGraph(30, 20), true,
                     "multiple disconnected components with local cycles"});
    cases.push_back({"random_sparse_1000", "random_sparse", makeRandomConnectedGraph(1000, 1200, 42), true,
                     "connected random sparse graph"});
    cases.push_back({"random_mid_1000", "random_mid", makeRandomConnectedGraph(1000, 2500, 2026), true,
                     "connected random medium-density graph"});
    cases.push_back({"random_mid_5000", "random_mid", makeRandomConnectedGraph(5000, 12000, 2027), false,
                     "baseline skipped because repeated BFS is too slow at this size"});
    cases.push_back({"random_large_20000", "random_large", makeRandomConnectedGraph(20000, 50000, 2028), false,
                     "efficient algorithm scalability case"});

    loadCase("mediumG_file", "provided", "mediumG(1).txt", true, cases, "provided input file");
    loadCase("largeG_file", "provided_large", "largeG.txt", false, cases,
             "baseline skipped for 7.6M edges; efficient algorithm only");

    std::vector<ResultRow> rows;
    rows.reserve(cases.size());

    for (auto& spec : cases) {
        ResultRow row;
        row.caseName = spec.name;
        row.family = spec.family;
        row.vertices = spec.graph.V;
        row.edges = static_cast<int>(spec.graph.edges.size());
        row.components = spec.graph.countComponents();
        row.density = graphDensity(row.vertices, row.edges);
        row.avgDegree = row.vertices == 0 ? 0.0 : (2.0 * row.edges / row.vertices);
        row.baselineWorkEstimate = baselineWorkEstimate(row.vertices, row.edges);
        row.estimatedIndexMemoryMb = estimatedIndexMemoryMb(row.vertices, row.edges);
        row.note = spec.note;
        row.status = "ok";

        std::cout << "\n== " << spec.name << " [" << spec.family << "]"
                  << " (V=" << row.vertices << ", E=" << row.edges
                  << ", components=" << row.components << ") ==\n";

        int repeats = efficientRepeats(spec.graph);
        auto [efficientMs, efficientBridges] =
            averageOver(repeats, [&]() { return findBridgesEfficient(spec.graph); });
        row.efficientMs = efficientMs;
        row.efficientBridges = static_cast<int>(efficientBridges.size());
        row.bridgeRatio = row.edges == 0 ? 0.0 : static_cast<double>(row.efficientBridges) / row.edges;
        row.efficientEdgesPerMs = efficientMs > 0.0 ? row.edges / efficientMs : 0.0;

        std::cout << "efficient avg-of-" << repeats << ": " << efficientMs
                  << " ms, bridges=" << row.efficientBridges
                  << ", throughput=" << row.efficientEdgesPerMs << " edges/ms\n";

        bool runBaseline = shouldRunBaseline(spec.graph, spec.runBaseline);
        if (runBaseline) {
            Graph baselineGraph = spec.graph;
            auto [baselineMs, baselineBridges] =
                timeCall([&]() { return findBridgesBenchmark(baselineGraph, false); });
            row.baselineMs = baselineMs;
            row.baselineBridges = static_cast<int>(baselineBridges.size());
            row.speedup = efficientMs > 0.0 ? baselineMs / efficientMs : -1.0;
            std::cout << "baseline: " << baselineMs << " ms, bridges="
                      << row.baselineBridges << ", speedup=" << row.speedup << "x\n";
            if (row.baselineBridges != row.efficientBridges) {
                row.status = "bridge_count_mismatch";
            }
        } else {
            row.status = "baseline_skipped";
            if (spec.runBaseline) {
                row.note += "; baseline auto-skipped because estimated repeated-traversal work is too high";
            }
            std::cout << "baseline: skipped (" << row.note << ")\n";
        }

        rows.push_back(row);
    }

    std::ofstream csv("analysis/bridge_benchmark_results.csv");
    csv << "case,family,vertices,edges,components,density,avg_degree,"
           "baseline_work_estimate,baseline_ms,efficient_ms,baseline_bridges,"
           "efficient_bridges,bridge_ratio,speedup,efficient_edges_per_ms,"
           "estimated_index_memory_mb,status,note\n";

    csv << std::fixed << std::setprecision(6);
    for (const auto& row : rows) {
        csv << csvEscape(row.caseName) << ','
            << csvEscape(row.family) << ','
            << row.vertices << ','
            << row.edges << ','
            << row.components << ','
            << row.density << ','
            << row.avgDegree << ','
            << std::setprecision(0) << static_cast<double>(row.baselineWorkEstimate) << std::setprecision(6) << ','
            << row.baselineMs << ','
            << row.efficientMs << ','
            << row.baselineBridges << ','
            << row.efficientBridges << ','
            << row.bridgeRatio << ','
            << row.speedup << ','
            << row.efficientEdgesPerMs << ','
            << row.estimatedIndexMemoryMb << ','
            << csvEscape(row.status) << ','
            << csvEscape(row.note) << '\n';
    }

    std::vector<ComplexitySpec> complexityCases;
    const int edgeGrowthVertices = 800;
    const std::vector<int> edgeGrowthExtras = {0, 200, 500, 900, 1400, 2200, 3200, 4500};
    for (int extra : edgeGrowthExtras) {
        int edgeCount = edgeGrowthVertices - 1 + extra;
        complexityCases.push_back({
            "edge_growth",
            "edge_E_" + std::to_string(edgeCount),
            makeRandomTreeWithExtraEdges(edgeGrowthVertices, extra, 7000 + extra),
            "fixed V=800; random tree plus extra random edges"
        });
    }

    const int coreVertices = 500;
    const int extraCoreEdges = 650;
    const std::vector<int> bridgeGrowthLeaves = {0, 100, 250, 500, 900, 1400, 2000};
    for (int leaves : bridgeGrowthLeaves) {
        complexityCases.push_back({
            "bridge_growth",
            "bridge_B_" + std::to_string(leaves),
            makeRandomCycleCoreWithLeaves(coreVertices, leaves, extraCoreEdges, 9000 + leaves),
            "random cycle core with attached leaves; leaf edges are bridges"
        });
    }

    std::vector<ComplexityRow> complexityRows;
    complexityRows.reserve(complexityCases.size());

    std::cout << "\n== controlled complexity experiments ==\n";
    for (auto& spec : complexityCases) {
        ComplexityRow row;
        row.experiment = spec.experiment;
        row.caseName = spec.name;
        row.vertices = spec.graph.V;
        row.edges = static_cast<int>(spec.graph.edges.size());
        row.components = spec.graph.countComponents();
        row.baselineWorkEstimate = baselineWorkEstimate(row.vertices, row.edges);
        row.efficientWorkEstimate = static_cast<long double>(row.vertices + row.edges);
        row.status = "ok";
        row.note = spec.note;

        int efficientRepeatCount = efficientRepeats(spec.graph);
        auto [efficientMs, efficientBridges] =
            averageOver(efficientRepeatCount, [&]() { return findBridgesEfficient(spec.graph); });
        row.efficientMs = efficientMs;
        row.efficientBridges = static_cast<int>(efficientBridges.size());
        row.bridges = row.efficientBridges;

        Graph baselineGraph = spec.graph;
        int baselineRepeatCount = baselineRepeatsForWork(row.baselineWorkEstimate);
        auto [baselineMs, baselineBridges] =
            averageOver(baselineRepeatCount, [&]() { return findBridgesBenchmark(baselineGraph, false); });
        row.baselineMs = baselineMs;
        row.baselineBridges = static_cast<int>(baselineBridges.size());
        row.speedup = row.efficientMs > 0.0 ? row.baselineMs / row.efficientMs : -1.0;
        if (row.baselineBridges != row.efficientBridges) {
            row.status = "bridge_count_mismatch";
        }

        std::cout << spec.name << " [" << spec.experiment << "]"
                  << " V=" << row.vertices << " E=" << row.edges
                  << " bridges=" << row.bridges
                  << " baseline=" << row.baselineMs << " ms"
                  << " efficient=" << row.efficientMs << " ms"
                  << " speedup=" << row.speedup << "x\n";

        complexityRows.push_back(row);
    }

    std::ofstream complexityCsv("analysis/bridge_complexity_results.csv");
    complexityCsv << "experiment,case,vertices,edges,components,bridges,"
                  << "baseline_work_estimate,efficient_work_estimate,"
                  << "baseline_ms,efficient_ms,baseline_bridges,efficient_bridges,"
                  << "speedup,status,note\n";

    complexityCsv << std::fixed << std::setprecision(6);
    for (const auto& row : complexityRows) {
        complexityCsv << csvEscape(row.experiment) << ','
                      << csvEscape(row.caseName) << ','
                      << row.vertices << ','
                      << row.edges << ','
                      << row.components << ','
                      << row.bridges << ','
                      << std::setprecision(0) << static_cast<double>(row.baselineWorkEstimate) << ','
                      << static_cast<double>(row.efficientWorkEstimate) << std::setprecision(6) << ','
                      << row.baselineMs << ','
                      << row.efficientMs << ','
                      << row.baselineBridges << ','
                      << row.efficientBridges << ','
                      << row.speedup << ','
                      << csvEscape(row.status) << ','
                      << csvEscape(row.note) << '\n';
    }

    std::cout << "\nwrote analysis/bridge_benchmark_results.csv\n";
    std::cout << "wrote analysis/bridge_complexity_results.csv\n";
    return 0;
}
