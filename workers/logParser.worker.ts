import { LogLevel } from '../hooks/useLogFile';

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
      parsed.level = payload.level ? payload.level.toLowerCase() : 'unknown';
      parsed.type = payload.type || '-';
      parsed.message = payload.detail ? JSON.stringify(payload.detail, null, 2) : (payload.message || JSON.stringify(payload, null, 2));

    } else {
      // Fallback: try parsing line as pure JSON
      try {
        const json = JSON.parse(lineStr);
        parsed.rawPayload = json;
        parsed.timestamp = json.timestamp || json.time || '-';
        parsed.timeValue = parsed.timestamp !== '-' ? new Date(parsed.timestamp).getTime() : 0;
        parsed.level = json.level ? json.level.toLowerCase() : 'unknown';
        parsed.type = json.type || '-';
        parsed.message = json.detail ? JSON.stringify(json.detail, null, 2) : (json.message || JSON.stringify(json, null, 2));
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

self.addEventListener('message', (event) => {
  const { lines, startIndex } = event.data;
  
  const parsedLogs = lines.map((line: string, index: number) => {
    return parseStructuredLog(line, startIndex + index);
  });
  
  self.postMessage({ parsedLogs });
});
