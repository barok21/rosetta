"use client";

import React, { useState, useMemo, useRef } from "react";
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

// ─── Session Selector ─────────────────────────────────────────────────────────

function SessionSelector({
  label,
  sessions,
  value,
  onChange,
  exclude,
}: {
  label: string;
  sessions: LogSession[];
  value: string;
  onChange: (id: string) => void;
  exclude: string;
}) {
  const selected = sessions.find((s) => s.id === value);
  const available = sessions.filter((s) => s.id !== exclude);

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full text-left cursor-pointer",
            "bg-card hover:bg-muted/60 border-border/60 hover:border-primary/40 shadow-sm",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <FileText size={14} className="text-muted-foreground shrink-0" />
            <span className="truncate">
              {selected ? selected.name : "Select a session…"}
            </span>
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
              <DropdownMenuItem
                key={s.id}
                onClick={() => onChange(s.id)}
                className={cn(
                  "flex items-center justify-between",
                  s.id === value && "bg-accent",
                )}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2 shrink-0">
                  {s.logs.length.toLocaleString()} lines
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "muted" | "green" | "red" | "blue" | "amber";
}) {
  const colorMap = {
    muted: "bg-muted/60 text-muted-foreground border-border/40",
    green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };
  return (
    <div
      className={cn(
        "flex flex-col items-center px-4 py-2 rounded-lg border text-center min-w-[80px]",
        colorMap[color],
      )}
    >
      <span className="text-lg font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-xs font-medium opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Diff Row ─────────────────────────────────────────────────────────────────

const DiffRow = React.memo(function DiffRow({
  line,
  style,
}: {
  line: DiffLine;
  style: React.CSSProperties;
}) {
  const isInsert = line.type === "insert";
  const isDelete = line.type === "delete";

  return (
    <div
      style={style}
      className={cn(
        "flex items-stretch text-xs font-mono border-b border-border/20 last:border-0",
        isInsert && "bg-emerald-500/8 hover:bg-emerald-500/12",
        isDelete && "bg-red-500/8 hover:bg-red-500/12",
        !isInsert && !isDelete && "hover:bg-muted/30",
      )}
    >
      {/* Gutter A */}
      <div
        className={cn(
          "w-14 shrink-0 text-right pr-3 py-1 select-none text-muted-foreground/50 border-r border-border/20",
          isDelete && "text-red-500/60 bg-red-500/5",
        )}
      >
        {line.lineA ?? ""}
      </div>
      {/* Gutter B */}
      <div
        className={cn(
          "w-14 shrink-0 text-right pr-3 py-1 select-none text-muted-foreground/50 border-r border-border/20",
          isInsert && "text-emerald-500/60 bg-emerald-500/5",
        )}
      >
        {line.lineB ?? ""}
      </div>
      {/* Sign */}
      <div
        className={cn(
          "w-6 shrink-0 flex items-center justify-center py-1 select-none font-bold border-r border-border/20",
          isInsert && "text-emerald-500 bg-emerald-500/8",
          isDelete && "text-red-500 bg-red-500/8",
          !isInsert && !isDelete && "text-muted-foreground/30",
        )}
      >
        {isInsert ? "+" : isDelete ? "−" : " "}
      </div>
      {/* Content */}
      <div
        className={cn(
          "flex-1 py-1 px-3 overflow-hidden text-ellipsis whitespace-nowrap",
          isInsert && "text-emerald-400",
          isDelete && "text-red-400",
          !isInsert && !isDelete && "text-foreground/70",
        )}
      >
        {line.text || <span className="text-muted-foreground/30 italic">empty line</span>}
      </div>
    </div>
  );
});

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function LogComparePanel({ sessions }: LogComparePanelProps) {
  const loadedSessions = sessions.filter((s) => s.logs.length > 0);

  const [sessionAId, setSessionAId] = useState<string>(
    loadedSessions[0]?.id ?? "",
  );
  const [sessionBId, setSessionBId] = useState<string>(
    loadedSessions[1]?.id ?? "",
  );
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");

  const sessionA = sessions.find((s) => s.id === sessionAId);
  const sessionB = sessions.find((s) => s.id === sessionBId);

  const logsA = useMemo(() => sessionA?.logs ?? [], [sessionA]);
  const logsB = useMemo(() => sessionB?.logs ?? [], [sessionB]);

  const { status, diff, stats, truncated } = useLogCompare(logsA, logsB);

  // Filtered diff lines
  const filteredDiff = useMemo(() => {
    if (diffFilter === "all") return diff;
    if (diffFilter === "diffs")
      return diff.filter((d) => d.type !== "equal");
    return diff.filter((d) => d.type === "equal");
  }, [diff, diffFilter]);

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = 24;
  const virtualizer = useVirtualizer({
    count: filteredDiff.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 20,
  });

  const handleExport = () => {
    const lines = diff
      .map((d) => {
        const prefix = d.type === "insert" ? "+" : d.type === "delete" ? "-" : " ";
        return `${prefix} ${d.text}`;
      })
      .join("\n");
    const header = [
      `--- ${sessionA?.name ?? "File A"} (${stats?.totalA.toLocaleString()} lines)`,
      `+++ ${sessionB?.name ?? "File B"} (${stats?.totalB.toLocaleString()} lines)`,
      "",
    ].join("\n");
    const blob = new Blob([header + lines], { type: "text/plain" });
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
          <SessionSelector
            label="File A  (base)"
            sessions={loadedSessions}
            value={sessionAId}
            onChange={setSessionAId}
            exclude={sessionBId}
          />

          {/* Swap button */}
          <button
            onClick={() => {
              const tmp = sessionAId;
              setSessionAId(sessionBId);
              setSessionBId(tmp);
            }}
            className="mb-0.5 p-2 rounded-lg border border-border/60 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Swap A and B"
          >
            <ArrowDownUp size={16} />
          </button>

          <SessionSelector
            label="File B  (compare)"
            sessions={loadedSessions}
            value={sessionBId}
            onChange={setSessionBId}
            exclude={sessionAId}
          />
        </div>

        {/* Summary banner + stats */}
        {canCompare && status === "done" && stats && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            {/* Banner */}
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg border font-medium text-sm",
                stats.identical
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-red-500/10 border-red-500/20 text-red-500",
              )}
            >
              {stats.identical ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Files are identical — every line matches.</span>
                </>
              ) : (
                <>
                  <XCircle size={18} />
                  <span>
                    {(stats.onlyA + stats.onlyB).toLocaleString()} difference
                    {stats.onlyA + stats.onlyB !== 1 ? "s" : ""} found
                    <span className="font-normal text-muted-foreground ml-1">
                      ({stats.onlyA.toLocaleString()} removed, {stats.onlyB.toLocaleString()} added)
                    </span>
                  </span>
                </>
              )}
              {truncated && (
                <span className="ml-auto flex items-center gap-1 text-amber-500 text-xs font-normal">
                  <AlertTriangle size={13} />
                  Large files — set-based comparison (order ignored)
                </span>
              )}
            </div>

            {/* Stat chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatChip label="Lines A" value={stats.totalA} color="blue" />
              <StatChip label="Lines B" value={stats.totalB} color="blue" />
              <StatChip label="Common" value={stats.common} color="green" />
              <StatChip label="Only in A" value={stats.onlyA} color="red" />
              <StatChip label="Only in B" value={stats.onlyB} color="amber" />

              <div className="ml-auto flex items-center gap-2">
                {/* Filter toggle */}
                <div className="flex items-center bg-muted/50 rounded-lg border border-border/40 p-0.5 text-xs">
                  {(["all", "diffs", "matches"] as DiffFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDiffFilter(f)}
                      className={cn(
                        "px-3 py-1 rounded-md transition-all font-medium capitalize",
                        diffFilter === f
                          ? "bg-background shadow-sm text-foreground border border-border/50"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f === "diffs" ? "Diffs only" : f === "matches" ? "Matches only" : "All"}
                    </button>
                  ))}
                </div>

                {!stats.identical && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-2 shadow-sm"
                  >
                    <FileDiff size={14} />
                    Export .patch
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Running state */}
        {canCompare && status === "running" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in">
            <Loader2 size={16} className="animate-spin" />
            Comparing {logsA.length.toLocaleString()} × {logsB.length.toLocaleString()} lines…
          </div>
        )}

        {/* Error state */}
        {canCompare && status === "error" && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <XCircle size={16} />
            Comparison failed. Try reloading the files.
          </div>
        )}
      </div>

      {/* ── Diff Table ───────────────────────────────────────────────────────── */}
      {canCompare && status === "done" && diff.length > 0 && (
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
          <div
            ref={parentRef}
            className="flex-1 overflow-auto"
            style={{ contain: "strict" }}
          >
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const line = filteredDiff[vItem.index];
                return (
                  <DiffRow
                    key={vItem.key}
                    line={line}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${vItem.size}px`,
                      transform: `translateY(${vItem.start}px)`,
                    }}
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
