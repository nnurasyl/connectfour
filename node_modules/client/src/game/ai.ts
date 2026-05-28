import { checkWinner, drop, legalMoves, type Board } from "./engine";

function scoreWindow(window: number[], player: 1 | 2) {
  const opp: 1 | 2 = player === 1 ? 2 : 1;
  const p = window.filter((x) => x === player).length;
  const o = window.filter((x) => x === opp).length;
  const e = window.filter((x) => x === 0).length;
  if (p === 4) return 100000;
  if (p === 3 && e === 1) return 50;
  if (p === 2 && e === 2) return 8;
  if (o === 3 && e === 1) return -60;
  if (o === 4) return -100000;
  return 0;
}

function heuristic(b: Board, player: 1 | 2) {
  // center preference + window scores
  let s = 0;
  const center = 3;
  for (let r = 0; r < 6; r++) if (b[r][center] === player) s += 3;

  // horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const w = [b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]];
      s += scoreWindow(w, player);
    }
  }
  // vertical
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 3; r++) {
      const w = [b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]];
      s += scoreWindow(w, player);
    }
  }
  // diag \
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const w = [b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]];
      s += scoreWindow(w, player);
    }
  }
  // diag /
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const w = [b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]];
      s += scoreWindow(w, player);
    }
  }
  return s;
}

function minimax(
  b: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  me: 1 | 2,
) {
  const w = checkWinner(b);
  if (w === me) return { score: 1000000 };
  if (w !== 0 && w !== me) return { score: -1000000 };
  const moves = legalMoves(b);
  if (depth === 0 || moves.length === 0) return { score: heuristic(b, me) };

  if (maximizing) {
    let best = -Infinity;
    let bestCol = moves[0];
    for (const col of moves) {
      const d = drop(b, col, me);
      if (!d) continue;
      const r = minimax(d.board, depth - 1, alpha, beta, false, me).score;
      if (r > best) {
        best = r;
        bestCol = col;
      }
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return { score: best, col: bestCol };
  } else {
    const opp: 1 | 2 = me === 1 ? 2 : 1;
    let best = Infinity;
    let bestCol = moves[0];
    for (const col of moves) {
      const d = drop(b, col, opp);
      if (!d) continue;
      const r = minimax(d.board, depth - 1, alpha, beta, true, me).score;
      if (r < best) {
        best = r;
        bestCol = col;
      }
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return { score: best, col: bestCol };
  }
}

export function pickMoveMedium(b: Board, aiPlayer: 1 | 2) {
  const opp: 1 | 2 = aiPlayer === 1 ? 2 : 1;
  const moves = legalMoves(b);
  // win now?
  for (const col of moves) {
    const d = drop(b, col, aiPlayer);
    if (d && checkWinner(d.board) === aiPlayer) return col;
  }
  // block opponent win
  for (const col of moves) {
    const d = drop(b, col, opp);
    if (d && checkWinner(d.board) === opp) return col;
  }
  // prefer center-ish
  const pref = [...moves].sort((a, c) => Math.abs(a - 3) - Math.abs(c - 3));
  return pref[Math.floor(Math.random() * Math.min(3, pref.length))] ?? moves[0];
}

export function pickMoveHard(b: Board, aiPlayer: 1 | 2) {
  const depth = 5; // solid for web, fast enough
  const res = minimax(b, depth, -Infinity, Infinity, true, aiPlayer);
  return res.col ?? legalMoves(b)[0] ?? 3;
}

