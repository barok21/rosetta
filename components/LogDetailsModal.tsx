import React from "react";
import { LogEntry } from "@/hooks/useLogFile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Copy, Check } from "lucide-react";
import { JsonViewer } from "@/components/JsonViewer";
import { useIsMobile } from "@/hooks/use-mobile";

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

  return (
    <Drawer 
      open={!!selectedLog} 
      onOpenChange={(open) => !open && setSelectedLog(null)}
      showSwipeHandle={isMobile}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <DrawerContent 
        className="!max-w-4xl w-[90vw] sm:!inset-y-6 sm:!inset-x-auto sm:!right-6 sm:!h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border shadow-2xl overflow-hidden flex flex-col p-0"
        style={{ maxWidth: '900px' }}
      >
        <DrawerHeader className="p-6 pb-4 border-b text-left">
          <div className="flex items-center justify-between pr-8">
            <DrawerTitle>Log Details (Line {selectedLog?.lineNumber})</DrawerTitle>
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
        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="bg-card border rounded-md p-4 min-h-full">
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
