from pathlib import Path
import csv
import math

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "bridge_benchmark_results.csv"
COMPLEXITY_CSV_PATH = ROOT / "bridge_complexity_results.csv"
MD_PATH = ROOT / "bridge_benchmark_analysis.md"

FIG_RUNTIME = ROOT / "bridge_runtime_comparison.png"
FIG_SPEEDUP = ROOT / "bridge_speedup.png"
FIG_SCALABILITY = ROOT / "bridge_scalability.png"
FIG_STRUCTURE = ROOT / "bridge_structure_metrics.png"
FIG_WORK = ROOT / "bridge_work_estimate.png"
FIG_THEORY_ACTUAL = ROOT / "bridge_theory_vs_actual.png"
FIG_EDGE_GROWTH = ROOT / "bridge_edge_growth_complexity.png"
FIG_BRIDGE_GROWTH = ROOT / "bridge_bridge_growth_complexity.png"

PALETTE = {
    "baseline": "#d95f59",
    "efficient": "#0b4f6c",
    "warm": "#f28f3b",
    "green": "#1c7c54",
    "rose": "#cc5a71",
    "muted": "#6b7280",
    "grid": "#d6d0c4",
    "paper": "#fffaf1",
    "ink": "#1d2433",
}

FAMILY_LABELS = {
    "all_bridges": "全桥结构",
    "no_bridges": "无桥结构",
    "mixed_sparse": "稀疏混合",
    "dense_blocks": "稠密块",
    "disconnected": "非连通图",
    "random_sparse": "随机稀疏",
    "random_mid": "随机中密度",
    "random_large": "随机大图",
    "provided": "给定数据",
    "provided_large": "给定大图",
}

NUMERIC_INT = {
    "vertices",
    "edges",
    "components",
    "baseline_bridges",
    "efficient_bridges",
}

NUMERIC_FLOAT = {
    "density",
    "avg_degree",
    "baseline_work_estimate",
    "baseline_ms",
    "efficient_ms",
    "bridge_ratio",
    "speedup",
    "efficient_edges_per_ms",
    "estimated_index_memory_mb",
}

COMPLEXITY_INT = {
    "vertices",
    "edges",
    "components",
    "bridges",
    "baseline_bridges",
    "efficient_bridges",
}

COMPLEXITY_FLOAT = {
    "baseline_work_estimate",
    "efficient_work_estimate",
    "baseline_ms",
    "efficient_ms",
    "speedup",
}


def configure_style():
    plt.rcParams.update({
        "font.sans-serif": [
            "Microsoft YaHei",
            "SimHei",
            "SimSun",
            "Noto Sans CJK SC",
            "Arial Unicode MS",
            "DejaVu Sans",
        ],
        "axes.unicode_minus": False,
        "figure.facecolor": "#fbf8f3",
        "axes.facecolor": "#fffdf8",
        "axes.edgecolor": "#cfc7b8",
        "axes.labelcolor": PALETTE["ink"],
        "xtick.color": PALETTE["ink"],
        "ytick.color": PALETTE["ink"],
        "text.color": PALETTE["ink"],
        "axes.titleweight": "bold",
        "axes.titlesize": 15,
        "axes.labelsize": 11,
        "legend.frameon": True,
        "legend.facecolor": "#fffaf1",
        "legend.edgecolor": "#ddd3c2",
    })


def read_rows():
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        for key in NUMERIC_INT:
            row[key] = int(row[key])
        for key in NUMERIC_FLOAT:
            row[key] = float(row[key])
        row["efficient_theory"] = row["vertices"] + row["edges"]
    return rows


def read_complexity_rows():
    if not COMPLEXITY_CSV_PATH.exists():
        return []
    with COMPLEXITY_CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        for key in COMPLEXITY_INT:
            row[key] = int(row[key])
        for key in COMPLEXITY_FLOAT:
            row[key] = float(row[key])
    return rows


def label(row):
    return row["case"]


def family_label(row):
    return FAMILY_LABELS.get(row["family"], row["family"])


def measured_baseline(rows):
    return [row for row in rows if row["baseline_ms"] >= 0]


def set_case_ticks(ax, rows, rotation=28):
    ax.set_xticks(range(len(rows)))
    ax.set_xticklabels([label(row) for row in rows], rotation=rotation, ha="right")


def soften_axes(ax):
    ax.grid(False, which="both", axis="both")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def save(fig, path):
    fig.tight_layout()
    fig.savefig(path, dpi=180)
    plt.close(fig)


def plot_runtime(rows):
    x = list(range(len(rows)))
    baseline = [row["baseline_ms"] if row["baseline_ms"] >= 0 else None for row in rows]
    efficient = [max(row["efficient_ms"], 0.001) for row in rows]

    fig, ax = plt.subplots(figsize=(14, 6.8))
    width = 0.36
    ax.bar(
        [i - width / 2 for i in x],
        [v if v is not None else 0 for v in baseline],
        width,
        label="基准算法：删边 + BFS",
        color=PALETTE["baseline"],
        alpha=0.9,
    )
    ax.bar(
        [i + width / 2 for i in x],
        efficient,
        width,
        label="优化算法：生成森林 + 并查集",
        color=PALETTE["efficient"],
        alpha=0.92,
    )

    for i, value in enumerate(baseline):
        if value is None:
            ax.text(i - width / 2, 0.9, "跳过", rotation=90, ha="center",
                    va="bottom", fontsize=8, color=PALETTE["muted"])

    ax.set_yscale("log")
    ax.set_ylabel("运行时间（毫秒，对数刻度）")
    ax.set_title("桥算法运行时间对比")
    set_case_ticks(ax, rows)
    soften_axes(ax)
    ax.legend(loc="upper left")
    save(fig, FIG_RUNTIME)


def plot_speedup(rows):
    measured = measured_baseline(rows)
    fig, ax = plt.subplots(figsize=(11, 5.8))
    values = [row["speedup"] for row in measured]
    bars = ax.bar(range(len(measured)), values, color=PALETTE["warm"], alpha=0.92)
    ax.axhline(1, color=PALETTE["muted"], linewidth=1, linestyle="--", label="1x 基准线")
    ax.set_ylabel("加速比（基准耗时 / 优化耗时）")
    ax.set_title("优化算法相对基准算法的实测加速比")
    ax.set_xticks(range(len(measured)))
    ax.set_xticklabels([label(row) for row in measured], rotation=28, ha="right")
    soften_axes(ax)
    for bar, value in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(),
                f"{value:.1f}x", ha="center", va="bottom", fontsize=8)
    ax.legend(loc="upper left")
    save(fig, FIG_SPEEDUP)


def plot_scalability(rows):
    fig, ax = plt.subplots(figsize=(11.5, 6.2))
    families = sorted(set(row["family"] for row in rows))
    colors = plt.get_cmap("tab10")
    for idx, family in enumerate(families):
        group = [row for row in rows if row["family"] == family]
        ax.scatter(
            [row["edges"] for row in group],
            [max(row["efficient_ms"], 0.001) for row in group],
            s=[max(46, min(240, math.sqrt(row["vertices"]) * 4)) for row in group],
            label=FAMILY_LABELS.get(family, family),
            color=colors(idx % 10),
            alpha=0.86,
            edgecolors="white",
            linewidth=0.8,
        )
        for row in group:
            if row["case"] in {"largeG_file", "random_large_20000", "mediumG_file"}:
                ax.annotate(row["case"], (row["edges"], max(row["efficient_ms"], 0.001)),
                            textcoords="offset points", xytext=(7, 5), fontsize=8)

    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlabel("边数 E（对数刻度）")
    ax.set_ylabel("优化算法运行时间（毫秒，对数刻度）")
    ax.set_title("优化算法可扩展性：边数增长下的实测耗时")
    soften_axes(ax)
    ax.legend(title="图类型", fontsize=8, ncols=2, loc="upper left")
    save(fig, FIG_SCALABILITY)


def plot_structure(rows):
    x = list(range(len(rows)))
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8.4), sharex=True)
    ax1.bar(x, [row["bridge_ratio"] * 100 for row in rows], color=PALETTE["green"], alpha=0.92)
    ax1.set_ylabel("桥占比（%）")
    ax1.set_title("图结构指标：桥占比")
    soften_axes(ax1)

    ax2.bar(x, [row["avg_degree"] for row in rows], color=PALETTE["efficient"], label="平均度", alpha=0.92)
    ax2_twin = ax2.twinx()
    ax2_twin.plot(
        x,
        [row["density"] * 100 for row in rows],
        color=PALETTE["rose"],
        marker="o",
        linewidth=2,
        label="密度（%）",
    )
    ax2.set_ylabel("平均度")
    ax2_twin.set_ylabel("密度（%）")
    ax2.set_title("图结构指标：平均度与密度")
    soften_axes(ax2)
    ax2_twin.spines["top"].set_visible(False)
    set_case_ticks(ax2, rows)

    handles1, labels1 = ax2.get_legend_handles_labels()
    handles2, labels2 = ax2_twin.get_legend_handles_labels()
    ax2.legend(handles1 + handles2, labels1 + labels2, loc="upper left")
    save(fig, FIG_STRUCTURE)


def plot_work(rows):
    fig, ax = plt.subplots(figsize=(12, 6.2))
    x = list(range(len(rows)))
    work = [max(row["baseline_work_estimate"], 1) for row in rows]
    colors = [PALETTE["baseline"] if row["baseline_ms"] >= 0 else "#a8a29e" for row in rows]
    ax.bar(x, work, color=colors, alpha=0.9, label="基准算法理论工作量")
    ax.set_yscale("log")
    ax.set_ylabel("E × (V + E)（对数刻度）")
    ax.set_title("基准算法重复遍历工作量估计")
    set_case_ticks(ax, rows)
    soften_axes(ax)
    for i, row in enumerate(rows):
        if row["baseline_ms"] < 0:
            ax.text(i, work[i], "跳过", rotation=90, ha="center", va="bottom",
                    fontsize=8, color="#4b5563")
    ax.legend(loc="upper left")
    save(fig, FIG_WORK)


def normalize(values):
    positive = [value for value in values if value is not None and value > 0]
    if not positive:
        return [0 for _ in values]
    max_value = max(positive)
    return [value / max_value if value is not None and value > 0 else math.nan for value in values]


def plot_complexity_column(ax_theory, ax_actual, rows, x_key, x_label, title):
    ordered = sorted(rows, key=lambda row: row[x_key])
    x = [row[x_key] for row in ordered]

    ax_theory.plot(
        x,
        [row["baseline_work_estimate"] for row in ordered],
        marker="o",
        linewidth=2.2,
        color=PALETTE["baseline"],
        label="基准算法理论 O(E×(V+E))",
    )
    ax_theory.plot(
        x,
        [row["efficient_work_estimate"] for row in ordered],
        marker="o",
        linewidth=2.2,
        color=PALETTE["efficient"],
        label="优化算法理论 O(V+E)",
    )
    ax_theory.set_yscale("log")
    ax_theory.set_title(title)
    ax_theory.set_ylabel("理论工作量（对数）")
    soften_axes(ax_theory)
    ax_theory.legend(loc="upper left", fontsize=8)

    ax_actual.plot(
        x,
        [row["baseline_ms"] for row in ordered],
        marker="s",
        linewidth=2.2,
        color=PALETTE["baseline"],
        label="基准算法实测耗时",
    )
    ax_actual.plot(
        x,
        [row["efficient_ms"] for row in ordered],
        marker="s",
        linewidth=2.2,
        color=PALETTE["efficient"],
        label="优化算法实测耗时",
    )
    ax_actual.set_yscale("log")
    ax_actual.set_xlabel(x_label)
    ax_actual.set_ylabel("实测耗时 ms（对数）")
    soften_axes(ax_actual)
    ax_actual.legend(loc="upper left", fontsize=8)


def plot_complexity_figure(rows, x_key, x_label, theory_title, figure_title, path):
    if not rows:
        return
    fig, axes = plt.subplots(2, 1, figsize=(10.5, 8.2), sharex=True)
    plot_complexity_column(
        axes[0],
        axes[1],
        rows,
        x_key,
        x_label,
        theory_title,
    )
    fig.suptitle(figure_title, fontsize=17, fontweight="bold")
    save(fig, path)


def plot_theory_actual(complexity_rows):
    edge_rows = [row for row in complexity_rows if row["experiment"] == "edge_growth"]
    bridge_rows = [row for row in complexity_rows if row["experiment"] == "bridge_growth"]
    plot_complexity_figure(
        edge_rows,
        "edges",
        "边数 E（固定 V=800，随机树逐步增加随机边）",
        "边数递增：理论复杂度对比",
        "a) 边数递增实验：理论复杂度与真实耗时",
        FIG_EDGE_GROWTH,
    )
    plot_complexity_figure(
        bridge_rows,
        "bridges",
        "桥数 B（随机环核心逐步挂接叶子边）",
        "桥数递增：理论复杂度对比",
        "b) 桥数递增实验：理论复杂度与真实耗时",
        FIG_BRIDGE_GROWTH,
    )


def fmt_ms(value):
    return "跳过" if value < 0 else f"{value:.3f}"


def fmt_speedup(value):
    return "-" if value < 0 else f"{value:.2f}x"


def write_markdown(rows, complexity_rows):
    measured = measured_baseline(rows)
    fastest = max(measured, key=lambda row: row["speedup"]) if measured else None
    largest = max(rows, key=lambda row: row["edges"])
    highest_bridge_ratio = max(rows, key=lambda row: row["bridge_ratio"])
    highest_throughput = max(rows, key=lambda row: row["efficient_edges_per_ms"])
    two_cliques = next((row for row in rows if row["case"] == "two_cliques_80"), None)
    edge_rows = sorted([row for row in complexity_rows if row["experiment"] == "edge_growth"], key=lambda row: row["edges"])
    bridge_rows = sorted([row for row in complexity_rows if row["experiment"] == "bridge_growth"], key=lambda row: row["bridges"])

    lines = [
        "# 桥算法多角度性能实验分析",
        "",
        "由 `benchmark_runner.cpp` 运行实验，并由 `analysis/plot_bridge_results.py` 生成图表。",
        "",
        "## 实验目的",
        "",
        "1. 掌握图的连通性。",
        "2. 掌握并查集的基本原理和应用。",
        "",
        "## 图表",
        "",
        f"![运行时间对比]({FIG_RUNTIME.name})",
        "",
        f"![加速比]({FIG_SPEEDUP.name})",
        "",
        f"![可扩展性]({FIG_SCALABILITY.name})",
        "",
        f"![图结构指标]({FIG_STRUCTURE.name})",
        "",
        f"![基准算法理论工作量]({FIG_WORK.name})",
        "",
        f"![a) 边数递增实验]({FIG_EDGE_GROWTH.name})",
        "",
        f"![b) 桥数递增实验]({FIG_BRIDGE_GROWTH.name})",
        "",
        "## 实验结果表",
        "",
        "| 用例 | 类型 | V | E | 连通分量 | 平均度 | 密度 | 基准 ms | 优化 ms | 桥数 | 桥占比 | 加速比 | 优化吞吐 edges/ms | 状态 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]

    for row in rows:
        lines.append(
            f"| {row['case']} | {family_label(row)} | {row['vertices']} | {row['edges']} | "
            f"{row['components']} | {row['avg_degree']:.2f} | {row['density']:.6f} | "
            f"{fmt_ms(row['baseline_ms'])} | {row['efficient_ms']:.3f} | "
            f"{row['efficient_bridges']} | {row['bridge_ratio'] * 100:.2f}% | "
            f"{fmt_speedup(row['speedup'])} | {row['efficient_edges_per_ms']:.2f} | "
            f"{row['status']} |"
        )

    lines.extend([
        "",
        "## 多角度结论",
        "",
        "### 1. 理论复杂度与真实耗时角度",
        "",
        "- 理论/实测对比图改为使用专门生成的随机图，不再混用不同类型样例编号作为横坐标。",
        "- 第一组固定 `V=800`，逐步增加随机边数，横坐标为边数 `E`；第二组使用随机环核心挂接叶子边，横坐标为桥数 `B`。",
        "- 基准算法理论曲线由 `E × (V + E)` 决定，随边数增长明显加速；优化算法理论曲线用 `V + E` 近似，增长更平缓。",
        "",
        "### 2. 实测耗时角度",
        "",
    ])

    if fastest:
        lines.append(
            f"- 同时运行两种算法的样例中，最大加速比出现在 `{fastest['case']}`，约 `{fastest['speedup']:.2f}x`。"
        )
    lines.append(
        f"- 最大图 `{largest['case']}`：`V={largest['vertices']}`，`E={largest['edges']}`，优化算法耗时 `{largest['efficient_ms']:.3f} ms`，桥数 `{largest['efficient_bridges']}`。"
    )
    if two_cliques:
        lines.append(
            f"- `two_cliques_80` 原先因为理论工作量 `{two_cliques['baseline_work_estimate']:.0f}` 超过旧阈值被跳过；本次已实测基准算法，耗时 `{two_cliques['baseline_ms']:.3f} ms`，优化算法耗时 `{two_cliques['efficient_ms']:.3f} ms`。"
        )
    lines.extend([
        "",
        "### 2.1 随机复杂度递增实验",
        "",
        "| 实验 | 横坐标 | V | E | 桥数 | 基准 ms | 优化 ms | 加速比 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ])

    for row in edge_rows:
        lines.append(
            f"| 边数递增 | {row['edges']} | {row['vertices']} | {row['edges']} | {row['bridges']} | "
            f"{row['baseline_ms']:.3f} | {row['efficient_ms']:.6f} | {row['speedup']:.2f}x |"
        )
    for row in bridge_rows:
        lines.append(
            f"| 桥数递增 | {row['bridges']} | {row['vertices']} | {row['edges']} | {row['bridges']} | "
            f"{row['baseline_ms']:.3f} | {row['efficient_ms']:.6f} | {row['speedup']:.2f}x |"
        )
    lines.extend([
        "",
        "### 3. 图结构角度",
        "",
        f"- 桥占比最高的是 `{highest_bridge_ratio['case']}`，桥占比约 `{highest_bridge_ratio['bridge_ratio'] * 100:.2f}%`。",
        "- 路径图、星形图这类树结构几乎所有边都是桥；环图、随机较密图中桥占比明显下降。",
        "- 密度和平均度越高，边更容易出现在环中，桥数量通常会减少。",
        "",
        "### 4. 大图可行性角度",
        "",
        "- `baseline_skipped` 并不是缺失结果，而是实验设计上的必要处理：基准算法需要对每条边重复做全图遍历，大图上等待成本没有意义。",
        "- 对大图保留优化算法结果，并用理论工作量图解释基准算法为什么跳过，更适合实验报告。",
        "",
        "### 5. 吞吐角度",
        "",
        f"- 优化算法最高吞吐出现在 `{highest_throughput['case']}`，约 `{highest_throughput['efficient_edges_per_ms']:.2f} edges/ms`。",
        "- 小图耗时受计时粒度影响较大，所以吞吐指标更适合观察中大规模样例。",
        "",
        "## 实验说明",
        "",
        "- 本实验没有修改桥查找算法实现，只扩展了实验 runner 和绘图分析脚本。",
        "- 优化算法耗时采用按规模自适应重复运行后的平均值；基准算法耗时为单次运行结果。",
        "- 基准算法只在理论工作量可控的样例上运行；大图记录为 `baseline_skipped`。",
        "- 在同时运行两种算法的样例中，若桥数量不一致，状态会标记为 `bridge_count_mismatch`。",
    ])

    MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    configure_style()
    rows = read_rows()
    complexity_rows = read_complexity_rows()
    plot_runtime(rows)
    plot_speedup(rows)
    plot_scalability(rows)
    plot_structure(rows)
    plot_work(rows)
    plot_theory_actual(complexity_rows)
    write_markdown(rows, complexity_rows)
    for path in [
        FIG_RUNTIME,
        FIG_SPEEDUP,
        FIG_SCALABILITY,
        FIG_STRUCTURE,
        FIG_WORK,
        FIG_EDGE_GROWTH,
        FIG_BRIDGE_GROWTH,
        MD_PATH,
    ]:
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
