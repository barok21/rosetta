import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ArrowRightLeft, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Base64ConverterModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialText: string;
}

export function Base64ConverterModal({
  isOpen,
  onOpenChange,
  initialText,
}: Base64ConverterModalProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"decode" | "encode">("decode");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInput(initialText.trim());
      // Try to auto-detect if we should decode or encode based on characters
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(initialText.trim()) && initialText.trim().length % 4 === 0;
      setMode(isBase64 ? "decode" : "encode");
    }
  }, [isOpen, initialText]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Base64 Converter
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMode}
              className="ml-auto"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              {mode === "decode" ? "Decoding Mode" : "Encoding Mode"}
            </Button>
          </DialogTitle>
          <DialogDescription>
            {mode === "decode"
              ? "Decode Base64 strings to readable text."
              : "Encode plain text into Base64 format."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Input</label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
              placeholder={mode === "decode" ? "Paste Base64 here..." : "Paste plain text here..."}
            />
          </div>

          <div className="flex flex-col gap-2 relative">
            <div className="flex justify-between items-end">
              <label className="text-sm font-medium">Output</label>
              {output && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 px-2 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              )}
            </div>
            {error ? (
              <div className="min-h-[120px] p-3 rounded-md border border-red-500/50 bg-red-500/10 text-red-500 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <Textarea
                value={output}
                readOnly
                className="min-h-[120px] font-mono text-xs bg-muted/50"
                placeholder="Result will appear here..."
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
