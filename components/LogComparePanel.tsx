"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  FileDiff,
  ArrowDownUp,
  FileText,
  ChevronUp,
  ChevronRight,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogCompare } from "@/hooks/useLogCompare";
import type { LogEntry } from "@/hooks/useLogFile";
import type { DiffLine } from "@/hooks/useLogCompare";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface LogSession {
  id: string;
  name: string;
  logs: LogEntry[];
}

interface LogComparePanelProps {
  sessions: LogSession[];
}

type DiffFilter = "all" | "diffs" | "matches";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute per-level counts from a LogEntry array */
function levelStats(logs: LogEntry[]) {
  const s = { error: 0, warn: 0, info: 0, debug: 0, fatal: 0, unknown: 0 };
  for (const l of logs) {
    const k = l.level in s ? l.level : "unknown";
    s[k as keyof typeof s]++;
  }
  return s;
}

/**
 * Find spans of characters that differ between two strings.
 * Returns an array of { text, changed } segments for each string.
 */
function charDiff(
  a: string,
  b: string,
): { segsA: { text: string; changed: boolean }[]; segsB: { text: string; changed: boolean }[] } {
  // Simple LCS on characters (capped at 300 chars each to stay fast)
  const A = a.slice(0, 300);
  const B = b.slice(0, 300);
  const m = A.length, n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const segsA: { text: string; changed: boolean }[] = [];
  const segsB: { text: string; changed: boolean }[] = [];
  let i = m, j = n;
  const opsA: ("eq" | "del")[] = [];
  const opsB: ("eq" | "ins")[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) { opsA.push("eq"); opsB.push("eq"); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { opsB.push("ins"); j--; }
    else { opsA.push("del"); i--; }
  }
  opsA.reverse(); opsB.reverse();

  let cur = ""; let curChanged = false;
  for (const op of opsA) {
    const ch = A[i++] ?? ""; // won't be used directly
    void op; // suppress lint
  }
  // Rebuild from ops
  i = 0; j = 0;
  let bufA = ""; let bufAChanged = false;
  let bufB = ""; let bufBChanged = false;
  const flushA = (changed: boolean) => { if (bufA) { segsA.push({ text: bufA, changed: bufAChanged }); bufA = ""; } bufAChanged = changed; };
  const flushB = (changed: boolean) => { if (bufB) { segsB.push({ text: bufB, changed: bufBChanged }); bufB = ""; } bufBChanged = changed; };

  // Re-traceback cleanly
  segsA.length = 0; segsB.length = 0;
  let ai = 0, bi = 0;
  const ops: { type: "eq" | "del" | "ins" }[] = [];
  { let ii = m, jj = n;
    while (ii > 0 || jj > 0) {
      if (ii > 0 && jj > 0 && A[ii-1] === B[jj-1]) { ops.push({ type: "eq" }); ii--; jj--; }
      else if (jj > 0 && (ii === 0 || dp[ii][jj-1] >= dp[ii-1][jj])) { ops.push({ type: "ins" }); jj--; }
      else { ops.push({ type: "del" }); ii--; }
    }
    ops.reverse();
  }
  let curA = ""; let changedA = false;
  let curB = ""; let changedB = false;
  for (const op of ops) {
    if (op.type === "eq") {
      if (changedA) { segsA.push({ text: curA, changed: true }); curA = ""; }
      if (changedB) { segsB.push({ text: curB, changed: true }); curB = ""; }
      changedA = false; changedB = false;
      curA += A[ai++]; curB += B[bi++];
    } else if (op.type === "del") {
      if (!changedA) { segsA.push({ text: curA, changed: false }); curA = ""; }
      changedA = true; curA += A[ai++];
    } else {
      if (!changedB) { segsB.push({ text: curB, changed: false }); curB = ""; }
      changedB = true; curB += B[bi++];
    }
  }
  if (curA) segsA.push({ text: curA, changed: changedA });
  if (curB) segsB.push({ text: curB, changed: changedB });

  // Append any overflow (beyond 300 chars) as-is
  if (a.length > 300) segsA.push({ text: a.slice(300), changed: false });
  if (b.length > 300) segsB.push({ text: b.slice(300), changed: false });

  return { segsA, segsB };
}

// ─── Session Selector ─────────────────────────────────────────────────────────

function SessionSelector({
  label, sessions, value, onChange, exclude,
}: {
  label: string; sessions: LogSession[]; value: string;
  onChange: (id: string) => void; exclude: string;
}) {
  const selected = sessions.find((s) => s.id === value);
  const available = sessions.filter((s) => s.id !== exclude);
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(
          "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full text-left cursor-pointer",
          "bg-card hover:bg-muted/60 border-border/60 hover:border-primary/40 shadow-sm",
          !selected && "text-muted-foreground",
        )}>
          <span className="flex items-center gap-2 truncate">
            <FileText size={14} className="text-muted-foreground shrink-0" />
            <span className="truncate">{selected ? selected.name : "Select a session…"}</span>
            {selected && (
              <span className="text-xs text-muted-foreground font-normal shrink-0">
                ({selected.logs.length.toLocaleString()} lines)
              </span>
            )}
          </span>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="start">
          {available.length === 0 ? (
            <DropdownMenuItem disabled>No other sessions available</DropdownMenuItem>
          ) : (
            available.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onChange(s.id)}
                className={cn("flex items-center justify-between", s.id === value && "bg-accent")}>
                <span className="truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">{s.logs.length.toLocaleString()} lines</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number | string; color: "muted" | "green" | "red" | "blue" | "amber" }) {
  const colorMap = {
    muted: "bg-muted/60 text-muted-foreground border-border/40",
    green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };
  return (
    <div className={cn("flex flex-col items-center px-4 py-2 rounded-lg border text-center min-w-[80px]", colorMap[color])}>
      <span className="text-lg font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</span>
      <span className="text-xs font-medium opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────

function LevelBar({ label, statsA, statsB }: { label: string; statsA: ReturnType<typeof levelStats>; statsB: ReturnType<typeof levelStats> }) {
  const levels: { key: keyof ReturnType<typeof levelStats>; color: string; dot: string }[] = [
    { key: "fatal", color: "text-red-700", dot: "bg-red-700" },
    { key: "error", color: "text-red-500", dot: "bg-red-500" },
    { key: "warn",  color: "text-amber-500", dot: "bg-amber-500" },
    { key: "info",  color: "text-blue-500", dot: "bg-blue-500" },
    { key: "debug", color: "text-purple-500", dot: "bg-purple-500" },
  ].filter(l => statsA[l.key] > 0 || statsB[l.key] > 0);

  if (levels.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <div className="flex flex-col gap-1 bg-muted/30 rounded-lg border border-border/40 px-3 py-2">
        {levels.map(({ key, color, dot }) => {
          const a = statsA[key]; const b = statsB[key];
          const max = Math.max(a, b, 1);
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
              <span className={cn("w-10 capitalize font-medium", color)}>{key}</span>
              <div className="flex-1 flex items-center gap-1.5">
                {/* A bar */}
                <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div className="h-full bg-current rounded-full transition-all" style={{ width: `${(a / max) * 100}%`, color: "inherit" }} />
                </div>
                <span className={cn("w-14 text-right tabular-nums", color)}>{a.toLocaleString()} / {b.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Collapsible equal-lines block ───────────────────────────────────────────

function CollapseRow({ count, onExpand, style }: { count: number; onExpand: () => void; style: React.CSSProperties }) {
  return (
    <div style={style} className="flex items-center text-xs text-muted-foreground/60 border-b border-border/20 bg-muted/10 hover:bg-muted/20 cursor-pointer select-none group transition-colors" onClick={onExpand}>
      <div className="w-14 shrink-0 border-r border-border/20" />
      <div className="w-14 shrink-0 border-r border-border/20" />
      <div className="w-6 shrink-0 border-r border-border/20 flex items-center justify-center">
        <ChevronRight size={10} className="group-hover:text-foreground transition-colors" />
      </div>
      <span className="pl-3 italic">··· {count.toLocaleString()} unchanged lines — click to expand</span>
    </div>
  );
}

// ─── Rendered diff row (supports inline char diff) ───────────────────────────

type VirtualRow =
  | { kind: "diff"; line: DiffLine; pairLine?: DiffLine }
  | { kind: "collapse"; count: number; startIdx: number };

const COLLAPSE_THRESHOLD = 5; // equal-line runs longer than this get collapsed

function buildVirtualRows(diff: DiffLine[], expandedCollapses: Set<number>): VirtualRow[] {
  const rows: VirtualRow[] = [];
  let i = 0;
  while (i < diff.length) {
    if (diff[i].type !== "equal") {
      rows.push({ kind: "diff", line: diff[i] });
      i++;
    } else {
      // Count run of equal lines
      let runStart = i;
      while (i < diff.length && diff[i].type === "equal") i++;
      const runLen = i - runStart;
      if (runLen > COLLAPSE_THRESHOLD && !expandedCollapses.has(runStart)) {
        rows.push({ kind: "collapse", count: runLen, startIdx: runStart });
      } else {
        for (let k = runStart; k < i; k++) rows.push({ kind: "diff", line: diff[k] });
      }
    }
  }
  return rows;
}

const DiffRow = React.memo(function DiffRow({
  line, style, inlineCharDiff, pairText,
}: {
  line: DiffLine; style: React.CSSProperties; inlineCharDiff: boolean; pairText?: string;
}) {
  const isInsert = line.type === "insert";
  const isDelete = line.type === "delete";
  const isEqual  = line.type === "equal";

  // Compute inline char segments when needed
  const segments = useMemo(() => {
    if (!inlineCharDiff || isEqual || !pairText) return null;
    const { segsA, segsB } = charDiff(isDelete ? line.text : pairText, isDelete ? pairText : line.text);
    return isDelete ? segsA : segsB;
  }, [inlineCharDiff, isEqual, pairText, line.text, isDelete]);

  return (
    <div style={style} className={cn(
      "flex items-stretch text-xs font-mono border-b border-border/20 last:border-0",
      isInsert && "bg-emerald-500/8 hover:bg-emerald-500/12",
      isDelete && "bg-red-500/8 hover:bg-red-500/12",
      isEqual  && "hover:bg-muted/30",
    )}>
      <div className={cn("w-14 shrink-0 text-right pr-3 py-1 select-none text-muted-foreground/50 border-r border-border/20", isDelete && "text-red-500/60 bg-red-500/5")}>
        {line.lineA ?? ""}
      </div>
      <div className={cn("w-14 shrink-0 text-right pr-3 py-1 select-none text-muted-foreground/50 border-r border-border/20", isInsert && "text-emerald-500/60 bg-emerald-500/5")}>
        {line.lineB ?? ""}
      </div>
      <div className={cn("w-6 shrink-0 flex items-center justify-center py-1 select-none font-bold border-r border-border/20",
        isInsert && "text-emerald-500 bg-emerald-500/8",
        isDelete && "text-red-500 bg-red-500/8",
        isEqual  && "text-muted-foreground/30",
      )}>
        {isInsert ? "+" : isDelete ? "−" : " "}
      </div>
      <div className={cn("flex-1 py-1 px-3 overflow-hidden text-ellipsis whitespace-nowrap",
        isInsert && "text-emerald-400", isDelete && "text-red-400", isEqual && "text-foreground/70",
      )}>
        {segments ? (
          segments.map((seg, i) => (
            <span key={i} className={cn(seg.changed && (isDelete ? "bg-red-500/30 text-red-300 rounded-sm" : "bg-emerald-500/30 text-emerald-300 rounded-sm"))}>
              {seg.text}
            </span>
          ))
        ) : (
          line.text || <span className="text-muted-foreground/30 italic">empty line</span>
        )}
      </div>
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function LogComparePanel({ sessions }: LogComparePanelProps) {
  const loadedSessions = sessions.filter((s) => s.logs.length > 0);

  const [sessionAId, setSessionAId] = useState<string>(loadedSessions[0]?.id ?? "");
  const [sessionBId, setSessionBId] = useState<string>(loadedSessions[1]?.id ?? "");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [inlineCharDiff, setInlineCharDiff] = useState(true);
  const [expandedCollapses, setExpandedCollapses] = useState<Set<number>>(new Set());
  const [showLevelBreakdown, setShowLevelBreakdown] = useState(false);

  const sessionA = sessions.find((s) => s.id === sessionAId);
  const sessionB = sessions.find((s) => s.id === sessionBId);
  const logsA = useMemo(() => sessionA?.logs ?? [], [sessionA]);
  const logsB = useMemo(() => sessionB?.logs ?? [], [sessionB]);

  const { status, diff, stats, truncated } = useLogCompare(logsA, logsB);

  const statsA = useMemo(() => levelStats(logsA), [logsA]);
  const statsB = useMemo(() => levelStats(logsB), [logsB]);

  // Reset expanded collapses when diff changes
  useEffect(() => { setExpandedCollapses(new Set()); }, [diff]);

  // Apply DiffFilter + search
  const filteredDiff = useMemo(() => {
    let lines = diff;
    if (diffFilter === "diffs")   lines = lines.filter((d) => d.type !== "equal");
    if (diffFilter === "matches") lines = lines.filter((d) => d.type === "equal");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      lines = lines.filter((d) => d.text.toLowerCase().includes(q));
    }
    return lines;
  }, [diff, diffFilter, searchQuery]);

  // Build virtual rows with collapse groups
  const virtualRows = useMemo(
    () => buildVirtualRows(filteredDiff, expandedCollapses),
    [filteredDiff, expandedCollapses],
  );

  // Search match indices within virtualRows
  const searchMatchIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return virtualRows
      .map((r, i) => (r.kind === "diff" && r.line.text.toLowerCase().includes(q) ? i : -1))
      .filter((i) => i >= 0);
  }, [virtualRows, searchQuery]);

  // Clamp current match
  useEffect(() => { setCurrentMatchIdx(0); }, [searchQuery]);

  // Build pair-map for inline char diff (delete ↔ nearest insert)
  const pairMap = useMemo(() => {
    const map = new Map<number, string>(); // filteredDiff index → paired line text
    let di = 0;
    while (di < filteredDiff.length) {
      if (filteredDiff[di].type === "delete") {
        // Look ahead for a matching insert
        let ni = di + 1;
        while (ni < filteredDiff.length && filteredDiff[ni].type === "delete") ni++;
        if (ni < filteredDiff.length && filteredDiff[ni].type === "insert") {
          map.set(di, filteredDiff[ni].text);
          map.set(ni, filteredDiff[di].text);
        }
      }
      di++;
    }
    return map;
  }, [filteredDiff]);

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 24;
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  // Jump to match
  const jumpToMatch = useCallback((idx: number) => {
    if (searchMatchIndices.length === 0) return;
    const clamped = (idx + searchMatchIndices.length) % searchMatchIndices.length;
    setCurrentMatchIdx(clamped);
    virtualizer.scrollToIndex(searchMatchIndices[clamped], { align: "center" });
  }, [searchMatchIndices, virtualizer]);

  // Jump to next/prev diff
  const diffOnlyIndices = useMemo(
    () => virtualRows.map((r, i) => (r.kind === "diff" && r.line.type !== "equal" ? i : -1)).filter((i) => i >= 0),
    [virtualRows],
  );
  const [diffNavIdx, setDiffNavIdx] = useState(0);
  const jumpToDiff = useCallback((dir: 1 | -1) => {
    if (diffOnlyIndices.length === 0) return;
    setDiffNavIdx(prev => {
      const next = (prev + dir + diffOnlyIndices.length) % diffOnlyIndices.length;
      virtualizer.scrollToIndex(diffOnlyIndices[next], { align: "center" });
      return next;
    });
  }, [diffOnlyIndices, virtualizer]);

  // Keyboard: n / N to jump differences, Ctrl+F focus search
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n") { e.preventDefault(); jumpToDiff(1); }
      if (e.key === "N") { e.preventDefault(); jumpToDiff(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [jumpToDiff]);

  const handleExport = () => {
    const header = [
      `--- ${sessionA?.name ?? "File A"} (${stats?.totalA.toLocaleString()} lines)`,
      `+++ ${sessionB?.name ?? "File B"} (${stats?.totalB.toLocaleString()} lines)`,
      "",
    ].join("\n");
    const body = diff.map((d) => `${d.type === "insert" ? "+" : d.type === "delete" ? "-" : " "} ${d.text}`).join("\n");
    const blob = new Blob([header + body], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diff-${new Date().toISOString().slice(0, 10)}.patch`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canCompare = sessionAId && sessionBId && sessionAId !== sessionBId;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">

      {/* ── Top control bar ───────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b bg-card flex flex-col gap-4">

        {/* Session selectors */}
        <div className="flex items-end gap-4">
          <SessionSelector label="File A  (base)" sessions={loadedSessions} value={sessionAId} onChange={setSessionAId} exclude={sessionBId} />
          <button
            onClick={() => { const t = sessionAId; setSessionAId(sessionBId); setSessionBId(t); }}
            className="mb-0.5 p-2 rounded-lg border border-border/60 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Swap A and B"
          >
            <ArrowDownUp size={16} />
          </button>
          <SessionSelector label="File B  (compare)" sessions={loadedSessions} value={sessionBId} onChange={setSessionBId} exclude={sessionAId} />
        </div>

        {/* Summary banner + stats */}
        {canCompare && status === "done" && stats && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-300">

            {/* Banner */}
            <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg border font-medium text-sm",
              stats.identical ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500",
            )}>
              {stats.identical ? (
                <><CheckCircle2 size={18} /><span>Files are identical — every line matches.</span></>
              ) : (
                <><XCircle size={18} />
                  <span>
                    {(stats.onlyA + stats.onlyB).toLocaleString()} difference{stats.onlyA + stats.onlyB !== 1 ? "s" : ""} found
                    <span className="font-normal text-muted-foreground ml-1">
                      ({stats.onlyA.toLocaleString()} removed, {stats.onlyB.toLocaleString()} added)
                    </span>
                  </span>
                </>
              )}
              {truncated && (
                <span className="ml-auto flex items-center gap-1 text-amber-500 text-xs font-normal">
                  <AlertTriangle size={13} />Large files — set-based comparison (order ignored)
                </span>
              )}
            </div>

            {/* Stat chips + controls row */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatChip label="Lines A"  value={stats.totalA} color="blue" />
              <StatChip label="Lines B"  value={stats.totalB} color="blue" />
              <StatChip label="Common"   value={stats.common} color="green" />
              <StatChip label="Only in A" value={stats.onlyA} color="red" />
              <StatChip label="Only in B" value={stats.onlyB} color="amber" />

              {/* Level breakdown toggle */}
              <button
                onClick={() => setShowLevelBreakdown(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-sm",
                  showLevelBreakdown
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
                title="Toggle level breakdown"
              >
                {showLevelBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Levels
              </button>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {/* Inline char diff toggle */}
                {!stats.identical && (
                  <button
                    onClick={() => setInlineCharDiff(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-sm",
                      inlineCharDiff
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                    title="Highlight character-level differences on similar lines"
                  >
                    Inline diff
                  </button>
                )}

                {/* Filter toggle */}
                <div className="flex items-center bg-muted/50 rounded-lg border border-border/40 p-0.5 text-xs">
                  {(["all", "diffs", "matches"] as DiffFilter[]).map((f) => (
                    <button key={f} onClick={() => setDiffFilter(f)} className={cn(
                      "px-3 py-1 rounded-md transition-all font-medium capitalize",
                      diffFilter === f ? "bg-background shadow-sm text-foreground border border-border/50" : "text-muted-foreground hover:text-foreground",
                    )}>
                      {f === "diffs" ? "Diffs only" : f === "matches" ? "Matches only" : "All"}
                    </button>
                  ))}
                </div>

                {!stats.identical && (
                  <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shadow-sm">
                    <FileDiff size={14} />Export .patch
                  </Button>
                )}
              </div>
            </div>

            {/* Level breakdown */}
            {showLevelBreakdown && (
              <div className="flex gap-4 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
                <LevelBar label={`A — ${sessionA?.name ?? "File A"}`} statsA={statsA} statsB={statsA} />
                <LevelBar label={`B — ${sessionB?.name ?? "File B"}`} statsA={statsB} statsB={statsB} />
              </div>
            )}

            {/* Search + diff navigation toolbar */}
            {!stats.identical && diff.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Search box */}
                <div className="flex items-center gap-2 flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-border/60 bg-background text-sm shadow-sm focus-within:border-primary/50 transition-colors">
                  <Search size={13} className="text-muted-foreground shrink-0" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") jumpToMatch(e.shiftKey ? currentMatchIdx - 1 : currentMatchIdx + 1);
                      if (e.key === "Escape") setSearchQuery("");
                    }}
                    placeholder="Search within diff…"
                    className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground/50"
                  />
                  {searchQuery && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {searchMatchIndices.length > 0 ? `${currentMatchIdx + 1}/${searchMatchIndices.length}` : "0 results"}
                    </span>
                  )}
                </div>

                {searchQuery && searchMatchIndices.length > 0 && (
                  <>
                    <button onClick={() => jumpToMatch(currentMatchIdx - 1)} className="p-1.5 rounded border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Previous match (Shift+Enter)"><ArrowUp size={14} /></button>
                    <button onClick={() => jumpToMatch(currentMatchIdx + 1)} className="p-1.5 rounded border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Next match (Enter)"><ArrowDown size={14} /></button>
                  </>
                )}

                <div className="h-5 w-px bg-border/50 mx-1" />

                {/* Jump to diff navigation */}
                {diffOnlyIndices.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">Jump to diff</span>
                    <button onClick={() => jumpToDiff(-1)} className="p-1.5 rounded border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Previous diff (N)"><ArrowUp size={14} /></button>
                    <button onClick={() => jumpToDiff(1)}  className="p-1.5 rounded border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Next diff (n)"><ArrowDown size={14} /></button>
                    <span className="text-xs text-muted-foreground tabular-nums">{diffNavIdx + 1} / {diffOnlyIndices.length}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {canCompare && status === "running" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in">
            <Loader2 size={16} className="animate-spin" />
            Comparing {logsA.length.toLocaleString()} × {logsB.length.toLocaleString()} lines…
          </div>
        )}

        {canCompare && status === "error" && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <XCircle size={16} />Comparison failed. Try reloading the files.
          </div>
        )}
      </div>

      {/* ── Diff Table ───────────────────────────────────────────────────────── */}
      {canCompare && status === "done" && virtualRows.length > 0 && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center text-xs font-semibold text-muted-foreground/60 border-b border-border/40 bg-muted/20 select-none uppercase tracking-wider">
            <div className="w-14 shrink-0 text-right pr-3 py-1.5">Line A</div>
            <div className="w-14 shrink-0 text-right pr-3 py-1.5 border-l border-border/30">Line B</div>
            <div className="w-6 shrink-0 py-1.5 border-l border-border/30" />
            <div className="flex-1 pl-3 py-1.5 border-l border-border/30">
              Content
              {filteredDiff.length !== diff.length && (
                <span className="ml-2 normal-case font-normal">
                  ({filteredDiff.length.toLocaleString()} of {diff.length.toLocaleString()} lines)
                </span>
              )}
            </div>
          </div>

          {/* Virtualised rows */}
          <div ref={parentRef} className="flex-1 overflow-auto" style={{ contain: "strict" }}>
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((vItem) => {
                const row = virtualRows[vItem.index];
                const style: React.CSSProperties = {
                  position: "absolute", top: 0, left: 0,
                  width: "100%", height: `${vItem.size}px`,
                  transform: `translateY(${vItem.start}px)`,
                };
                if (row.kind === "collapse") {
                  return (
                    <CollapseRow
                      key={vItem.key}
                      count={row.count}
                      style={style}
                      onExpand={() => setExpandedCollapses(prev => new Set([...prev, row.startIdx]))}
                    />
                  );
                }
                // Find the filteredDiff index for pairMap lookup
                const fdIdx = filteredDiff.indexOf(row.line);
                return (
                  <DiffRow
                    key={vItem.key}
                    line={row.line}
                    style={style}
                    inlineCharDiff={inlineCharDiff}
                    pairText={pairMap.get(fdIdx)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty / idle state ──────────────────────────────────────────────── */}
      {(!canCompare || status === "idle") && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 gap-4">
          <div className="w-20 h-20 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground shadow-inner">
            <FileDiff size={36} />
          </div>
          <div className="max-w-sm">
            <h3 className="text-lg font-semibold mb-1">Compare Log Files</h3>
            <p className="text-sm text-muted-foreground">
              {loadedSessions.length < 2
                ? "Open at least two log files in separate tabs, then come back here to compare them."
                : "Select two sessions above to start the comparison."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
