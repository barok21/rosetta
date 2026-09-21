import React from "react";
import { LogEntry } from "@/hooks/useLogFile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Copy, Check } from "lucide-react";
import { JsonViewer } from "@/components/JsonViewer";

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
  if (!selectedLog) return null;
  
  return (
    <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
      <SheetContent 
        className="!max-w-4xl w-[90vw] overflow-hidden flex flex-col p-0"
        style={{ maxWidth: '900px' }}
      >
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle>Log Details (Line {selectedLog.lineNumber})</SheetTitle>
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
        </SheetHeader>
        <div className="flex-1 overflow-auto p-6 bg-muted/10">
          <div className="bg-card border rounded-md p-4 min-h-full">
                <JsonViewer 
                  data={selectedLog.rawPayload || selectedLog.originalLine} 
                  query={searchQuery}
                  isRegex={isRegex}
                />
              </div>
            </div>
      </SheetContent>
    </Sheet>
  );
}
