export type DiffLineType = 'equal' | 'insert' | 'delete';

export interface DiffLine {
  type: DiffLineType;
  lineA: number | null; // 1-based
  lineB: number | null; // 1-based
  text: string;
}

export interface CompareStats {
  totalA: number;
  totalB: number;
  common: number;
  onlyA: number;
  onlyB: number;
  identical: boolean;
}

export interface CompareResult {
  stats: CompareStats;
  diff: DiffLine[];
  truncated: boolean;
}

// ─── Myers LCS diff ───────────────────────────────────────────────────────────
// Only used when BOTH files are <= LCS_LIMIT lines. Memory = O(m*n) numbers.
// LCS_LIMIT = 2000 → worst case 4M entries ≈ 32 MB — safely within worker budget.

const LCS_LIMIT = 2000;

function myersDiff(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;

  // Build full DP table (two rows at a time, store all for traceback)
  const dp: Uint32Array[] = [];
  dp.push(new Uint32Array(n + 1)); // row 0 = all zeros

  for (let i = 1; i <= m; i++) {
    const prev = dp[i - 1];
    const curr = new Uint32Array(n + 1);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = prev[j] > curr[j - 1] ? prev[j] : curr[j - 1];
      }
    }
    dp.push(curr);
  }

  // Iterative traceback (avoids call-stack overflow)
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'equal', lineA: i, lineB: j, text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'insert', lineA: null, lineB: j, text: b[j - 1] });
      j--;
    } else {
      result.push({ type: 'delete', lineA: i, lineB: null, text: a[i - 1] });
      i--;
    }
  }

  result.reverse();
  return result;
}

// ─── Set-based diff ───────────────────────────────────────────────────────────
// O(n) memory, used when files are too large for LCS.
// Preserves line order within each file.

function setDiff(a: string[], b: string[]): DiffLine[] {
  const setB = new Set(b);
  const diff: DiffLine[] = [];
  let lineAIdx = 1;
  let lineBIdx = 1;

  for (const line of a) {
    if (setB.has(line)) {
      diff.push({ type: 'equal', lineA: lineAIdx++, lineB: lineBIdx++, text: line });
    } else {
      diff.push({ type: 'delete', lineA: lineAIdx++, lineB: null, text: line });
    }
  }

  const setA = new Set(a);
  for (const line of b) {
    if (!setA.has(line)) {
      diff.push({ type: 'insert', lineA: null, lineB: lineBIdx++, text: line });
    }
  }

  return diff;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent) => {
  try {
    const { linesA, linesB }: { linesA: string[]; linesB: string[] } = event.data;

    const useLCS = linesA.length <= LCS_LIMIT && linesB.length <= LCS_LIMIT;

    let diff: DiffLine[];
    let truncated: boolean;

    if (useLCS) {
      diff = myersDiff(linesA, linesB);
      truncated = false;
    } else {
      diff = setDiff(linesA, linesB);
      truncated = true;
    }

    const common = diff.filter(d => d.type === 'equal').length;
    const onlyA  = diff.filter(d => d.type === 'delete').length;
    const onlyB  = diff.filter(d => d.type === 'insert').length;

    const stats: CompareStats = {
      totalA: linesA.length,
      totalB: linesB.length,
      common,
      onlyA,
      onlyB,
      identical: onlyA === 0 && onlyB === 0,
    };

    self.postMessage({ stats, diff, truncated } as CompareResult);
  } catch (err) {
    // Send a structured error so the hook can surface it gracefully
    self.postMessage({ error: String(err) });
  }
});
