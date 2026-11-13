import { useState, useEffect, useRef } from 'react';
import type { LogEntry } from './useLogFile';

export type DiffLineType = 'equal' | 'insert' | 'delete';

export interface DiffLine {
  type: DiffLineType;
  lineA: number | null;
  lineB: number | null;
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

export type CompareStatus = 'idle' | 'running' | 'done' | 'error';

export function useLogCompare(logsA: LogEntry[], logsB: LogEntry[]) {
  const [status, setStatus] = useState<CompareStatus>('idle');
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [stats, setStats] = useState<CompareStats | null>(null);
  const [truncated, setTruncated] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Don't run if either side is empty
    if (logsA.length === 0 || logsB.length === 0) {
      setStatus('idle');
      setDiff([]);
      setStats(null);
      return;
    }

    // Terminate any running worker
    workerRef.current?.terminate();

    setStatus('running');
    setDiff([]);
    setStats(null);

    const worker = new Worker(
      new URL('../workers/logCompare.worker.ts', import.meta.url),
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data?.error) {
        setStatus('error');
        worker.terminate();
        workerRef.current = null;
        return;
      }
      const { stats: s, diff: d, truncated: t } = e.data;
      setStats(s);
      setDiff(d);
      setTruncated(t ?? false);
      setStatus('done');
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = () => {
      setStatus('error');
      worker.terminate();
      workerRef.current = null;
    };

    const linesA = logsA.map((l) => l.originalLine);
    const linesB = logsB.map((l) => l.originalLine);
    worker.postMessage({ linesA, linesB });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [logsA, logsB]);

  return { status, diff, stats, truncated };
}
