from pathlib import Path
import csv

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "bridge_benchmark_results.csv"
FIG_RUNTIME = ROOT / "medium_large_runtime_focus.png"
FIG_WORK = ROOT / "medium_large_work_focus.png"

PALETTE = {
    "baseline": "#d95f59",
    "efficient": "#0b4f6c",
    "green": "#1c7c54",
    "muted": "#6b7280",
    "paper": "#fbf8f3",
    "panel": "#fffdf8",
    "edge": "#cfc7b8",
    "ink": "#1d2433",
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
        "figure.facecolor": PALETTE["paper"],
        "axes.facecolor": PALETTE["panel"],
        "axes.edgecolor": PALETTE["edge"],
        "axes.labelcolor": PALETTE["ink"],
        "xtick.color": PALETTE["ink"],
        "ytick.color": PALETTE["ink"],
        "text.color": PALETTE["ink"],
        "legend.frameon": True,
        "legend.facecolor": "#fffaf1",
        "legend.edgecolor": "#ddd3c2",
    })


def read_rows():
    rows = {}
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["case"] in {"mediumG_file", "largeG_file"}:
                rows[row["case"]] = row

    for row in rows.values():
        for key in ["vertices", "edges", "baseline_work_estimate"]:
            row[key] = int(float(row[key]))
        for key in ["baseline_ms", "efficient_ms", "speedup", "efficient_edges_per_ms"]:
            row[key] = float(row[key])
    return rows


def soften_axes(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


def plot_runtime(rows):
    labels = ["mediumG", "largeG"]
    order = ["mediumG_file", "largeG_file"]
    x = list(range(len(order)))
    width = 0.32

    baseline_vals = [
        max(rows[key]["baseline_ms"], 0.001) if rows[key]["baseline_ms"] >= 0 else 0
        for key in order
    ]
    efficient_vals = [rows[key]["efficient_ms"] for key in order]

    fig, ax = plt.subplots(figsize=(9.5, 5.4))
    ax.bar(
        [i - width / 2 for i in x],
        baseline_vals,
        width,
        label="基准算法：删边 + BFS",
        color=PALETTE["baseline"],
        alpha=0.9,
    )
    ax.bar(
        [i + width / 2 for i in x],
        efficient_vals,
        width,
        label="高效算法：生成森林 + 并查集",
        color=PALETTE["efficient"],
        alpha=0.92,
    )
    ax.text(
        1 - width / 2,
        0.0016,
        "跳过\n(工作量过大)",
        ha="center",
        va="bottom",
        fontsize=10,
        color=PALETTE["muted"],
    )
    ax.set_yscale("log")
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("运行时间 ms（对数刻度）")
    ax.set_title("给定图文件上的桥检测耗时对比", fontsize=15, fontweight="bold")
    ax.legend(loc="upper left")
    soften_axes(ax)
    fig.tight_layout()
    fig.savefig(FIG_RUNTIME, dpi=180)
    plt.close(fig)


def plot_work(rows):
    labels = ["mediumG", "largeG"]
    order = ["mediumG_file", "largeG_file"]
    x = list(range(len(order)))
    width = 0.32

    baseline_work = [rows[key]["baseline_work_estimate"] for key in order]
    efficient_work = [rows[key]["vertices"] + rows[key]["edges"] for key in order]

    fig, ax = plt.subplots(figsize=(9.5, 5.4))
    ax.bar(
        [i - width / 2 for i in x],
        baseline_work,
        width,
        label="基准算法估计工作量 E×(V+E)",
        color=PALETTE["baseline"],
        alpha=0.9,
    )
    ax.bar(
        [i + width / 2 for i in x],
        efficient_work,
        width,
        label="高效算法近似工作量 V+E",
        color=PALETTE["green"],
        alpha=0.9,
    )
    ax.set_yscale("log")
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("理论工作量（对数刻度）")
    ax.set_title("给定图文件上的理论工作量差异", fontsize=15, fontweight="bold")
    ax.legend(loc="upper left")
    soften_axes(ax)
    fig.tight_layout()
    fig.savefig(FIG_WORK, dpi=180)
    plt.close(fig)


def main():
    configure_style()
    rows = read_rows()
    plot_runtime(rows)
    plot_work(rows)
    print(f"wrote {FIG_RUNTIME}")
    print(f"wrote {FIG_WORK}")


if __name__ == "__main__":
    main()
