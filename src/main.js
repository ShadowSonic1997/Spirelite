function weightedPick(weights) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [t, w] of weights) {
    roll -= w;
    if (roll <= 0) return t;
  }
  return weights[0][0];
}

function rollRoomTypeForRow(row, totalRows) {
  // Keep early rows combat-y, sprinkle shops/rest/events later.
  if (row === 0) return "battle";
  if (row === totalRows - 1) return "elite"; // "boss-lite" for now

  const weights = [
    ["battle", 44],
    ["elite", row > 2 ? 12 : 6],
    ["shop", 14],
    ["rest", 14],
    ["event", 10],
    ["treasure", 8],
    ["forge", 8],
    ["curse", 6],
  ];
  return weightedPick(weights);
}

function buildNewMap({ rows = 8, cols = 4 } = {}) {
  // rows = how many "steps" to reach the end; cols = width of node grid
  const nodes = {};
  const rowNodes = [];

  const nodeId = (r, c) => `r${r}c${c}`;

  for (let r = 0; r < rows; r++) {
    const count = (r === 0) ? 1 : (r === rows - 1 ? 1 : cols);
    rowNodes[r] = [];

    for (let c = 0; c < count; c++) {
      // center start/end
      const col = (r === 0 || r === rows - 1) ? Math.floor(cols / 2) : c;

      const id = nodeId(r, col);
      if (nodes[id]) { rowNodes[r].push(id); continue; } // avoid dup when start/end "center" overlaps

      nodes[id] = {
        id,
        row: r,
        col,
        type: rollRoomTypeForRow(r, rows),
        next: [],
        visited: false,
      };
      rowNodes[r].push(id);
    }
  }

  // Connect rows with branching paths
  for (let r = 0; r < rows - 1; r++) {
    for (const id of rowNodes[r]) {
      const n = nodes[id];
      const nextRow = rowNodes[r + 1];

      // pick 1-2 outgoing edges (more branch mid-map)
      const outCount =
        (r === 0) ? 2 :
        (r >= rows - 3) ? 1 :
        (Math.random() < 0.55 ? 2 : 1);

      // choose targets biased toward same/near column
      const candidates = [...nextRow].sort((a, b) => {
        const da = Math.abs(nodes[a].col - n.col);
        const db = Math.abs(nodes[b].col - n.col);
        return da - db;
      });

      const picks = [];
      for (let i = 0; i < candidates.length && picks.length < outCount; i++) {
        if (Math.random() < (i === 0 ? 0.85 : 0.55)) picks.push(candidates[i]);
      }
      if (!picks.length) picks.push(candidates[0]);

      // ensure unique
      n.next = [...new Set(picks)];
    }
  }

  const startId = rowNodes[0][0];
  nodes[startId].visited = true; // start "already visited"

  return {
    rows,
    cols,
    nodes,
    startId,
    currentId: startId,             // where you are now
    selectable: [...nodes[startId].next], // where you can go next
    previewId: null,                // node you clicked to preview
  };
}
