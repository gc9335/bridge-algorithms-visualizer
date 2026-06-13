#ifndef GRAPH_LOADER_H
#define GRAPH_LOADER_H

#include <vector>
#include <utility>
#include <string>

struct Graph {
    int V;                                   // 顶点数
    std::vector<std::vector<int>> adj;       // 邻接表
    std::vector<std::pair<int, int>> edges;  // 所有边（保证 u < v）

    // 从文件加载图，自动去重、忽略自环
    bool loadFromFile(const std::string& filename);

    // 计算当前图的连通分量个数（基于 BFS）
    int countComponents() const;
};

#endif