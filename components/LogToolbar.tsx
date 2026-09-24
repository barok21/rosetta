import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Activity, Search, Upload, X, Settings2, Calendar as CalendarIcon, Download, AlertCircle, AlertTriangle, Info, Bug, Skull, ListFilter, Tag, Database, Globe, Server, Lock, Code2 } from "lucide-react";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import { cn } from "cn";
import { LogEntry } from "@/hooks/useLogFile";

interface LogToolbarProps {
  logs: LogEntry[];
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  uniqueTypes: string[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  uniqueStatuses: string[];
  startDate: Date | undefined;
  setStartDate: (d: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (d: Date | undefined) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isRegex: boolean;
  setIsRegex: (v: boolean) => void;
  searchMatches: number[];
  currentMatchIndex: number;
  filteredLogsLength: number;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  handleExportLogs: () => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenBase64Converter?: () => void;
}

export function LogToolbar({
  logs,
  levelFilter,
  setLevelFilter,
  typeFilter,
  setTypeFilter,
  uniqueTypes,
  statusFilter,
  setStatusFilter,
  uniqueStatuses,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  searchQuery,
  setSearchQuery,
  isRegex,
  setIsRegex,
  searchMatches,
  currentMatchIndex,
  filteredLogsLength,
  showAdvanced,
  setShowAdvanced,
  hasActiveFilters,
  clearFilters,
  handleExportLogs,
  handleSearchKeyDown,
  handleFileUpload,
  searchInputRef,
  onOpenBase64Converter,
}: LogToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {logs.length > 0 && (
          <>
            
            <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v || 'ALL')}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"><div className="flex items-center gap-2"><ListFilter size={14} className="text-muted-foreground" /> All Levels</div></SelectItem>
                <SelectItem value="error"><div className="flex items-center gap-2"><AlertCircle size={14} className="text-red-500" /> Error</div></SelectItem>
                <SelectItem value="warn"><div className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Warning</div></SelectItem>
                <SelectItem value="info"><div className="flex items-center gap-2"><Info size={14} className="text-blue-500" /> Info</div></SelectItem>
                <SelectItem value="debug"><div className="flex items-center gap-2"><Bug size={14} className="text-purple-500" /> Debug</div></SelectItem>
                <SelectItem value="fatal"><div className="flex items-center gap-2"><Skull size={14} className="text-red-700" /> Fatal</div></SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v || 'ALL')}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL"><div className="flex items-center gap-2"><ListFilter size={14} className="text-muted-foreground" /> All Types</div></SelectItem>
                {uniqueTypes.map(t => {
                  const typeLower = t.toLowerCase();
                  let TypeIcon = Tag;
                  if (typeLower.includes('db') || typeLower.includes('sql') || typeLower.includes('query')) TypeIcon = Database;
                  else if (typeLower.includes('api') || typeLower.includes('http') || typeLower.includes('web')) TypeIcon = Globe;
                  else if (typeLower.includes('worker') || typeLower.includes('job') || typeLower.includes('task')) TypeIcon = Server;
                  else if (typeLower.includes('auth') || typeLower.includes('login')) TypeIcon = Lock;

                  return (
                    <SelectItem key={t} value={t}>
                      <div className="flex items-center gap-2">
                        <TypeIcon size={14} className="text-muted-foreground opacity-70" />
                        {t}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'ALL')}>
              <SelectTrigger className="w-[140px] h-8 bg-background border-input hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity size={14} className="opacity-70" />
                  <span className="font-medium text-foreground truncate flex-1 text-left">
                    {statusFilter === 'ALL' ? 'All Statuses' : statusFilter}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center">
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {startDate ? (
                    endDate ? (
                      <>
                        {format(startDate, "LLL dd, y")} -{" "}
                        {format(endDate, "LLL dd, y")}
                      </>
                    ) : (
                      format(startDate, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={startDate}
                    selected={{ from: startDate, to: endDate }}
                    onSelect={(range: DateRange | undefined) => {
                      setStartDate(range?.from);
                      setEndDate(range?.to);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}
      </div>

      {logs.length > 0 && (
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input 
              ref={searchInputRef}
              placeholder="Search logs... (Ctrl+F)" 
              className="pl-9 pr-10 h-8"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <Button
              variant={isRegex ? "default" : "ghost"}
              size="sm"
              className="absolute right-1 top-1 h-6 w-8 rounded-sm text-[10px] font-bold px-0"
              onClick={() => setIsRegex(!isRegex)}
              title="Toggle Regex"
            >
              .*
            </Button>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">
            {searchMatches.length > 0 ? `${currentMatchIndex + 1} of ${searchMatches.length}` : `${filteredLogsLength} logs`}
          </span>
          <Button 
            variant={showAdvanced ? "secondary" : "outline"} 
            size="sm" 
            className="h-8 gap-2 ml-2"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 size={14} />
            Advanced
          </Button>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-2 ml-1 text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
              title="Clear all filters"
            >
              <X size={14} />
              Clear
            </Button>
          )}
          {logs.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 gap-2 ml-1"
                onClick={handleExportLogs}
                title="Export filtered logs as JSON"
              >
                <Download size={14} />
                Export
              </Button>
              {onOpenBase64Converter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 ml-1 hidden lg:flex"
                  onClick={onOpenBase64Converter}
                  title="Open Base64 Converter"
                >
                  <Code2 size={14} />
                  Base64
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
