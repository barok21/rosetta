import React from "react";
import { LogEntry } from "@/hooks/useLogFile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Copy, Check, Sparkles, Loader2 } from "lucide-react";
import { JsonViewer } from "@/components/JsonViewer";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LogDetailsModalProps {
  selectedLog: LogEntry | null;
  setSelectedLog: (log: LogEntry | null) => void;
  searchQuery: string;
  isRegex: boolean;
  copied: boolean;
  handleCopyPayload: () => void;
}

export function LogDetailsModal({
  selectedLog,
  setSelectedLog,
  searchQuery,
  isRegex,
  copied,
  handleCopyPayload
}: LogDetailsModalProps) {
  const isMobile = useIsMobile();
  
  const [aiExplanation, setAiExplanation] = React.useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);

  // Reset AI state when modal closes
  React.useEffect(() => {
    if (!selectedLog) {
      setAiExplanation(null);
      setAiError(null);
      setIsAiLoading(false);
    }
  }, [selectedLog]);

  const handleAskAI = async () => {
    if (!selectedLog) return;
    setIsAiLoading(true);
    setAiExplanation("");
    setAiError(null);

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: selectedLog }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          const lines = chunkValue.split('\n').filter(l => l.trim() !== '');
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                setAiExplanation(prev => (prev || '') + parsed.response);
              }
            } catch (e) {
              // Ignore partial or unparseable lines
            }
          }
        }
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate explanation.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Drawer 
      open={!!selectedLog} 
      onOpenChange={(open) => !open && setSelectedLog(null)}
      showSwipeHandle={false}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <DrawerContent 
        className="!max-w-4xl w-[90vw] sm:!inset-y-6 sm:!inset-x-auto sm:!right-6 sm:!h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border shadow-2xl overflow-hidden flex flex-col p-0"
        style={{ maxWidth: '900px' }}
      >
        <DrawerHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-center justify-between pr-8">
            <DrawerTitle className="flex items-center gap-3">
              Log Details (Line {selectedLog?.lineNumber})
              {selectedLog && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 hover:text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30"
                  onClick={handleAskAI}
                  disabled={isAiLoading}
                >
                  {isAiLoading ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <Sparkles size={12} className="mr-1.5" />}
                  Ask AI to Explain
                </Button>
              )}
            </DrawerTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={handleCopyPayload}
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy JSON'}
            </Button>
          </div>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10 scrollbar-none flex flex-col gap-6">
          {(aiExplanation !== null || isAiLoading || aiError) && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 shadow-sm animate-in fade-in slide-in-from-top-4">
              <h3 className="flex items-center gap-2 font-semibold text-indigo-600 dark:text-indigo-400 mb-3">
                <Sparkles size={16} />
                AI Explanation
              </h3>
              
              <div className="prose prose-sm dark:prose-invert prose-indigo max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border">
                {aiError ? (
                  <p className="text-red-500">{aiError}</p>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiExplanation || 'Thinking...'}
                  </ReactMarkdown>
                )}
                {isAiLoading && (
                  <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse" />
                )}
              </div>
            </div>
          )}

          <div className="bg-card border rounded-xl p-5 shadow-sm min-h-full">
            {selectedLog && (
              <JsonViewer 
                data={selectedLog.rawPayload || selectedLog.originalLine} 
                query={searchQuery}
                isRegex={isRegex}
              />
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
