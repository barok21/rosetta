import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLogFile, LogEntry } from "@/hooks/useLogFile";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

import { LogTable } from "@/components/LogTable";
import { LogToolbar } from "@/components/LogToolbar";
import { AdvancedFiltersSheet } from "@/components/AdvancedFiltersSheet";
import { LogDetailsModal } from "@/components/LogDetailsModal";

interface LogWorkspaceProps {
  sessionFile: File | null;
  isActive: boolean;
  onSessionReady?: (filename: string) => void;
}

export function LogWorkspace({ sessionFile, isActive, onSessionReady }: LogWorkspaceProps) {
  const {
    logs, fileMeta, loadingStatus,
    levelFilter, setLevelFilter,
    typeFilter, setTypeFilter,
    searchQuery, setSearchQuery,
    startDate, setStartDate,
    endDate, setEndDate,
    currentPage, setCurrentPage, totalPages,
    uniqueTypes, metadataKeys, uniqueMetadataValues,
    metadataFilters, setMetadataFilters,
    isRegex, setIsRegex,
    excludeQuery, setExcludeQuery,
    searchOperator, setSearchOperator,
    currentMatchIndex, setCurrentMatchIndex,
    searchMatches,
    levelStats,
    filteredLogs, currentLogs,
    handleFileUpload, clearLog, clearFilters
  } = useLogFile(sessionFile);

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const prevFilenameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (fileMeta?.name && fileMeta.name !== prevFilenameRef.current && onSessionReady) {
      prevFilenameRef.current = fileMeta.name;
      onSessionReady(fileMeta.name);
    }
  }, [fileMeta?.name, onSessionReady]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (selectedLog) setSelectedLog(null);
        else if (showAdvanced) setShowAdvanced(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, selectedLog, showAdvanced]);

  const handleCopyPayload = useCallback(() => {
    if (!selectedLog) return;
    const text = typeof selectedLog.rawPayload === 'string' 
      ? selectedLog.rawPayload 
      : JSON.stringify(selectedLog.rawPayload, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedLog]);

  const hasActiveFilters = 
    levelFilter !== 'ALL' || 
    typeFilter !== 'ALL' || 
    searchQuery !== '' || 
    startDate !== undefined || 
    endDate !== undefined || 
    excludeQuery !== '' || 
    Object.values(metadataFilters).some(v => v !== 'ALL');

  const handleExportLogs = useCallback(() => {
    const data = filteredLogs.map(log => ({
      lineNumber: log.lineNumber,
      timestamp: log.timestamp,
      level: log.level,
      type: log.type,
      message: log.message,
      rawPayload: log.rawPayload,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const handleSearchTraverse = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return;
    let nextIndex = currentMatchIndex + (direction === 'next' ? 1 : -1);
    if (nextIndex >= searchMatches.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = searchMatches.length - 1;
    setCurrentMatchIndex(nextIndex);
    
    const targetFilteredIdx = searchMatches[nextIndex];
    const targetPage = Math.floor(targetFilteredIdx / 1000) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchTraverse(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleSearchTraverse('next');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleSearchTraverse('prev');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500 font-semibold';
      case 'warn': return 'text-amber-500 font-semibold';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-purple-500';
      case 'fatal': return 'text-red-700 font-bold';
      default: return 'text-muted-foreground';
    }
  };

  // We wrap handleFileUpload so it can extract File from Event, because toolbar empty state passes Event
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  return (
    <div className={isActive ? "flex-1 flex flex-col overflow-hidden bg-background relative" : "hidden"}>
      {/* Toolbar */}
      {logs.length > 0 && (
        <LogToolbar 
          logs={logs}
          levelFilter={levelFilter}
          setLevelFilter={setLevelFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          uniqueTypes={uniqueTypes}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isRegex={isRegex}
          setIsRegex={setIsRegex}
          searchMatches={searchMatches}
          currentMatchIndex={currentMatchIndex}
          filteredLogsLength={filteredLogs.length}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
          handleExportLogs={handleExportLogs}
          handleSearchKeyDown={handleSearchKeyDown}
          handleFileUpload={onFileInputChange}
          searchInputRef={searchInputRef}
        />
      )}

      {/* Advanced Filters Sheet */}
      <AdvancedFiltersSheet 
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        searchOperator={searchOperator}
        setSearchOperator={setSearchOperator}
        excludeQuery={excludeQuery}
        setExcludeQuery={setExcludeQuery}
        metadataKeys={metadataKeys}
        uniqueMetadataValues={uniqueMetadataValues}
        metadataFilters={metadataFilters}
        setMetadataFilters={setMetadataFilters}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-background">
        {loadingStatus ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p>{loadingStatus}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/10 p-6">
            <div className="max-w-md w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-primary/30 rounded-3xl bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-300 hover:border-primary/60 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              
              <div className="relative z-10 w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform duration-500 ease-out shadow-inner">
                <FileText size={48} className="drop-shadow-md opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h2 className="relative z-10 text-2xl font-bold text-foreground mb-3 tracking-tight group-hover:text-primary transition-colors duration-300">No Log File Imported</h2>
              <p className="relative z-10 text-muted-foreground text-center mb-8 text-sm leading-relaxed">
                Select a local <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/80 font-medium">.log</span> or <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/80 font-medium">.txt</span> file to instantly visualize, filter, and analyze your structured log data.
              </p>
              
              <div className="relative z-10">
                <label htmlFor={`fileInputEmpty-${sessionFile?.name || 'new'}`} className={buttonVariants({ size: "lg", className: "cursor-pointer shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 rounded-full px-8 font-semibold tracking-wide" })}>
                  <Upload className="mr-2 h-5 w-5" /> Browse Files
                </label>
              </div>
              
              <input 
                type="file" 
                id={`fileInputEmpty-${sessionFile?.name || 'new'}`}
                className="hidden" 
                accept=".log,.txt,text/plain" 
                onChange={onFileInputChange}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <LogTable 
              logs={filteredLogs}
              searchQuery={searchQuery}
              isRegex={isRegex}
              getLevelColor={getLevelColor}
              onViewDetails={setSelectedLog}
              currentMatchIndex={currentMatchIndex}
              searchMatches={searchMatches}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-2 border-t bg-card text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{fileMeta ? `${fileMeta.name} — ${logs.length.toLocaleString()} lines — ${fileMeta.sizeMB} MB` : 'Ready'}</span>
          {logs.length > 0 && (
            <div className="flex items-center gap-4 ml-4 border-l pl-4 border-border/60">
              {/* Segmented Visual Bar */}
              <div className="flex w-32 h-2 rounded-full overflow-hidden bg-muted/50 border border-border/30 shadow-inner">
                {levelStats.fatal > 0 && <div style={{ width: `${Math.max(1, (levelStats.fatal / logs.length) * 100)}%` }} className="bg-red-700 hover:opacity-80 transition-opacity" title={`Fatal: ${levelStats.fatal}`} />}
                {levelStats.error > 0 && <div style={{ width: `${Math.max(1, (levelStats.error / logs.length) * 100)}%` }} className="bg-red-500 hover:opacity-80 transition-opacity" title={`Error: ${levelStats.error}`} />}
                {levelStats.warn > 0 && <div style={{ width: `${Math.max(1, (levelStats.warn / logs.length) * 100)}%` }} className="bg-amber-500 hover:opacity-80 transition-opacity" title={`Warning: ${levelStats.warn}`} />}
                {levelStats.info > 0 && <div style={{ width: `${Math.max(1, (levelStats.info / logs.length) * 100)}%` }} className="bg-blue-500 hover:opacity-80 transition-opacity" title={`Info: ${levelStats.info}`} />}
                {levelStats.debug > 0 && <div style={{ width: `${Math.max(1, (levelStats.debug / logs.length) * 100)}%` }} className="bg-purple-500 hover:opacity-80 transition-opacity" title={`Debug: ${levelStats.debug}`} />}
              </div>
              
              {/* Clean Stats with Dots */}
              <div className="flex items-center gap-3.5 font-medium tracking-wide">
                {levelStats.fatal > 0 && <span className="text-red-700 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-700"></div>{levelStats.fatal.toLocaleString()}</span>}
                {levelStats.error > 0 && <span className="text-red-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"></div>{levelStats.error.toLocaleString()}</span>}
                {levelStats.warn > 0 && <span className="text-amber-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"></div>{levelStats.warn.toLocaleString()}</span>}
                {levelStats.info > 0 && <span className="text-blue-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]"></div>{levelStats.info.toLocaleString()}</span>}
                {levelStats.debug > 0 && <span className="text-purple-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.5)]"></div>{levelStats.debug.toLocaleString()}</span>}
              </div>
            </div>
          )}
        </div>
      </footer>

      <LogDetailsModal 
        selectedLog={selectedLog}
        setSelectedLog={setSelectedLog}
        searchQuery={searchQuery}
        isRegex={isRegex}
        copied={copied}
        handleCopyPayload={handleCopyPayload}
      />
    </div>
  );
}
