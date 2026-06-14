# 实验五：桥查找算法

本项目实现并比较两种无向图桥查找算法：

- 基准算法：逐条删边，然后用 BFS 重新统计连通块。
- 高效算法：构建生成森林，用并查集处理非树边形成的环，排除所有非桥边。

## 实验目的

1. 掌握图的连通性。
2. 掌握并查集的基本原理和应用。

高效算法不使用 Tarjan 的 `dfn/low`，符合实验中“应用并查集设计一个比基准算法更高效的算法”的要求。详细原理见 [ALGORITHM_EXPLANATION.md](ALGORITHM_EXPLANATION.md)。

## 文件结构

| 文件 | 说明 |
|---|---|
| `graph_loader.h/.cpp` | 图结构、文件加载、BFS 连通块统计 |
| `benchmark_bridge.h/.cpp` | 基准算法：删边 + BFS |
| `efficient_bridge.h/.cpp` | 高效算法：生成森林 + 并查集 |
| `benchmark_runner.cpp` | 性能实验主程序 |
| `tests/bridge_correctness_check.cpp` | 随机小图正确性检查 |
| `visualizer.html/.css/.js` | 桥查找过程可视化页面 |
| `analysis/` | 性能 CSV、图像和分析报告 |

## 输入格式

图文件中的前两个整数依次表示顶点数 `V` 和边数 `E`，它们可以在同一行，也可以分成两行。之后的 `E` 对整数表示无向边 `u v`，顶点编号从 `0` 开始。

示例：

```text
7 8
0 1
1 2
2 0
2 3
3 4
4 5
5 3
5 6
```

`Graph::loadFromFile` 会忽略自环、去除重复边，并检查顶点编号是否越界。

## 算法接口

```cpp
#include "graph_loader.h"
#include "benchmark_bridge.h"
#include "efficient_bridge.h"

Graph g;
if (!g.loadFromFile("mediumG(1).txt")) {
    return 1;
}

auto bridges1 = findBridgesBenchmark(g, false);
auto bridges2 = findBridgesEfficient(g);
```

`findBridgesBenchmark(g, verbose)` 的第二个参数控制是否打印进度。批量测试时建议设为 `false`。

## 编译与验证

随机小图正确性检查：

```powershell
g++ -std=c++17 -O2 graph_loader.cpp benchmark_bridge.cpp efficient_bridge.cpp tests/bridge_correctness_check.cpp -o bridge_correctness_check.exe
.\bridge_correctness_check.exe
```

预期输出：

```text
All randomized bridge checks passed.
```

性能实验：

```powershell
g++ -std=c++17 -O2 graph_loader.cpp benchmark_bridge.cpp efficient_bridge.cpp benchmark_runner.cpp -o analysis\benchmark_runner.exe
.\analysis\benchmark_runner.exe
python analysis\plot_bridge_results.py
```

生成结果：

- `analysis/bridge_benchmark_results.csv`
- `analysis/bridge_benchmark_runtime.png`
- `analysis/bridge_benchmark_analysis.md`

## 可视化页面

直接打开：

```text
visualizer.html
```

或启动本地静态服务：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:8765/visualizer.html
```

页面支持样例图、自定义输入、基准算法演示、并查集优化演示、播放/暂停、单步、重置、速度控制、事件日志、伪代码联动和复杂度对比。

## 性能结果摘要

最近一次实验结果见 [analysis/bridge_benchmark_analysis.md](analysis/bridge_benchmark_analysis.md)。

| 用例 | V | E | 基准算法 ms | 高效算法 ms | 桥数 | 加速比 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| chain_cycle_100 | 100 | 108 | 0.077 | 0.014 | 9 | 5.50x | ok |
| chain_cycle_1000 | 1000 | 1048 | 4.979 | 0.020 | 19 | 248.95x | ok |
| random_connected_1000 | 1000 | 3499 | 29.469 | 0.080 | 0 | 368.36x | ok |
| mediumG_file | 250 | 1273 | 3.231 | 0.023 | 0 | 140.48x | ok |
| largeG_file | 1000000 | 7586063 | 跳过 | 368.884 | 8 | - | baseline_skipped |

`largeG_file` 没有运行基准算法，因为它有 7,586,063 条边；基准算法需要对每条边重新进行一次全图连通性遍历，实验上基本不可行。

## 算法复杂度

| 算法 | 核心思想 | 时间复杂度 | 空间复杂度 |
|---|---|---:|---:|
| 基准算法 | 枚举每条边，删除后重新 BFS | `O(E * (V + E))` | `O(V)` |
| 生成森林 + 并查集 | 用非树边形成的环标记非桥 | 近似 `O(V + E)` | `O(V + E)` |

高效算法的关键是：非树边 `(u, v)` 会和生成树中 `u` 到 `v` 的路径形成一个环。环上的树边都不是桥。并查集用于压缩已经标记过的树路径，使后续非树边处理时可以快速跳过。
