#ifndef BENCHMARK_BRIDGE_H
#define BENCHMARK_BRIDGE_H

#include "graph_loader.h"
#include <vector>
#include <utility>

// 基准找桥算法：删除每条边并检查连通分量数是否增加
// 返回所有桥的列表
std::vector<std::pair<int, int>> findBridgesBenchmark(Graph& graph, bool verbose = true);

#endif
