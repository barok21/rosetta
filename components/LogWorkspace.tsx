import React, { useRef, useState, useEffect, useCallback } from "react";
import { useLogFile, LogEntry } from "@/hooks/useLogFile";
import { buttonVariants } from "@/components/ui/button";
import { FileText, Upload, Search, ArrowRightLeft, Code2 } from "lucide-react";

import { LogTable } from "@/components/LogTable";
import { cn } from "@/lib/utils";
import { LogToolbar } from "@/components/LogToolbar";
import { AdvancedFiltersSheet } from "@/components/AdvancedFiltersSheet";
import { LogDetailsModal } from "@/components/LogDetailsModal";
import { Base64ConverterModal } from "@/components/Base64ConverterModal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger
} from "@/components/ui/attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

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
    uniqueTypes, uniqueStatuses, metadataKeys, uniqueMetadataValues,
    metadataFilters, setMetadataFilters,
    isRegex, setIsRegex,
    excludeQuery, setExcludeQuery,
    searchOperator, setSearchOperator,
    currentMatchIndex, setCurrentMatchIndex,
    searchMatches,
    statusFilter, setStatusFilter,
    levelStats,
    filteredLogs, currentLogs,
    handleFileUpload, clearLog, clearFilters
  } = useLogFile(sessionFile);

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [base64ConverterOpen, setBase64ConverterOpen] = useState(false);
  const [base64ConverterText, setBase64ConverterText] = useState("");
  
  // Selection Tooltip State
  const [selectionTooltip, setSelectionTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  const prevFilenameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (fileMeta?.name && fileMeta.name !== prevFilenameRef.current && onSessionReady) {
      prevFilenameRef.current = fileMeta.name;
      onSessionReady(fileMeta.name);
    }
  }, [fileMeta?.name, onSessionReady]);

  // Keyboard shortcuts and Selection logic
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        
        const selection = window.getSelection()?.toString().trim();
        if (selection) {
          setSearchQuery(selection);
        }
        
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        
        const selection = window.getSelection()?.toString().trim();
        if (selection) {
          setBase64ConverterText(selection);
        }
        
        setBase64ConverterOpen(true);
      }
      if (e.key === 'Escape') {
        if (selectedLog) setSelectedLog(null);
        else if (showAdvanced) setShowAdvanced(false);
        setSelectionTooltip(null);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text && text.length > 0 && selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            setSelectionTooltip(null);
            return;
          }

          setSelectionTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            text
          });
        } else {
          setSelectionTooltip(null);
        }
      }, 10);
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || !selection.toString().trim()) {
        setSelectionTooltip(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isActive, selectedLog, showAdvanced, setSearchQuery]);

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

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

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
          uniqueStatuses={uniqueStatuses}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
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
          onOpenBase64Converter={() => setBase64ConverterOpen(true)}
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
        {logs.length === 0 || loadingStatus ? (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-muted/10 p-6"
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <div className="mx-auto w-full max-w-sm">
              <Attachment 
                className={cn(
                  "w-full relative shadow-sm transition-colors bg-card",
                  isDragging ? "border-primary border-2 scale-105 shadow-primary/20" : "hover:border-primary/50"
                )}
                state={loadingStatus ? "processing" : "idle"}
              >
                <AttachmentMedia className="h-10 w-10">
                  {loadingStatus ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  ) : (
                    <FileText className="text-primary" />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{loadingStatus ? "Processing Log File..." : "Import Log File"}</AttachmentTitle>
                  <AttachmentDescription>
                    {loadingStatus ? loadingStatus : "Click to browse .log or .txt files"}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  {!loadingStatus && (
                    <AttachmentAction aria-label="Upload File">
                      <Upload />
                    </AttachmentAction>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger 
                      render={
                        <AttachmentAction aria-label="More options">
                          <MoreVertical size={16} />
                        </AttachmentAction>
                      } 
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>Load Sample Data</DropdownMenuItem>
                        <DropdownMenuItem>View Documentation</DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </AttachmentActions>
                {!loadingStatus && (
                  <AttachmentTrigger 
                    render={
                      <label 
                        htmlFor={`fileInputEmpty-${sessionFile?.name || 'new'}`} 
                        className="cursor-pointer"
                        aria-label="Browse for log files" 
                      />
                    } 
                  />
                )}
              </Attachment>
              <input 
                type="file" 
                id={`fileInputEmpty-${sessionFile?.name || 'new'}`}
                className="hidden" 
                accept=".log,.txt,text/plain" 
                onChange={onFileInputChange}
              />
            </div>
          </div>
        ) : (filteredLogs.length === 0 || (searchQuery && searchMatches.length === 0)) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/10 p-6 text-center animate-in fade-in zoom-in-95 duration-300 z-10">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-inner border border-border/50">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">No matches found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {searchQuery && searchMatches.length === 0 
                ? `We couldn't find any logs matching "${searchQuery}".`
                : "We couldn't find any logs matching your current active filters."}
            </p>
            <button 
              onClick={clearFilters}
              className={buttonVariants({ variant: "outline", className: "shadow-sm hover:shadow" })}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex-1 overflow-hidden flex flex-col">
                <LogTable 
                  logs={currentLogs}
                  searchQuery={searchQuery}
                  isRegex={isRegex}
                  getLevelColor={getLevelColor}
                  onViewDetails={setSelectedLog}
                  currentMatchIndex={currentMatchIndex}
                  searchMatches={searchMatches}
                  currentPage={currentPage}
                  pageSize={1000}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
              <ContextMenuItem 
                onClick={() => {
                  const selected = window.getSelection()?.toString();
                  if (selected) {
                    setBase64ConverterText(selected);
                    setBase64ConverterOpen(true);
                  }
                }}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Convert Base64 from Selection
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
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
        
        {logs.length > 0 && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button 
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className="font-medium whitespace-nowrap px-2">Page {currentPage} of {totalPages}</span>
            <button 
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </footer>

      <LogDetailsModal 
        selectedLog={selectedLog}
        setSelectedLog={setSelectedLog}
        searchQuery={searchQuery}
        isRegex={isRegex}
        copied={copied}
        handleCopyPayload={handleCopyPayload}
      />

      <Base64ConverterModal
        isOpen={base64ConverterOpen}
        onOpenChange={setBase64ConverterOpen}
        initialText={base64ConverterText}
      />
      
      {/* Floating Selection Tooltip */}
      {selectionTooltip && (
        <div 
          className="fixed z-[100] transform -translate-x-1/2 -translate-y-full bg-primary text-primary-foreground p-1 rounded-md shadow-lg text-xs font-medium flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200"
          style={{ left: selectionTooltip.x, top: selectionTooltip.y - 8 }}
        >
          <button
            className="flex items-center gap-2 hover:bg-primary-foreground/20 px-2 py-1 rounded transition-colors"
            onClick={() => {
              setSearchQuery(selectionTooltip.text);
              searchInputRef.current?.focus();
              setSelectionTooltip(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Search size={12} />
            <span>Search</span>
            <span className="opacity-60 text-[10px] ml-1">Ctrl+F</span>
          </button>
          <div className="w-px h-4 bg-primary-foreground/30" />
          <button
            className="flex items-center gap-2 hover:bg-primary-foreground/20 px-2 py-1 rounded transition-colors"
            onClick={() => {
              setBase64ConverterText(selectionTooltip.text);
              setBase64ConverterOpen(true);
              setSelectionTooltip(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Code2 size={12} />
            <span>Decode</span>
            <span className="opacity-60 text-[10px] ml-1">Ctrl+D</span>
          </button>
        </div>
      )}
    </div>
  );
}
