"use client";

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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const isMobile = useIsMobile();

  function handleClearFilters() {
    setSearchOperator('AND');
    setExcludeQuery('');
    setMetadataFilters({});
    setShowAdvanced(false);
  }

  return (
    <Drawer
      open={showAdvanced}
      onOpenChange={setShowAdvanced}
      showSwipeHandle={false}
      swipeDirection={isMobile ? "down" : "right"}
    >
      <DrawerContent 
        className="sm:!inset-y-6 sm:!inset-x-auto sm:!right-6 sm:!h-[calc(100dvh-3rem)] sm:max-w-md sm:rounded-2xl sm:border shadow-2xl"
      >
        <DrawerHeader className="text-left border-b">
          <DrawerTitle>Advanced Filters</DrawerTitle>
          <DrawerDescription>
            Configure complex filtering conditions and metadata criteria.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-tight">Search Operator</h3>
              <RadioGroup
                value={searchOperator}
                onValueChange={(v: 'AND' | 'OR') => setSearchOperator(v)}
                className="gap-2"
              >
                <FieldLabel htmlFor="operator-and">
                  <Field orientation="horizontal" className="cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                    <FieldContent>
                      <FieldTitle className="flex items-center gap-2">
                        Match ALL terms
                      </FieldTitle>
                      <FieldDescription>Returns logs that match every search term (AND)</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="AND" id="operator-and" />
                  </Field>
                </FieldLabel>
                
                <FieldLabel htmlFor="operator-or">
                  <Field orientation="horizontal" className="cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                    <FieldContent>
                      <FieldTitle className="flex items-center gap-2">
                        Match ANY term
                      </FieldTitle>
                      <FieldDescription>Returns logs matching at least one search term (OR)</FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="OR" id="operator-or" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight">Exclude Terms</h3>
              <Input 
                placeholder="Hide logs containing... (e.g. timeout)" 
                className="w-full" 
                value={excludeQuery}
                onChange={e => setExcludeQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Logs containing these exact terms will be hidden from the view.
              </p>
            </div>

            {metadataKeys.length > 0 && (
              <>
                <div className="h-px w-full bg-border my-2"></div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold tracking-tight">Metadata Fields</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {metadataKeys.map(key => (
                      <div key={key} className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <Select 
                          value={metadataFilters[key] || 'ALL'} 
                          onValueChange={(val) => setMetadataFilters(prev => ({...prev, [key]: val || 'ALL'}))}
                        >
                          <SelectTrigger className="w-full text-xs h-9">
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
                </div>
              </>
            )}
          </div>
        </div>
        <DrawerFooter className="border-t flex flex-row gap-2 justify-end p-4">
          <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto h-9 text-xs">
            Clear Filters
          </Button>
          <DrawerClose render={<Button className="w-full sm:w-auto h-9 text-xs">Apply Filters</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
