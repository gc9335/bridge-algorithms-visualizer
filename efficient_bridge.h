#ifndef EFFICIENT_BRIDGE_H
#define EFFICIENT_BRIDGE_H

#include "graph_loader.h"
#include <vector>
#include <utility>

// 基于生成树 + 并查集的高效找桥算法
// 要求图以 Graph 结构传入，保证无自环、无重边
std::vector<std::pair<int, int>> findBridgesEfficient(const Graph& graph);

#endif
