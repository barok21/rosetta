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
  message: string;
  rawPayload: Record<string, unknown> | null;
}

export function parseStructuredLog(lineStr: string, index: number): LogEntry {
  let parsed: LogEntry = {
    originalLine: lineStr,
    lineNumber: index + 1,
    timestamp: '-',
    timeValue: 0,
    level: 'unknown',
    type: '-',
    message: '',
    rawPayload: null,
  };

  try {
    const logfmt: any = {};
    let remainingStr = lineStr;

    // First, extract the problematic `log="{...}"` field which contains unescaped quotes
    const logMatch = lineStr.match(/log="({.*?})"(?:\s[a-zA-Z0-9_.-]+=| \s*$|$)/);
    if (logMatch) {
      let val = logMatch[1];
      // Do not manually unescape here, let JSON.parse handle the standard stringified JSON
      try {
        logfmt.log = JSON.parse(val);
      } catch(e) {
        logfmt.log = val;
      }
      // Remove it from the string so we can parse the rest easily
      remainingStr = lineStr.replace(logMatch[0], '');
    }

    // Parse the remaining standard logfmt fields (e.g. compose_service="...", cluster="...")
    const regex = /([a-zA-Z0-9_.-]+)=("[^"]*"|[^ ]+)/g;
    let match;
    let hasPairs = Object.keys(logfmt).length > 0;

    while ((match = regex.exec(remainingStr)) !== null) {
      hasPairs = true;
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

    if (hasPairs) {
      // If logfmt.log itself contains another stringified 'log', unwrap it
      if (logfmt.log && typeof logfmt.log === 'object' && typeof logfmt.log.log === 'string') {
        try { logfmt.log.log = JSON.parse(logfmt.log.log); } catch(e) {}
      }

      parsed.rawPayload = logfmt;
      
      let payload = logfmt;
      if (logfmt.log && typeof logfmt.log === 'object') {
        payload = logfmt.log;
        if (payload.log && typeof payload.log === 'object') {
          payload = payload.log;
        }
      }

      parsed.timestamp = payload.timestamp || payload.time || logfmt.time || '-';
      parsed.timeValue = parsed.timestamp !== '-' ? new Date(parsed.timestamp).getTime() : 0;
      
      let lvl = (payload.level || 'unknown').toLowerCase();
      if (lvl === 'warning') lvl = 'warn';
      parsed.level = lvl;
      
      parsed.type = payload.type || '-';
      parsed.message = payload.detail ? JSON.stringify(payload.detail, null, 2) : (payload.message || payload.msg || JSON.stringify(payload, null, 2));

    } else {
      // Fallback: try parsing line as pure JSON
      try {
        const json = JSON.parse(lineStr);
        parsed.rawPayload = json;
        parsed.timestamp = json.timestamp || json.time || '-';
        parsed.timeValue = parsed.timestamp !== '-' ? new Date(parsed.timestamp).getTime() : 0;
        
        let lvl = (json.level || 'unknown').toLowerCase();
        if (lvl === 'warning') lvl = 'warn';
        if (lvl === 'unknown' && json.stream === 'stderr') lvl = 'error';
        parsed.level = lvl;
        
        parsed.type = json.type || '-';
        parsed.message = json.detail ? JSON.stringify(json.detail, null, 2) : (json.message || json.msg || JSON.stringify(json, null, 2));
      } catch(e) {
        parsed.message = lineStr;
        parsed.rawPayload = { raw: lineStr };
      }
    }

    // Fallback level detection
    if (parsed.level === 'unknown') {
      if (lineStr.match(/\bERROR\b/i)) parsed.level = 'error';
      else if (lineStr.match(/\bWARN\b/i)) parsed.level = 'warn';
      else if (lineStr.match(/\bINFO\b/i)) parsed.level = 'info';
      else if (lineStr.match(/\bDEBUG\b/i)) parsed.level = 'debug';
      else if (lineStr.match(/\bFATAL\b/i)) parsed.level = 'fatal';
    }
  } catch (e) {
    parsed.message = lineStr;
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
      
      const displayLines = lines.slice(0, 50000);
      
      setLoadingStatus(`Parsing ${file.name} in background...`);
      
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
    const metaVals: Record<string, Set<string>> = {};
    
    logs.forEach(log => {
      if (log.type && log.type !== '-') types.add(log.type);
      
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
      metadataKeys: Object.keys(uniqueMeta).sort(),
      uniqueMetadataValues: uniqueMeta
    };
  }, [logs]);
  const { uniqueTypes, metadataKeys, uniqueMetadataValues } = metadataInfo;

  const filteredLogs = useMemo(() => {
    const sDate = startDate ? startDate.getTime() : null;
    const eDate = endDate ? endDate.getTime() : null;
    const l = levelFilter.toLowerCase();
    
    let excludeRegex: RegExp | null = null;
    
    if (isRegex) {
      try { if (excludeQuery) excludeRegex = new RegExp(excludeQuery, 'i'); } catch(e){}
    }
    const eq = excludeQuery.toLowerCase();
    
    return logs.filter(log => {
      if (l !== 'all' && !log.level.includes(l)) return false;
      if (typeFilter !== 'ALL' && log.type !== typeFilter) return false;
      if (sDate && log.timeValue > 0 && log.timeValue < sDate) return false;
      if (eDate && log.timeValue > 0 && log.timeValue > eDate) return false;
      
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
  }, [logs, levelFilter, typeFilter, startDate, endDate, isRegex, excludeQuery, metadataFilters]);

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
    filteredLogs,
    currentLogs,
    handleFileUpload,
    clearLog,
    clearFilters
  };
}
