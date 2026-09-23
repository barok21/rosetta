import React, { useRef, useState, useEffect } from "react";
import { LogEntry } from "@/hooks/useLogFile";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";

import { highlightText, formatReadableDate } from "@/lib/highlight";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useVirtualizer } from "@tanstack/react-virtual";

const MemoizedLogRow = React.memo(function LogRow({ 
  log, searchQuery, isRegex, getLevelColor, onViewDetails, style, index, measureRef
}: { 
  log: LogEntry; 
  searchQuery: string; 
  isRegex: boolean; 
  getLevelColor: (level: string) => string;
  onViewDetails: (log: LogEntry) => void;
  style: React.CSSProperties;
  index: number;
  measureRef: (node: Element | null) => void;
}) {
  return (
    <div 
      ref={measureRef}
      data-index={index}
      id={`log-row-${log.lineNumber}`}
      className="hover:bg-muted/50 transition-colors group absolute top-0 left-0 w-full flex border-b py-2"
      style={style}
    >
      <div className="w-[60px] text-right text-muted-foreground flex-shrink-0 pr-4">{log.lineNumber}</div>
      <div className="w-[180px] whitespace-nowrap flex-shrink-0 pr-4">
        <div className="font-medium">{formatReadableDate(log.timestamp)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{log.timestamp}</div>
      </div>
      <div className={`w-[80px] flex-shrink-0 pr-4 ${getLevelColor(log.level)}`}>{log.level.toUpperCase()}</div>
      <div className="w-[140px] text-muted-foreground flex-shrink-0 truncate pr-4" title={log.type}>{log.type}</div>
      <div className="flex-1 break-all relative min-w-0 pr-2">
        <ErrorBoundary fallback={<div className="text-red-400 text-xs">Error rendering message</div>}>
          <div className="p-2 bg-muted/30 rounded whitespace-pre-wrap">
            {highlightText(log.message, searchQuery, isRegex)}
          </div>
        </ErrorBoundary>
        <div className="mt-2 flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => onViewDetails(log)}
          >
            <FileText size={12} />
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
});

interface LogTableProps {
  logs: LogEntry[];
  searchQuery: string;
  isRegex: boolean;
  getLevelColor: (level: string) => string;
  onViewDetails: (log: LogEntry) => void;
  currentMatchIndex: number;
  searchMatches: number[];
  currentPage: number;
  pageSize: number;
}

export function LogTable({
  logs,
  searchQuery,
  isRegex,
  getLevelColor,
  onViewDetails,
  currentMatchIndex,
  searchMatches,
  currentPage,
  pageSize
}: LogTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 5,
  });

  // Scroll to search match
  useEffect(() => {
    if (searchMatches.length > 0 && searchQuery) {
      const absoluteIdx = searchMatches[currentMatchIndex];
      const relativeIdx = absoluteIdx - (currentPage - 1) * pageSize;
      
      if (relativeIdx >= 0 && relativeIdx < logs.length) {
        rowVirtualizer.scrollToIndex(relativeIdx, { align: 'center' });
        
        // Add highlight flash
        setTimeout(() => {
          const log = logs[relativeIdx];
          if (log) {
            const el = document.getElementById(`log-row-${log.lineNumber}`);
            if (el) {
              el.classList.add('bg-primary/20', 'transition-colors', 'duration-500');
              setTimeout(() => el.classList.remove('bg-primary/20'), 1000);
            }
          }
        }, 100);
      }
    }
  }, [currentMatchIndex, searchMatches, searchQuery, rowVirtualizer, logs, currentPage, pageSize]);

  return (
    <div 
      className="flex-1 overflow-auto bg-background" 
      ref={parentRef}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div className="font-mono text-xs block w-full border-b">
        <div className="sticky top-0 bg-card z-20 shadow-sm block w-full border-b">
          <div className="flex w-full text-muted-foreground font-medium p-2">
            <div className="w-[60px] text-right flex-shrink-0 pr-4">#</div>
            <div className="w-[180px] flex-shrink-0 pr-4">Timestamp</div>
            <div className="w-[80px] flex-shrink-0 pr-4">Level</div>
            <div className="w-[140px] flex-shrink-0 pr-4">Type</div>
            <div className="flex-1">Message / Details</div>
          </div>
        </div>
        <div 
          className="block relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const log = logs[virtualRow.index];
            return (
              <MemoizedLogRow
                key={log.lineNumber}
                index={virtualRow.index}
                log={log}
                searchQuery={searchQuery}
                isRegex={isRegex}
                getLevelColor={getLevelColor}
                onViewDetails={onViewDetails}
                measureRef={rowVirtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
