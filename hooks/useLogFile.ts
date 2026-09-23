import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDebounce } from './useDebounce';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'fatal' | 'unknown';

export interface LogEntry {
  originalLine: string;
  lineNumber: number;
  timestamp: string;
  timeValue: number;
  level: LogLevel;
  type: string;
  status: string;
  message: string;
  rawPayload: Record<string, unknown> | null;
}

function extractLogfmt(str: string): Record<string, any> {
  const logfmt: Record<string, any> = {};
  let remainingStr = str;
  const logMatch = str.match(/log="({.*?})"(?:\s[a-zA-Z0-9_.-]+=| \s*$|$)/);
  if (logMatch) {
    let val = logMatch[1];
    try { logfmt.log = JSON.parse(val); } catch(e) { logfmt.log = val; }
    remainingStr = str.replace(logMatch[0], '');
  }
  const regex = /([a-zA-Z0-9_.-]+)=("[^"]*"|[^ ]+)/g;
  let match;
  while ((match = regex.exec(remainingStr)) !== null) {
    const key = match[1];
    let val = match[2];
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    if (val.startsWith('{') || val.startsWith('[')) {
      try { val = JSON.parse(val); } catch (e) {}
    }
    logfmt[key] = val;
  }
  return logfmt;
}

export function parseStructuredLog(lineStr: string, index: number): LogEntry {
  let parsed: LogEntry = {
    originalLine: lineStr,
    lineNumber: index + 1,
    timestamp: '-',
    timeValue: 0,
    level: 'unknown',
    type: '-',
    status: '-',
    message: '',
    rawPayload: null,
  };

  const trimLine = lineStr.trim();
  let jsonPayload: any = null;

  if (trimLine.startsWith('{') || trimLine.startsWith('[')) {
    try { jsonPayload = JSON.parse(trimLine); } catch(e) {}
  }

  if (jsonPayload && typeof jsonPayload === 'object') {
    if (typeof jsonPayload.log === 'string' && jsonPayload.log.includes('=')) {
       const logfmt = extractLogfmt(jsonPayload.log);
       if (Object.keys(logfmt).length > 0) jsonPayload.parsedLog = logfmt;
    }
    parsed.rawPayload = jsonPayload;
    const innerLog = jsonPayload.parsedLog || {};
    parsed.timestamp = jsonPayload.timestamp || jsonPayload.time || innerLog.timestamp || innerLog.time || '-';
    parsed.timeValue = parsed.timestamp !== '-' ? new Date(parsed.timestamp).getTime() : 0;
    
    let lvl = (jsonPayload.level || innerLog.level || 'unknown').toLowerCase();
    if (lvl === 'warning') lvl = 'warn';
    if (lvl === 'unknown' && jsonPayload.stream === 'stderr') lvl = 'error';
    parsed.level = lvl;
    
    parsed.type = jsonPayload.type || innerLog.type || '-';
    parsed.message = jsonPayload.detail ? JSON.stringify(jsonPayload.detail, null, 2) : 
                     (jsonPayload.message || jsonPayload.msg || innerLog.message || innerLog.msg || (typeof jsonPayload.log === 'string' ? jsonPayload.log : JSON.stringify(jsonPayload, null, 2)));
  } else {
    const logfmt = extractLogfmt(lineStr);
    if (Object.keys(logfmt).length > 0) {
      parsed.rawPayload = logfmt;
      parsed.timestamp = logfmt.timestamp || logfmt.time || '-';
      parsed.timeValue = parsed.timestamp !== '-' ? new Date(parsed.timestamp).getTime() : 0;
      let lvl = (logfmt.level || 'unknown').toLowerCase();
      if (lvl === 'warning') lvl = 'warn';
      parsed.level = lvl;
      parsed.type = logfmt.type || '-';
      parsed.message = logfmt.detail ? JSON.stringify(logfmt.detail, null, 2) : (logfmt.message || logfmt.msg || JSON.stringify(logfmt, null, 2));
    } else {
      parsed.message = lineStr;
      parsed.rawPayload = { raw: lineStr };
    }
  }

  if (parsed.level === 'unknown') {
    if (lineStr.match(/\bERROR\b/i)) parsed.level = 'error';
    else if (lineStr.match(/\bWARN\b/i) || lineStr.match(/\bWARNING\b/i)) parsed.level = 'warn';
    else if (lineStr.match(/\bINFO\b/i)) parsed.level = 'info';
    else if (lineStr.match(/\bDEBUG\b/i)) parsed.level = 'debug';
    else if (lineStr.match(/\bFATAL\b/i)) parsed.level = 'fatal';
  }

  return parsed;
}

export function useLogFile(initialFile: File | null = null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fileMeta, setFileMeta] = useState<{name: string, sizeMB: string} | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  
  // Filters
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Advanced Filters
  const [isRegex, setIsRegex] = useState(false);
  const [excludeQuery, setExcludeQuery] = useState('');
  const [searchOperator, setSearchOperator] = useState<'AND'|'OR'>('AND');
  const [metadataFilters, setMetadataFilters] = useState<Record<string, string>>({});
  
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 1000;

  const handleFileUpload = useCallback((file: File | undefined) => {
    if (!file) return;

    setFileMeta({ name: file.name, sizeMB: (file.size / 1024 / 1024).toFixed(2) });
    setLoadingStatus(`Loading ${file.name}...`);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/);
      
      // We filter out any empty trailing lines
      const displayLines = lines.filter(line => line.trim().length > 0);
      
      setLoadingStatus(`Parsing ${displayLines.length.toLocaleString()} lines in background...`);
      
      // Instantiate Web Worker
      const worker = new Worker(new URL('../workers/logParser.worker.ts', import.meta.url));
      
      worker.onmessage = (e) => {
        const { parsedLogs } = e.data;
        setLogs(parsedLogs);
        setLoadingStatus(null);
        setCurrentPage(1);
        worker.terminate();
      };
      
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setLoadingStatus('Error parsing file');
        worker.terminate();
      };
      
      worker.postMessage({ lines: displayLines, startIndex: 0 });
    };
    reader.readAsText(file);
  }, []);

  useEffect(() => {
    if (initialFile) {
      handleFileUpload(initialFile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount if initialFile is provided

  const clearLog = useCallback(() => {
    setLogs([]);
    setFileMeta(null);
    setLoadingStatus(null);
    setLevelFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setExcludeQuery('');
    setMetadataFilters({});
    setCurrentPage(1);
    setCurrentMatchIndex(0);
    setIsRegex(false);
  }, []);

  const clearFilters = useCallback(() => {
    setLevelFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setExcludeQuery('');
    setMetadataFilters({});
    setCurrentPage(1);
    setCurrentMatchIndex(0);
    setIsRegex(false);
  }, []);

  const metadataInfo = useMemo(() => {
    const types = new Set<string>();
    const statuses = new Set<string>();
    const metaVals: Record<string, Set<string>> = {};
    
    logs.forEach(log => {
      if (log.type && log.type !== '-') types.add(log.type);
      if (log.status && log.status !== '-') statuses.add(log.status);
      
      if (log.rawPayload && typeof log.rawPayload === 'object' && !Array.isArray(log.rawPayload)) {
        Object.entries(log.rawPayload).forEach(([k, v]) => {
          if (typeof v === 'string' && !['log', 'message', 'time', 'timestamp', 'level', 'type', 'detail', 'raw'].includes(k)) {
            if (!metaVals[k]) metaVals[k] = new Set();
            metaVals[k].add(v);
          }
        });
      }
    });
    
    const uniqueMeta: Record<string, string[]> = {};
    Object.keys(metaVals).forEach(k => {
      if (metaVals[k].size <= 50) {
          uniqueMeta[k] = Array.from(metaVals[k]).sort();
      }
    });
    
    return {
      uniqueTypes: Array.from(types).sort(),
      uniqueStatuses: Array.from(statuses).sort(),
      metadataKeys: Object.keys(uniqueMeta).sort(),
      uniqueMetadataValues: uniqueMeta
    };
  }, [logs]);
  const { uniqueTypes, uniqueStatuses, metadataKeys, uniqueMetadataValues } = metadataInfo;

  const filteredLogs = useMemo(() => {
    const sDate = startDate ? startDate.getTime() : null;
    const eDate = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;
    const l = levelFilter.toLowerCase();
    
    let excludeRegex: RegExp | null = null;
    
    if (isRegex) {
      try { if (excludeQuery) excludeRegex = new RegExp(excludeQuery, 'i'); } catch(e){}
    }
    const eq = excludeQuery.toLowerCase();
    
    return logs.filter(log => {
      if (l !== 'all' && !log.level.includes(l)) return false;
      if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
      if (sDate && eDate && log.timeValue > 0) {
        if (log.timeValue < sDate || log.timeValue > eDate) return false;
      }
      
      for (const [mk, mv] of Object.entries(metadataFilters)) {
        if (mv !== 'ALL') {
          if (!log.rawPayload || log.rawPayload[mk] !== mv) return false;
        }
      }
      
      const text = (log.message + ' ' + log.originalLine).toLowerCase();
      
      let hasExcludeMatch = false;
      if (excludeQuery) {
        if (isRegex && excludeRegex) {
            hasExcludeMatch = excludeRegex.test(text);
        } else {
            const eTerms = eq.split(',').map(s => s.trim()).filter(Boolean);
            hasExcludeMatch = eTerms.some(t => text.includes(t));
        }
      }
      if (hasExcludeMatch) return false;
      
      return true;
    });
  }, [logs, levelFilter, typeFilter, statusFilter, startDate, endDate, isRegex, excludeQuery, metadataFilters]);

  const debouncedSearchQuery = useDebounce(searchQuery, 250);

  const searchMatches = useMemo(() => {
    if (!debouncedSearchQuery) return [];
    
    let searchRegex: RegExp | null = null;
    if (isRegex) {
      try { searchRegex = new RegExp(debouncedSearchQuery, 'i'); } catch(e){}
    }
    const sq = debouncedSearchQuery.toLowerCase();
    
    const matches: number[] = [];
    
    filteredLogs.forEach((log, index) => {
      const text = (log.message + ' ' + log.originalLine).toLowerCase();
      let hasSearchMatch = false;
      
      if (isRegex && searchRegex) {
          hasSearchMatch = searchRegex.test(text);
      } else {
          const terms = sq.split(',').map(s => s.trim()).filter(Boolean);
          if (searchOperator === 'AND') {
              hasSearchMatch = terms.every(t => text.includes(t));
          } else {
              hasSearchMatch = terms.some(t => text.includes(t));
          }
      }
      
      if (hasSearchMatch) {
        matches.push(index);
      }
    });
    
    return matches;
  }, [filteredLogs, debouncedSearchQuery, isRegex, searchOperator]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, isRegex, searchOperator]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  
  // Reset page when filters change if we are out of bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Log level statistics
  const levelStats = useMemo(() => {
    const stats = { error: 0, warn: 0, info: 0, debug: 0, fatal: 0, unknown: 0 };
    filteredLogs.forEach(log => {
      if (log.level in stats) stats[log.level as keyof typeof stats]++;
      else stats.unknown++;
    });
    return stats;
  }, [filteredLogs]);

  const currentLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  return {
    logs,
    fileMeta,
    loadingStatus,
    levelFilter, setLevelFilter,
    typeFilter, setTypeFilter,
    statusFilter, setStatusFilter,
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
    levelStats,
    filteredLogs,
    currentLogs,
    handleFileUpload,
    clearLog,
    clearFilters
  };
}
