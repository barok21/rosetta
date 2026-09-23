"use client";

import { useState, useEffect } from "react";
import React from "react";
import { useTheme } from "@wrksz/themes/client";
import { buttonVariants, Button } from "@/components/ui/button";
import { Upload, Moon, Sun, Monitor, X, Plus } from "lucide-react";
import { LogWorkspace } from "@/components/LogWorkspace";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  if (!mounted) return <div className="w-9 h-9 invisible"></div>;

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground" 
      onClick={cycleTheme} 
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
    </Button>
  );
}

interface LogSession {
  id: string;
  name: string;
  file: File | null;
}

export default function LogReaderApp() {
  const [sessions, setSessions] = useState<LogSession[]>([
    { id: 'default', name: 'New Session', file: null }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('default');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if current session is empty, replace it if so
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (activeSession && !activeSession.file) {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, name: file.name, file } : s
      ));
    } else {
      // Create new session
      const newId = Math.random().toString(36).substring(7);
      setSessions(prev => [...prev, { id: newId, name: file.name, file }]);
      setActiveSessionId(newId);
    }
    
    e.target.value = '';
  };

  const createEmptySession = () => {
    const newId = Math.random().toString(36).substring(7);
    setSessions(prev => [...prev, { id: newId, name: 'New Session', file: null }]);
    setActiveSessionId(newId);
  };

  const closeSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent selecting the tab
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (next.length === 0) {
        // Always keep at least one empty session
        const newId = Math.random().toString(36).substring(7);
        setActiveSessionId(newId);
        return [{ id: newId, name: 'New Session', file: null }];
      }
      if (activeSessionId === id) {
        // Switch to the last available session
        setActiveSessionId(next[next.length - 1].id);
      }
      return next;
    });
  };

  const updateSessionName = React.useCallback((id: string, newName: string) => {
    setSessions(prev => {
      const session = prev.find(s => s.id === id);
      if (session && session.name === newName) return prev; // Prevent infinite loop
      return prev.map(s => s.id === id ? { ...s, name: newName } : s);
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Header & Tabs */}
      <header className="flex items-center justify-between px-6 py-2 border-b bg-card">
        <div className="flex items-center gap-6 overflow-hidden">
          <h1 className="text-lg font-semibold tracking-tight shrink-0">Rosetta</h1>
          
          {/* Tab Bar */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-md border border-border/40 overflow-x-auto max-w-[60vw] scrollbar-thin">
            {sessions.map(session => (
              <button 
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                onDoubleClick={() => {
                  setEditingSessionId(session.id);
                  setEditingName(session.name);
                }}
                className={`group flex items-center gap-2 px-3 py-1.5 text-sm rounded-sm transition-all shrink-0 ${
                  activeSessionId === session.id 
                    ? 'bg-background shadow-sm text-foreground font-medium border border-border/50' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {editingSessionId === session.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                      updateSessionName(session.id, editingName || 'Unnamed');
                      setEditingSessionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateSessionName(session.id, editingName || 'Unnamed');
                        setEditingSessionId(null);
                      } else if (e.key === 'Escape') {
                        setEditingSessionId(null);
                      }
                    }}
                    className="max-w-[150px] bg-transparent border-none outline-none ring-0 text-foreground"
                    style={{ width: `${Math.max(4, editingName.length)}ch` }}
                  />
                ) : (
                  <span className="max-w-[150px] truncate">{session.name}</span>
                )}
                
                <X 
                  size={14} 
                  className={`opacity-50 hover:opacity-100 transition-opacity rounded-sm hover:bg-muted-foreground/20 ${activeSessionId === session.id ? 'opacity-70' : 'opacity-0 group-hover:opacity-50'}`}
                  onClick={(e) => closeSession(session.id, e)} 
                />
              </button>
            ))}
            <button 
              onClick={createEmptySession}
              className="p-1.5 ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm transition-colors shrink-0"
              title="New Tab"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="fileInputGlobal" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-2 cursor-pointer h-9 shadow-sm" })}>
            <Upload size={14} />
            Import Log
          </label>
          <input 
            type="file" 
            id="fileInputGlobal"
            className="hidden" 
            accept=".log,.txt,text/plain" 
            onChange={handleGlobalFileUpload}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* Render Workspaces */}
      {sessions.map(session => (
        <LogWorkspace 
          key={session.id}
          sessionFile={session.file}
          isActive={activeSessionId === session.id}
          onSessionReady={(name) => updateSessionName(session.id, name)}
        />
      ))}
    </div>
  );
}
