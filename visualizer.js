const samples = {
  "cycle-tail": {
    text: "7 8\n0 1\n1 2\n2 0\n2 3\n3 4\n4 5\n5 3\n5 6",
    layout: {
      0: [150, 175], 1: [285, 95], 2: [300, 245], 3: [430, 245],
      4: [555, 150], 5: [555, 330], 6: [690, 330],
    },
  },
  "two-blocks": {
    text: "8 9\n0 1\n1 2\n2 3\n3 0\n2 4\n4 5\n5 6\n6 7\n7 4",
    layout: {
      0: [130, 150], 1: [245, 110], 2: [275, 250], 3: [145, 300],
      4: [450, 250], 5: [530, 130], 6: [660, 175], 7: [650, 330],
    },
  },
  forest: {
    text: "9 7\n0 1\n1 2\n2 3\n4 5\n5 6\n6 4\n7 8",
    layout: {
      0: [110, 150], 1: [230, 150], 2: [350, 150], 3: [470, 150],
      4: [165, 350], 5: [310, 285], 6: [330, 420], 7: [540, 350], 8: [670, 350],
    },
  },
  "dense-core": {
    text: "10 13\n0 1\n1 2\n2 0\n1 3\n3 4\n4 1\n2 5\n5 6\n6 2\n6 7\n7 8\n8 9\n9 7",
    layout: {
      0: [120, 245], 1: [245, 155], 2: [260, 330], 3: [395, 105], 4: [430, 230],
      5: [400, 380], 6: [535, 330], 7: [650, 250], 8: [690, 390], 9: [575, 430],
    },
  },
};

const pseudo = {
  benchmark: [
    "1. original = countComponents(G)",
    "2. for each edge (u, v):",
    "3.   temporarily remove (u, v)",
    "4.   now = countComponents(G)",
    "5.   if now > original: mark bridge",
    "6.   restore (u, v)",
  ],
  efficient: [
    "1. DFS builds a spanning forest",
    "2. classify edges as tree / non-tree",
    "3. every tree edge starts as a candidate bridge",
    "4. for each non-tree edge (u, v):",
    "5.   find compressed representatives",
    "6.   climb deeper side and union with parent",
    "7.   marked tree edges are not bridges",
    "8. remaining candidates are bridges",
  ],
};

const state = {
  graph: null,
  positions: {},
  algorithm: "efficient",
  events: [],
  index: 0,
  timer: null,
  speed: 1.5,
};

const el = {
  sampleSelect: document.querySelector("#sampleSelect"),
  graphInput: document.querySelector("#graphInput"),
  loadInputBtn: document.querySelector("#loadInputBtn"),
  randomNodeCount: document.querySelector("#randomNodeCount"),
  randomDensity: document.querySelector("#randomDensity"),
  randomDensityLabel: document.querySelector("#randomDensityLabel"),
  randomBtn: document.querySelector("#randomBtn"),
  benchmarkBtn: document.querySelector("#benchmarkBtn"),
  efficientBtn: document.querySelector("#efficientBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  prevBtn: document.querySelector("#prevBtn"),
  playBtn: document.querySelector("#playBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  speedRange: document.querySelector("#speedRange"),
  vertexCount: document.querySelector("#vertexCount"),
  edgeCount: document.querySelector("#edgeCount"),
  bridgeCount: document.querySelector("#bridgeCount"),
  stepCount: document.querySelector("#stepCount"),
  algorithmTitle: document.querySelector("#algorithmTitle"),
  stepBadge: document.querySelector("#stepBadge"),
  progressFill: document.querySelector("#progressFill"),
  graphSvg: document.querySelector("#graphSvg"),
  eventTitle: document.querySelector("#eventTitle"),
  eventDetail: document.querySelector("#eventDetail"),
  dsuState: document.querySelector("#dsuState"),
  timelineRange: document.querySelector("#timelineRange"),
  timeline: document.querySelector("#timeline"),
  pseudoCode: document.querySelector("#pseudoCode"),
  eventLog: document.querySelector("#eventLog"),
};

function edgeKey(u, v) {
  return u < v ? `${u}-${v}` : `${v}-${u}`;
}

function parseGraph(text) {
  const values = text.trim().split(/\s+/).map(Number).filter((value) => Number.isFinite(value));
  if (values.length < 2) throw new Error("请输入顶点数、边数和边列表。");
  const [vRaw, eRaw] = values;
  if (!Number.isInteger(vRaw) || vRaw < 1) throw new Error("第一行需要包含有效顶点数。");
  const seen = new Set();
  const edges = [];
  for (let i = 2; i + 1 < values.length; i += 2) {
    const a = values[i];
    const b = values[i + 1];
    if (!Number.isInteger(a) || !Number.isInteger(b)) continue;
    if (a === b || a < 0 || b < 0 || a >= vRaw || b >= vRaw) continue;
    const key = edgeKey(a, b);
    if (!seen.has(key)) {
      seen.add(key);
      edges.push(a < b ? [a, b] : [b, a]);
    }
  }
  if (Number.isInteger(eRaw) && eRaw !== edges.length) {
    console.info(`Declared ${eRaw} edges, parsed ${edges.length} after filtering.`);
  }
  const adj = Array.from({ length: vRaw }, () => []);
  edges.forEach(([u, v]) => {
    adj[u].push(v);
    adj[v].push(u);
  });
  adj.forEach((list) => list.sort((a, b) => a - b));
  return { V: vRaw, edges, adj };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeRandomGraph(vertexCount, density) {
  const V = clamp(Math.round(vertexCount), 4, 18);
  const normalizedDensity = clamp(density, 0.08, 0.55);
  const maxEdges = (V * (V - 1)) / 2;
  const targetEdges = clamp(
    Math.round((V - 1) + normalizedDensity * (maxEdges - (V - 1))),
    V - 1,
    maxEdges,
  );
  const seen = new Set();
  const edges = [];
  const layout = {};
  const centerX = 380;
  const centerY = 260;
  const radius = Math.min(225, 95 + V * 9);

  function addEdge(u, v) {
    if (u === v) return false;
    const key = edgeKey(u, v);
    if (seen.has(key)) return false;
    seen.add(key);
    edges.push(u < v ? [u, v] : [v, u]);
    return true;
  }

  for (let i = 0; i < V; i += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / V;
    const jitter = 0.88 + Math.random() * 0.18;
    layout[i] = [
      centerX + radius * jitter * Math.cos(angle),
      centerY + radius * jitter * Math.sin(angle),
    ];
  }

  for (let i = 1; i < V; i += 1) {
    const parent = Math.floor(Math.random() * i);
    addEdge(i, parent);
  }

  let guard = 0;
  while (edges.length < targetEdges && guard < maxEdges * 8) {
    guard += 1;
    addEdge(Math.floor(Math.random() * V), Math.floor(Math.random() * V));
  }

  edges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const text = [`${V} ${edges.length}`, ...edges.map(([u, v]) => `${u} ${v}`)].join("\n");
  return { text, layout };
}

function defaultLayout(graph) {
  const centerX = 380;
  const centerY = 260;
  const radius = Math.min(220, 80 + graph.V * 12);
  const positions = {};
  for (let i = 0; i < graph.V; i += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / graph.V;
    positions[i] = [
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
    ];
  }
  return positions;
}

function countComponents(graph, skippedKey = null) {
  const visited = Array(graph.V).fill(false);
  let count = 0;
  for (let start = 0; start < graph.V; start += 1) {
    if (visited[start]) continue;
    count += 1;
    const queue = [start];
    visited[start] = true;
    for (let qi = 0; qi < queue.length; qi += 1) {
      const u = queue[qi];
      for (const v of graph.adj[u]) {
        if (skippedKey === edgeKey(u, v)) continue;
        if (!visited[v]) {
          visited[v] = true;
          queue.push(v);
        }
      }
    }
  }
  return count;
}

function makeSnapshot({ title, detail, phase, edgeClass = {}, activeEdges = [], activeNodes = [], dsu = null, hot = 0 }) {
  const active = new Set(activeEdges.map(([u, v]) => edgeKey(u, v)));
  const mergedClasses = { ...edgeClass };
  for (const key of active) mergedClasses[key] = `${mergedClasses[key] || ""} active`.trim();
  return {
    title,
    detail,
    phase,
    edgeClass: mergedClasses,
    activeNodes,
    dsu,
    hot,
  };
}

function generateBenchmarkEvents(graph) {
  const original = countComponents(graph);
  const events = [
    makeSnapshot({
      title: "计算原图连通分量",
      detail: `原图共有 ${original} 个连通分量。基准算法会逐条删边，再用 BFS 重新计数。`,
      phase: "init",
      hot: 0,
    }),
  ];
  const finalClasses = {};
  for (const [u, v] of graph.edges) {
    const key = edgeKey(u, v);
    events.push(makeSnapshot({
      title: `临时删除边 ${u}-${v}`,
      detail: "从邻接表两端移除这条边，随后重新 BFS 统计连通分量。",
      phase: "remove",
      edgeClass: { ...finalClasses },
      activeEdges: [[u, v]],
      activeNodes: [u, v],
      hot: 2,
    }));
    const next = countComponents(graph, key);
    const isBridge = next > original;
    finalClasses[key] = isBridge ? "bridge" : "rejected";
    events.push(makeSnapshot({
      title: isBridge ? `${u}-${v} 是桥` : `${u}-${v} 不是桥`,
      detail: isBridge
        ? `删边后连通分量从 ${original} 增加到 ${next}，说明 ${u}-${v} 是桥。`
        : `删边后连通分量仍为 ${next}，两端仍可绕路连通，标记为非桥。`,
      phase: isBridge ? "bridge" : "not-bridge",
      edgeClass: { ...finalClasses },
      activeEdges: [[u, v]],
      activeNodes: [u, v],
      hot: isBridge ? 4 : 5,
    }));
  }
  events.push(makeSnapshot({
    title: "基准算法完成",
    detail: "绿色边为最终桥；红色边代表删去后仍可连通的非桥。",
    phase: "done",
    edgeClass: finalClasses,
    hot: 5,
  }));
  return events;
}

function makeDsu(n) {
  return {
    parent: Array.from({ length: n }, (_, i) => i),
    find(x, notes = []) {
      let root = x;
      while (this.parent[root] !== root) root = this.parent[root];
      while (x !== root) {
        const next = this.parent[x];
        if (this.parent[x] !== root) notes.push(`${x}->${root}`);
        this.parent[x] = root;
        x = next;
      }
      return root;
    },
    unite(x, y) {
      const rx = this.find(x);
      const ry = this.find(y);
      if (rx !== ry) this.parent[rx] = ry;
    },
    clone() {
      return [...this.parent];
    },
  };
}

function buildSpanningForest(graph) {
  const visited = Array(graph.V).fill(false);
  const parent = Array(graph.V).fill(-1);
  const depth = Array(graph.V).fill(0);
  const treeEdges = [];
  const nonTreeEdges = [];
  const events = [];
  const edgeClass = {};
  for (let start = 0; start < graph.V; start += 1) {
    if (visited[start]) continue;
    visited[start] = true;
    events.push({ kind: "root", node: start, edgeClass: { ...edgeClass } });
    const stack = [start];
    while (stack.length) {
      const u = stack.pop();
      for (const v of graph.adj[u]) {
        if (v === parent[u]) continue;
        const key = edgeKey(u, v);
        if (!visited[v]) {
          visited[v] = true;
          parent[v] = u;
          depth[v] = depth[u] + 1;
          edgeClass[key] = "tree";
          treeEdges.push([u, v]);
          events.push({ kind: "tree", edge: [u, v], edgeClass: { ...edgeClass } });
          stack.push(v);
        } else if (u < v && parent[u] !== v) {
          if (!edgeClass[key]) {
            edgeClass[key] = "non-tree";
            nonTreeEdges.push([u, v]);
            events.push({ kind: "non-tree", edge: [u, v], edgeClass: { ...edgeClass } });
          }
        }
      }
    }
  }
  return { parent, depth, treeEdges, nonTreeEdges, events, edgeClass };
}

function generateEfficientEvents(graph) {
  const forest = buildSpanningForest(graph);
  const events = [];
  const roots = new Set();
  const baseClasses = {};
  for (const item of forest.events) {
    if (item.kind === "root") {
      roots.add(item.node);
      events.push(makeSnapshot({
        title: `从顶点 ${item.node} 开始新生成树`,
        detail: "未访问顶点成为当前连通分量的根。根没有父边，因此不会作为桥候选。",
        phase: "root",
        edgeClass: item.edgeClass,
        activeNodes: [item.node],
        hot: 0,
      }));
    } else if (item.kind === "tree") {
      const [u, v] = item.edge;
      events.push(makeSnapshot({
        title: `发现生成树边 ${u}-${v}`,
        detail: `顶点 ${v} 首次被访问，记录 parent[${v}] = ${u}。树边先进入"可能是桥"的候选集合。`,
        phase: "tree",
        edgeClass: item.edgeClass,
        activeEdges: [[u, v]],
        activeNodes: [u, v],
        hot: 0,
      }));
    } else {
      const [u, v] = item.edge;
      events.push(makeSnapshot({
        title: `发现非树边 ${u}-${v}`,
        detail: "非树边闭合出一个基本环，环上的树边都不可能是桥，稍后用并查集压缩这段路径。",
        phase: "non-tree",
        edgeClass: item.edgeClass,
        activeEdges: [[u, v]],
        activeNodes: [u, v],
        hot: 1,
      }));
    }
  }
  Object.assign(baseClasses, forest.edgeClass);
  const dsu = makeDsu(graph.V);
  const isBridge = Array(graph.V).fill(true);
  for (let i = 0; i < graph.V; i += 1) {
    if (forest.parent[i] === -1) isBridge[i] = false;
  }
  const markedClasses = { ...baseClasses };
  events.push(makeSnapshot({
    title: "初始化候选桥",
    detail: "所有生成树边先暂定为桥；后续每条非树边会把所属环上的树边改为非桥。",
    phase: "candidate",
    edgeClass: markedClasses,
    dsu: dsu.clone(),
    hot: 2,
  }));

  for (const [u, v] of forest.nonTreeEdges) {
    const notes = [];
    let ru = dsu.find(u, notes);
    let rv = dsu.find(v, notes);
    events.push(makeSnapshot({
      title: `处理非树边 ${u}-${v}`,
      detail: notes.length
        ? `find(${u}) 与 find(${v}) 触发路径压缩：${notes.join(", ")}。`
        : `find(${u}) = ${ru}，find(${v}) = ${rv}，准备向最近公共祖先方向收缩。`,
      phase: "compress",
      edgeClass: markedClasses,
      activeEdges: [[u, v]],
      activeNodes: [u, v, ru, rv],
      dsu: dsu.clone(),
      hot: 4,
    }));
    while (ru !== rv) {
      if (forest.depth[ru] < forest.depth[rv]) {
        const temp = ru;
        ru = rv;
        rv = temp;
      }
      const p = forest.parent[ru];
      if (p === -1) break;
      isBridge[ru] = false;
      markedClasses[edgeKey(ru, p)] = "rejected";
      events.push(makeSnapshot({
        title: `标记 ${p}-${ru} 为非桥`,
        detail: `非树边 ${u}-${v} 形成的环覆盖父边 ${p}-${ru}，删掉它仍能绕环连通。`,
        phase: "mark",
        edgeClass: { ...markedClasses },
        activeEdges: [[p, ru], [u, v]],
        activeNodes: [p, ru, u, v],
        dsu: dsu.clone(),
        hot: 5,
      }));
      dsu.unite(ru, p);
      events.push(makeSnapshot({
        title: `合并 ${ru} 到父节点 ${p}`,
        detail: `union(${ru}, ${p}) 后，这段已处理路径会被压缩，下一次遇到环可以跳过它。`,
        phase: "union",
        edgeClass: { ...markedClasses },
        activeEdges: [[p, ru]],
        activeNodes: [p, ru],
        dsu: dsu.clone(),
        hot: 5,
      }));
      ru = dsu.find(p);
      rv = dsu.find(rv);
    }
  }

  const finalClasses = { ...markedClasses };
  for (let i = 0; i < graph.V; i += 1) {
    if (isBridge[i] && forest.parent[i] !== -1) {
      finalClasses[edgeKey(i, forest.parent[i])] = "bridge";
    }
  }
  events.push(makeSnapshot({
    title: "优化算法完成",
    detail: "没有被任何非树边环覆盖的生成树边，就是最终桥。",
    phase: "done",
    edgeClass: finalClasses,
    dsu: dsu.clone(),
    hot: 7,
  }));
  return events;
}

function renderGraph(event) {
  const svg = el.graphSvg;
  svg.innerHTML = "";
  const graph = state.graph;
  const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.append(edgeLayer, nodeLayer);
  for (const [u, v] of graph.edges) {
    const [x1, y1] = state.positions[u];
    const [x2, y2] = state.positions[v];
    const key = edgeKey(u, v);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", `edge-line ${event.edgeClass[key] || ""}`);
    edgeLayer.append(line);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (x1 + x2) / 2);
    label.setAttribute("y", (y1 + y2) / 2 - 7);
    label.setAttribute("class", "edge-label");
    label.textContent = `${u}-${v}`;
    edgeLayer.append(label);
  }
  const activeNodes = new Set(event.activeNodes || []);
  for (let i = 0; i < graph.V; i += 1) {
    const [x, y] = state.positions[i];
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 20);
    circle.setAttribute("class", `node-circle ${activeNodes.has(i) ? "active" : ""}`);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y + 5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "node-text");
    text.textContent = i;
    group.append(circle, text);
    nodeLayer.append(group);
  }
}

function renderDsu(parent) {
  el.dsuState.innerHTML = "";
  if (!parent) {
    el.dsuState.innerHTML = "<p class=\"event-detail\">基准算法不使用并查集。</p>";
    return;
  }
  parent.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "dsu-pill";
    row.innerHTML = `<span>parent[${i}]</span><strong>${p}</strong>`;
    el.dsuState.append(row);
  });
}

function renderPseudo(hot) {
  const lines = pseudo[state.algorithm];
  el.pseudoCode.innerHTML = lines.map((line, i) => {
    const safe = line.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    return `<div class="pseudo-line ${i === hot ? "hot" : ""}">${safe}</div>`;
  }).join("");
}

function renderTimeline() {
  el.timeline.innerHTML = "";
  state.events.forEach((event, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index}. ${event.title}`;
    button.className = index === state.index ? "current" : "";
    button.addEventListener("click", () => {
      pause();
      state.index = index;
      render();
    });
    el.timeline.append(button);
  });
  el.timelineRange.max = String(Math.max(0, state.events.length - 1));
  el.timelineRange.value = String(state.index);
}

function previousDsuBefore(index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (state.events[i]?.dsu) return state.events[i].dsu;
  }
  return null;
}

function buildDsuForestLayout(parent) {
  const n = parent.length;
  const children = Array.from({ length: n }, () => []);
  const roots = [];
  parent.forEach((p, node) => {
    if (p === node || p < 0 || p >= n) {
      roots.push(node);
    } else {
      children[p].push(node);
    }
  });
  children.forEach((list) => list.sort((a, b) => a - b));
  roots.sort((a, b) => a - b);

  const nodeGap = 76;
  const levelGap = 104;
  const rootGap = 88;
  const marginX = 58;
  const top = 70;
  const widths = new Map();
  const positions = new Map();
  let maxDepth = 0;

  function measure(node) {
    const childWidths = children[node].map(measure);
    const total = childWidths.reduce((sum, width) => sum + width, 0);
    const width = Math.max(nodeGap, total);
    widths.set(node, width);
    return width;
  }

  function place(node, left, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const width = widths.get(node) || nodeGap;
    const kids = children[node];
    let x = left + width / 2;
    if (kids.length) {
      const childTotal = kids.reduce((sum, child) => sum + (widths.get(child) || nodeGap), 0);
      let cursor = left + (width - childTotal) / 2;
      const childCenters = [];
      kids.forEach((child) => {
        const childWidth = widths.get(child) || nodeGap;
        place(child, cursor, depth + 1);
        childCenters.push(positions.get(child).x);
        cursor += childWidth;
      });
      x = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    }
    positions.set(node, { x, y: top + depth * levelGap });
  }

  let cursor = marginX;
  roots.forEach((root) => {
    const width = measure(root);
    place(root, cursor, 0);
    cursor += width + rootGap;
  });

  return {
    children,
    roots,
    positions,
    width: Math.max(760, cursor - rootGap + marginX),
    height: Math.max(300, top + maxDepth * levelGap + 86),
  };
}

function renderParentArray(parent, activeNodes, changedNodes) {
  const arrayPanel = document.createElement("div");
  arrayPanel.className = "uf-array-panel";
  arrayPanel.style.setProperty("--uf-count", String(parent.length));

  const parentRow = document.createElement("div");
  parentRow.className = "uf-array-row";
  const parentLabel = document.createElement("div");
  parentLabel.className = "uf-array-label";
  parentLabel.textContent = "parent";
  parentRow.append(parentLabel);

  parent.forEach((p, node) => {
    const cell = document.createElement("div");
    cell.className = [
      "uf-array-cell",
      p === node ? "root" : "",
      activeNodes.has(node) ? "active" : "",
      changedNodes.has(node) ? "changed" : "",
    ].filter(Boolean).join(" ");
    cell.textContent = p;
    parentRow.append(cell);
  });

  const indexRow = document.createElement("div");
  indexRow.className = "uf-array-row index-row";
  const indexLabel = document.createElement("div");
  indexLabel.className = "uf-array-label";
  indexLabel.textContent = "node";
  indexRow.append(indexLabel);
  parent.forEach((_, node) => {
    const indexCell = document.createElement("div");
    indexCell.className = [
      "uf-array-index",
      activeNodes.has(node) ? "active" : "",
      changedNodes.has(node) ? "changed" : "",
    ].filter(Boolean).join(" ");
    indexCell.textContent = node;
    indexRow.append(indexCell);
  });

  arrayPanel.append(parentRow, indexRow);
  return arrayPanel;
}

function renderDsuForest(parent, activeNodes, changedNodes) {
  const layout = buildDsuForestLayout(parent);
  const wrap = document.createElement("div");
  wrap.className = "uf-forest-wrap";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "uf-forest");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "并查集 parent 数组形成的森林结构");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "uf-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  markerPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  marker.append(markerPath);
  defs.append(marker);
  svg.append(defs);

  const edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const loopLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const nodeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.append(edgeLayer, loopLayer, nodeLayer);

  parent.forEach((p, node) => {
    if (p === node || p < 0 || p >= parent.length) return;
    const childPos = layout.positions.get(node);
    const parentPos = layout.positions.get(p);
    if (!childPos || !parentPos) return;
    const midY = (childPos.y + parentPos.y) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `uf-tree-edge ${changedNodes.has(node) ? "changed" : ""}`);
    path.setAttribute(
      "d",
      `M ${childPos.x} ${childPos.y - 25} C ${childPos.x} ${midY}, ${parentPos.x} ${midY}, ${parentPos.x} ${parentPos.y + 27}`,
    );
    path.setAttribute("marker-end", "url(#uf-arrow)");
    edgeLayer.append(path);
  });

  layout.roots.forEach((root) => {
    const pos = layout.positions.get(root);
    if (!pos) return;
    const loop = document.createElementNS("http://www.w3.org/2000/svg", "path");
    loop.setAttribute("class", `uf-root-loop ${activeNodes.has(root) ? "active" : ""}`);
    loop.setAttribute(
      "d",
      `M ${pos.x - 14} ${pos.y - 29} C ${pos.x - 42} ${pos.y - 62}, ${pos.x + 34} ${pos.y - 70}, ${pos.x + 18} ${pos.y - 29}`,
    );
    loop.setAttribute("marker-end", "url(#uf-arrow)");
    loopLayer.append(loop);
  });

  parent.forEach((p, node) => {
    const pos = layout.positions.get(node);
    if (!pos) return;
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", [
      "uf-tree-node",
      p === node ? "root" : "",
      activeNodes.has(node) ? "active" : "",
      changedNodes.has(node) ? "changed" : "",
    ].filter(Boolean).join(" "));
    group.setAttribute("transform", `translate(${pos.x} ${pos.y})`);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "25");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", "0.36em");
    text.textContent = node;
    group.append(circle, text);
    nodeLayer.append(group);
  });

  wrap.append(svg);
  return wrap;
}

function renderLog() {
  el.eventLog.innerHTML = "";
  const event = state.events[state.index];
  if (!event?.dsu) {
    el.eventLog.innerHTML = "<p class=\"uf-empty\">基准算法不使用并查集。切换到 UF 算法后，这里会展示 parent 数组和树状压缩结构。</p>";
    return;
  }

  const activeNodes = new Set(event.activeNodes || []);
  const previousDsu = previousDsuBefore(state.index);
  const changedNodes = new Set();
  if (previousDsu) {
    event.dsu.forEach((parent, node) => {
      if (previousDsu[node] !== parent) changedNodes.add(node);
    });
  }

  const status = document.createElement("div");
  status.className = "uf-step-note";
  const changedText = [...changedNodes]
    .map((node) => `${node}->${event.dsu[node]}`)
    .join("，");
  status.textContent = changedText
    ? `本步 parent 更新：${changedText}`
    : event.phase === "compress"
      ? "本步执行 find，若存在长路径会在这里看到压缩后的 parent 变化。"
      : "当前 parent 数组对应下方的并查集森林。";

  el.eventLog.append(
    status,
    renderParentArray(event.dsu, activeNodes, changedNodes),
    renderDsuForest(event.dsu, activeNodes, changedNodes),
  );
}

function bridgeTotal() {
  const last = state.events[state.events.length - 1];
  if (!last) return 0;
  return Object.values(last.edgeClass).filter((className) => className.includes("bridge")).length;
}

function render() {
  const event = state.events[state.index] || makeSnapshot({ title: "准备运行", detail: "", phase: "idle" });
  renderGraph(event);
  renderDsu(event.dsu);
  renderPseudo(event.hot || 0);
  renderTimeline();
  renderLog();
  el.eventTitle.textContent = event.title;
  el.eventDetail.textContent = event.detail;
  el.algorithmTitle.textContent = state.algorithm === "efficient" ? "并查集优化算法" : "基准算法";
  el.stepBadge.textContent = `${state.index} / ${Math.max(0, state.events.length - 1)}`;
  if (el.progressFill) {
    const maxIndex = Math.max(1, state.events.length - 1);
    el.progressFill.style.width = `${(state.index / maxIndex) * 100}%`;
  }
  el.benchmarkBtn.classList.toggle("active", state.algorithm === "benchmark");
  el.efficientBtn.classList.toggle("active", state.algorithm === "efficient");
  el.vertexCount.textContent = state.graph.V;
  el.edgeCount.textContent = state.graph.edges.length;
  el.bridgeCount.textContent = bridgeTotal();
  el.stepCount.textContent = state.events.length;
}

function buildRun(algorithm) {
  pause();
  state.algorithm = algorithm;
  state.events = algorithm === "efficient"
    ? generateEfficientEvents(state.graph)
    : generateBenchmarkEvents(state.graph);
  state.index = 0;
  render();
}

function loadGraphFromText(text, layout = null) {
  state.graph = parseGraph(text);
  state.positions = layout || defaultLayout(state.graph);
  state.events = [];
  state.index = 0;
  buildRun(state.algorithm);
}

function pause() {
  window.clearInterval(state.timer);
  state.timer = null;
  el.playBtn.textContent = "播放";
}

function play() {
  pause();
  el.playBtn.textContent = "暂停";
  const delay = Math.max(180, 1100 / state.speed);
  state.timer = window.setInterval(() => {
    if (state.index >= state.events.length - 1) {
      pause();
      return;
    }
    state.index += 1;
    render();
  }, delay);
}

function loadSelectedSample() {
  const sample = samples[el.sampleSelect.value];
  el.graphInput.value = sample.text;
  loadGraphFromText(sample.text, sample.layout);
}

el.sampleSelect.addEventListener("change", loadSelectedSample);
el.loadInputBtn.addEventListener("click", () => {
  try {
    loadGraphFromText(el.graphInput.value);
  } catch (error) {
    alert(error.message);
  }
});
el.randomDensity.addEventListener("input", () => {
  el.randomDensityLabel.textContent = Number(el.randomDensity.value).toFixed(2);
});
el.randomBtn.addEventListener("click", () => {
  const sample = makeRandomGraph(Number(el.randomNodeCount.value), Number(el.randomDensity.value));
  el.graphInput.value = sample.text;
  loadGraphFromText(sample.text, sample.layout);
});
el.benchmarkBtn.addEventListener("click", () => buildRun("benchmark"));
el.efficientBtn.addEventListener("click", () => buildRun("efficient"));
el.resetBtn.addEventListener("click", () => {
  pause();
  state.index = 0;
  render();
});
el.prevBtn.addEventListener("click", () => {
  pause();
  state.index = Math.max(0, state.index - 1);
  render();
});
el.nextBtn.addEventListener("click", () => {
  pause();
  state.index = Math.min(state.events.length - 1, state.index + 1);
  render();
});
el.playBtn.addEventListener("click", () => {
  if (state.timer) pause();
  else play();
});
el.speedRange.addEventListener("input", () => {
  state.speed = Number(el.speedRange.value);
  if (state.timer) play();
});
el.timelineRange.addEventListener("input", () => {
  pause();
  state.index = Number(el.timelineRange.value);
  render();
});

loadSelectedSample();
