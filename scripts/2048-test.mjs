// One-off test for 2048 applyMove. NOT shipped; lives outside src/ so
// it's ignored by the Next.js bundler. Run with `node scripts/2048-test.mjs`.
const TILE = (id, row, col, value) => ({ id, row, col, value });

function buildLines(tiles, size, direction) {
  const lines = [];
  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < size; r++) {
      const inRow = tiles.filter((t) => t.row === r).sort((a, b) => a.col - b.col);
      lines.push({ nearToFar: direction === 'left' ? inRow : inRow.slice().reverse() });
    }
  } else {
    for (let c = 0; c < size; c++) {
      const inCol = tiles.filter((t) => t.col === c).sort((a, b) => a.row - b.row);
      lines.push({ nearToFar: direction === 'up' ? inCol : inCol.slice().reverse() });
    }
  }
  return lines;
}

function applyMove(tiles, size, direction) {
  const lines = buildLines(tiles, size, direction);
  const kept = [];
  const mergedIds = new Set();
  let totalGained = 0;
  let anyMoved = false;
  for (const { nearToFar } of lines) {
    const compact = nearToFar.filter((t) => t.value !== 0);
    const lineOut = [];
    let i = 0;
    while (i < compact.length) {
      const cur = compact[i];
      const next = compact[i + 1];
      if (next && cur.value === next.value) {
        const newValue = cur.value * 2;
        totalGained += newValue;
        lineOut.push({ ...cur, value: newValue });
        mergedIds.add(cur.id);
        i += 2;
      } else {
        lineOut.push(cur);
        i += 1;
      }
    }
    for (let slot = 0; slot < lineOut.length; slot++) {
      const tile = lineOut[slot];
      let newPos;
      if (direction === 'left') newPos = { row: tile.row, col: slot };
      else if (direction === 'right') newPos = { row: tile.row, col: size - 1 - slot };
      else if (direction === 'up') newPos = { row: slot, col: tile.col };
      else newPos = { row: size - 1 - slot, col: tile.col };
      if (newPos.row !== tile.row || newPos.col !== tile.col) anyMoved = true;
      kept.push({ id: tile.id, row: newPos.row, col: newPos.col, value: tile.value });
    }
  }
  return { tiles: kept, gained: totalGained, moved: anyMoved, mergedIds };
}

function boardOf(tiles, size) {
  const b = new Array(size * size).fill(0);
  for (const t of tiles) b[t.row * size + t.col] = t.value;
  return b;
}

const SIZE = 4;
const cases = [
  { name: '[2,2,_,_] left -> [4,_,_,_]',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 1, 2)], direction: 'left',
    expect: [4, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: '[2,2,2,_] left -> [4,2,_,_] no chain',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 1, 2), TILE('c', 0, 2, 2)], direction: 'left',
    expect: [4, 2, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: '[4,4,8,8] left -> [8,16,_,_] two separate merges',
    tiles: [TILE('a', 0, 0, 4), TILE('b', 0, 1, 4), TILE('c', 0, 2, 8), TILE('d', 0, 3, 8)], direction: 'left',
    expect: [8, 16, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: '[2,_,_,2] left -> [4,_,_,_] slide then merge',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 3, 2)], direction: 'left',
    expect: [4, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: '[2,2,_,_] right -> [_,_,_,4]',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 1, 2)], direction: 'right',
    expect: [0, 0, 0, 4,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: 'col [2,2,_,_] up -> [4,_,_,_]',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 1, 0, 2)], direction: 'up',
    expect: [4, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: 'col [2,2,_,_] down -> [_,_,_,4]',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 1, 0, 2)], direction: 'down',
    expect: [0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 4] },
  { name: '[2,2,2,2] left -> [4,4,_,_] pair-merges only',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 1, 2), TILE('c', 0, 2, 2), TILE('d', 0, 3, 2)], direction: 'left',
    expect: [4, 4, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: '[4,2,2,4] left -> [4,4,4,_] 2+2 then nothing',
    tiles: [TILE('a', 0, 0, 4), TILE('b', 0, 1, 2), TILE('c', 0, 2, 2), TILE('d', 0, 3, 4)], direction: 'left',
    expect: [4, 4, 4, 0,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
  { name: 'full row [2,4,2,4] left -> unchanged (no moves)',
    tiles: [TILE('a', 0, 0, 2), TILE('b', 0, 1, 4), TILE('c', 0, 2, 2), TILE('d', 0, 3, 4)], direction: 'left',
    expect: [2, 4, 2, 4,  0, 0, 0, 0,  0, 0, 0, 0,  0, 0, 0, 0] },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = applyMove(c.tiles, SIZE, c.direction);
  const b = boardOf(r.tiles, SIZE);
  const ok = JSON.stringify(b) === JSON.stringify(c.expect);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}  -> [${b}]${ok ? '' : '  expected [' + c.expect + ']'}  gained=${r.gained}`);
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
