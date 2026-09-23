import React from "react";

// ─── Regex Patterns ───────────────────────────────────────────────
const SQL_KEYWORDS_PATTERN = `\\b(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|JOIN|INNER\\s+JOIN|LEFT\\s+JOIN|RIGHT\\s+JOIN|OUTER\\s+JOIN|ON|GROUP\\s+BY|ORDER\\s+BY|LIMIT|VALUES|INTO|SET|AS|DESC|ASC|IS|NOT|LIKE|IN|CREATE|ALTER|DROP|TABLE|INDEX|UNION|ALL|DISTINCT|HAVING|EXISTS|BETWEEN|CASE|WHEN|THEN|ELSE|END)\\b`;
const IP_ADDRESS_PATTERN = `\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b`;

const COMBINED_HIGHLIGHT_REGEX = new RegExp(`(${SQL_KEYWORDS_PATTERN}|${IP_ADDRESS_PATTERN})`, 'gi');
const SQL_KEYWORDS = new RegExp(`^${SQL_KEYWORDS_PATTERN}$`, 'i');
const IP_ADDRESS = new RegExp(`^${IP_ADDRESS_PATTERN}$`);

// ─── Utilities ────────────────────────────────────────────────────
export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatReadableDate(ts: string) {
  if (!ts || ts === '-') return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── Highlight Functions ──────────────────────────────────────────
export function highlightSqlAndSearch(text: string, query: string, isRegex: boolean = false) {
  if (!text) return null;

  const parts = text.split(COMBINED_HIGHLIGHT_REGEX);
  
  let queryRegex: RegExp | null = null;
  let safeQuery = '';
  if (query) {
    try {
      safeQuery = isRegex ? query : escapeRegExp(query);
      queryRegex = new RegExp(`(${safeQuery})`, 'gi');
    } catch (e) {
      // Ignore invalid regex
    }
  }
  
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        
        let isSqlKeyword = !!part.match(SQL_KEYWORDS);
        let isIpAddress = !!part.match(IP_ADDRESS);

        if (queryRegex && part.match(queryRegex)) {
          const subParts = part.split(queryRegex);
          return (
            <span key={i}>
              {subParts.map((sp, k) => {
                if (!sp) return null;
                const isMatch = isRegex ? new RegExp(`^${safeQuery}$`, 'i').test(sp) : sp.toLowerCase() === query.toLowerCase();
                
                if (isMatch) {
                  return <span key={k} className="bg-yellow-500/40 rounded-[2px] text-foreground">{sp}</span>;
                }
                if (isSqlKeyword) {
                  return <span key={k} className="text-pink-600 dark:text-pink-400 font-semibold">{sp}</span>;
                }
                if (isIpAddress) {
                  return <span key={k} className="text-blue-500 dark:text-blue-400 font-semibold">{sp}</span>;
                }
                return sp;
              })}
            </span>
          );
        }

        if (isSqlKeyword) {
          return <span key={i} className="text-pink-600 dark:text-pink-400 font-semibold">{part}</span>;
        }
        if (isIpAddress) {
          return <span key={i} className="text-blue-500 dark:text-blue-400 font-semibold">{part}</span>;
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function highlightText(text: string, query: string, isRegex: boolean = false) {
  return highlightSqlAndSearch(text, query, isRegex);
}
