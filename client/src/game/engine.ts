export type Cell = 0 | 1 | 2;
export type Board = Cell[][];

export function newBoard(): Board {
  return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0 as Cell));
}

export function cloneBoard(b: Board): Board {
  return b.map((r) => r.slice()) as Board;
}

export function drop(b: Board, col: number, player: 1 | 2): { row: number; board: Board } | null {
  if (col < 0 || col > 6) return null;
  for (let row = 5; row >= 0; row--) {
    if (b[row][col] === 0) {
      const nb = cloneBoard(b);
      nb[row][col] = player;
      return { row, board: nb };
    }
  }
  return null;
}

export function legalMoves(b: Board): number[] {
  const moves: number[] = [];
  for (let c = 0; c < 7; c++) if (b[0][c] === 0) moves.push(c);
  return moves;
}

export function checkWinner(b: Board): 0 | 1 | 2 {
  const H = 6;
  const W = 7;
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = b[r][c];
      if (p === 0) continue;
      for (const [dc, dr] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || b[rr][cc] !== p) {
            ok = false;
            break;
          }
        }
        if (ok) return p;
      }
    }
  }
  return 0;
}

export function isFull(b: Board) {
  return legalMoves(b).length === 0;
}

