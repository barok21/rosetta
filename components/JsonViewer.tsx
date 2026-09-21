import React from "react";
import { escapeRegExp, highlightSqlAndSearch } from "@/lib/highlight";

export function JsonViewer({ data, query, isRegex }: { data: any; query: string; isRegex: boolean }) {
  let jsonString = '';
  
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        jsonString = JSON.stringify(parsed, null, 2);
      } else {
        jsonString = data;
      }
    } catch (e) {
      jsonString = data;
    }
  } else {
    jsonString = JSON.stringify(data, null, 2) || '';
  }

  // Fallback if somehow it's still undefined
  if (typeof jsonString !== 'string') {
    jsonString = String(jsonString || '');
  }

  // If it's not actually formatted JSON, just do standard search highlighting
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
    if (!query) return <>{jsonString}</>;
    try {
      const safeQ = isRegex ? query : escapeRegExp(query);
      const parts = jsonString.split(new RegExp(`(${safeQ})`, 'gi'));
      return (
        <>
          {parts.map((part, i) => {
            if (!part) return null;
            const isMatch = isRegex ? new RegExp(`^${safeQ}$`, 'i').test(part) : part.toLowerCase() === query.toLowerCase();
            return isMatch 
              ? <span key={i} className="bg-yellow-500/40 rounded-[2px]">{part}</span> 
              : part;
          })}
        </>
      );
    } catch(e) {
      return <>{jsonString}</>;
    }
  }

  const lines = jsonString.split('\n');
  return (
    <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
      {lines.map((line, i) => {
        // Split by tokens: strings, booleans, null, numbers
        const parts = line.split(/(".*?"|\bnull\b|\btrue\b|\bfalse\b|\b\d+\b)/g);
        
        return (
          <div key={i}>
            {parts.map((p, j) => {
              let content: React.ReactNode = p;
              
              // Apply search highlight if needed (except for strings which are handled below)
              if (query && !/^".*"$/.test(p)) {
                try {
                  const safeQ = isRegex ? query : escapeRegExp(query);
                  const qr = new RegExp(`(${safeQ})`, 'gi');
                  if (p.match(qr)) {
                    const subParts = p.split(qr);
                    content = subParts.map((sp, k) => {
                      if (!sp) return null;
                      const isMatch = isRegex ? new RegExp(`^${safeQ}$`, 'i').test(sp) : sp.toLowerCase() === query.toLowerCase();
                      return isMatch
                        ? <span key={k} className="bg-yellow-500/40 rounded-[2px] text-foreground">{sp}</span>
                        : sp;
                    });
                  }
                } catch(e) {}
              }

              if (p === 'null') return <span key={j} className="text-gray-500 italic">{content}</span>;
              if (p === 'true' || p === 'false') return <span key={j} className="text-amber-500 font-semibold">{content}</span>;
              if (/^\d+$/.test(p)) return <span key={j} className="text-blue-500">{content}</span>;
              if (/^".*"$/.test(p)) {
                if (parts[j+1] && parts[j+1].startsWith(':')) {
                  let keyContent: React.ReactNode = p;
                  if (query) {
                    try {
                      const safeQuery = isRegex ? query : escapeRegExp(query);
                      const qRegex = new RegExp(`(${safeQuery})`, 'gi');
                      if (p.match(qRegex)) {
                        const keyParts = p.split(qRegex);
                        keyContent = keyParts.map((sp, k) => {
                          if (!sp) return null;
                          const isMatch = isRegex ? new RegExp(`^${safeQuery}$`, 'i').test(sp) : sp.toLowerCase() === query.toLowerCase();
                          return isMatch 
                            ? <span key={k} className="bg-yellow-500/40 rounded-[2px] text-foreground">{sp}</span> 
                            : sp;
                        });
                      }
                    } catch(e) {}
                  }
                  return <span key={j} className="text-purple-600 dark:text-purple-400 font-semibold">{keyContent}</span>;
                }
                return <span key={j} className="text-green-600 dark:text-green-400">{highlightSqlAndSearch(p, query, isRegex)}</span>;
              }
              return <span key={j} className="text-muted-foreground">{content}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}
