import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ArrowRightLeft, AlertCircle, RefreshCcw, X, Minimize2, Maximize2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { highlightSqlAndSearch } from "@/lib/highlight";
import { cn } from "@/lib/utils";

interface Base64ConverterModalProps {
  id: string;
  initialText: string;
  index: number;
  zIndex: number;
  minIndex: number;
  onClose: (id: string) => void;
  onMinimizeChange: (id: string, isMinimized: boolean) => void;
  onFocus: (id: string) => void;
  isMinimizedState: boolean;
}

export function Base64ConverterModal({
  id,
  initialText,
  index,
  zIndex,
  minIndex,
  onClose,
  onMinimizeChange,
  onFocus,
  isMinimizedState,
}: Base64ConverterModalProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");
  const [error, setError] = useState<string | null>(null);
  
  const [selectedText, setSelectedText] = useState("");
  const [hasSelection, setHasSelection] = useState(false);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    // Initial offset based on index
    setPosition({ x: index * 30, y: index * 30 });
  }, [index]);

  const handlePointerDown = (e: React.PointerEvent) => {
    onFocus(id);
    if (isMinimizedState) return;
    
    // Only drag from header
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    setInput(initialText.trim());
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(initialText.trim()) && initialText.trim().length % 4 === 0;
    setMode(isBase64 ? "decode" : "encode");
  }, [initialText]);

  useEffect(() => {
    setError(null);
    if (!input) {
      setOutput("");
      return;
    }

    try {
      if (mode === "decode") {
        // atob decodes base64 to string
        const decoded = atob(input);
        // Let's try to format it if it's JSON, otherwise just use the string
        try {
          const parsed = JSON.parse(decoded);
          setOutput(JSON.stringify(parsed, null, 2));
        } catch {
          setOutput(decoded);
        }
      } else {
        // btoa encodes string to base64
        setOutput(btoa(input));
      }
    } catch (err: any) {
      setError(mode === "decode" ? "Invalid Base64 string" : "Cannot encode string");
      setOutput("");
    }
  }, [input, mode]);

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "decode" ? "encode" : "decode"));
    setInput(output); // Optionally swap input and output
  };

  const handleSelect = () => {
    const sel = window.getSelection();
    if (sel) {
      const text = sel.toString().trim();
      setSelectedText(text);
      setHasSelection(text.length > 0);
    }
  };

  const handleDecodeSelection = () => {
    if (selectedText) {
      setInput(selectedText);
      setMode("decode");
      setHasSelection(false);
      setSelectedText("");
      window.getSelection()?.removeAllRanges();
      onMinimizeChange(id, false);
    }
  };

  return (
    <div 
      className={cn(
        "bg-popover text-popover-foreground border shadow-2xl transition-all duration-300 overflow-hidden",
        isMinimizedState 
          ? "h-12 flex items-center justify-between px-4 cursor-pointer rounded-full hover:scale-105 hover:bg-accent hover:text-accent-foreground border-primary/20 shadow-primary/10 w-64 w-full" 
          : "fixed w-[90vw] max-w-4xl rounded-xl flex flex-col gap-4 p-6 animate-in fade-in zoom-in-95",
        isDragging && "transition-none cursor-grabbing"
      )}
      style={isMinimizedState ? {} : { 
        top: `calc(50% + ${position.y}px)`, 
        left: `calc(50% + ${position.x}px)`, 
        transform: 'translate(-50%, -50%)', 
        zIndex: zIndex 
      }}
      onClick={() => isMinimizedState && onMinimizeChange(id, false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {!isMinimizedState ? (
        <>
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <div className="drag-handle flex items-center gap-2 text-lg font-semibold leading-none tracking-tight cursor-grab active:cursor-grabbing">
              Base64 Converter
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMode}
                className="ml-auto mr-2"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                {mode === "decode" ? "Decoding Mode" : "Encoding Mode"}
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMinimizeChange(id, true)}>
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onClose(id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === "decode"
                ? "Decode Base64 strings to readable text."
                : "Encode plain text into Base64 format."}
            </p>
          </div>

          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Input</label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[120px] max-h-[300px] overflow-y-auto font-mono text-xs break-all whitespace-pre-wrap resize-none"
                placeholder={mode === "decode" ? "Paste Base64 here..." : "Paste plain text here..."}
              />
            </div>

            <div className="flex flex-col gap-2 relative">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium">Output</label>
                {output && (
                  <div className="flex items-center gap-2">
                    {hasSelection && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDecodeSelection}
                        className="h-6 px-2 text-xs bg-primary/10 hover:bg-primary/20 text-primary"
                      >
                        <RefreshCcw className="w-3 h-3 mr-1" />
                        Decode Selection
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-6 px-2 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                )}
              </div>
              {error ? (
                <div className="min-h-[120px] p-3 rounded-md border border-red-500/50 bg-red-500/10 text-red-500 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <div
                  onMouseUp={handleSelect}
                  onKeyUp={handleSelect}
                  className="min-h-[120px] max-h-[300px] overflow-y-auto font-mono text-xs bg-muted/50 break-all whitespace-pre-wrap rounded-md border border-input p-2.5"
                >
                  {output ? highlightSqlAndSearch(output, "", false) : <span className="text-muted-foreground">Result will appear here...</span>}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ArrowRightLeft className="w-4 h-4" />
            Base64 Converter
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={(e) => { e.stopPropagation(); onMinimizeChange(id, false); }}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={(e) => { e.stopPropagation(); onClose(id); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
