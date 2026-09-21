import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface AdvancedFiltersSheetProps {
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  searchOperator: 'AND' | 'OR';
  setSearchOperator: (v: 'AND' | 'OR') => void;
  excludeQuery: string;
  setExcludeQuery: (v: string) => void;
  metadataKeys: string[];
  uniqueMetadataValues: Record<string, string[]>;
  metadataFilters: Record<string, string>;
  setMetadataFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function AdvancedFiltersSheet({
  showAdvanced,
  setShowAdvanced,
  searchOperator,
  setSearchOperator,
  excludeQuery,
  setExcludeQuery,
  metadataKeys,
  uniqueMetadataValues,
  metadataFilters,
  setMetadataFilters
}: AdvancedFiltersSheetProps) {
  if (!showAdvanced) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-in fade-in-0 duration-300"
        onClick={() => setShowAdvanced(false)}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-2xl overflow-y-auto animate-in slide-in-from-right-full duration-300 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold tracking-tight">Advanced Filters</h2>
          <Button variant="ghost" size="icon" onClick={() => setShowAdvanced(false)}>
            <X size={16} />
          </Button>
        </div>
        
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Search Operator</span>
            <Select value={searchOperator} onValueChange={(v: any) => setSearchOperator(v)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">Match ALL terms (AND)</SelectItem>
                <SelectItem value="OR">Match ANY term (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">Exclude Terms</span>
            <Input 
              placeholder="Hide logs containing..." 
              className="w-full h-9" 
              value={excludeQuery}
              onChange={e => setExcludeQuery(e.target.value)}
            />
          </div>

          {metadataKeys.length > 0 && (
            <>
              <div className="h-px w-full bg-border my-2"></div>
              <span className="text-sm font-medium text-muted-foreground">Metadata Fields</span>
              
              <div className="grid grid-cols-2 gap-3">
                {metadataKeys.map(key => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    <Select 
                      value={metadataFilters[key] || 'ALL'} 
                      onValueChange={(val) => setMetadataFilters(prev => ({...prev, [key]: val || 'ALL'}))}
                    >
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        {uniqueMetadataValues[key]?.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
