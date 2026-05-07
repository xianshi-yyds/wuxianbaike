'use client';

import { Compass, Home, Loader2, LogOut, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DemoHistoryItem } from '@/types';

interface HistorySidebarProps {
  history: DemoHistoryItem[];
  selectedDemoId: string | null;
  onSelectDemo: (demoId: string) => void;
  onNewSession: () => void;
  onDeleteDemo: (demoId: string) => void;
  onClearHistory: () => void;
  username: string;
  isHistorySaving: boolean;
  onLogout: () => void;
}

const formatRelative = (iso: string) => {
  const created = new Date(iso).getTime();
  const diffMs = Date.now() - created;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
};

export default function HistorySidebar({
  history,
  selectedDemoId,
  onSelectDemo,
  onNewSession,
  onDeleteDemo,
  onClearHistory,
  username,
  isHistorySaving,
  onLogout,
}: HistorySidebarProps) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Compass className="h-4 w-4 text-primary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-1 text-base font-semibold">无限探索</span>
            <span className="text-[11px] font-normal text-muted-foreground">账号历史</span>
          </div>
          {isHistorySaving && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="rounded-full p-1 text-foreground/35 transition hover:bg-foreground/10 hover:text-destructive"
              title="清空历史"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={username}>
            {username}
          </span>
          <a
            href="/open.html"
            className="rounded-md p-1 text-foreground/45 transition hover:bg-foreground/10 hover:text-foreground"
            title="返回百科首页"
          >
            <Home className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md p-1 text-foreground/45 transition hover:bg-foreground/10 hover:text-foreground"
            title="退出登录"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button
          variant="default"
          size="sm"
          className="w-full"
          onClick={onNewSession}
        >
          <Plus className="h-4 w-4" />
          新会话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {history.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              还没有生成过总览图
            </p>
          )}
          {history.map((demo) => {
            const isActive = demo.id === selectedDemoId;
            return (
              <div
                key={demo.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectDemo(demo.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectDemo(demo.id);
                  }
                }}
                className={cn(
                  'group relative flex w-full flex-col gap-2 rounded-lg border p-2 text-left transition',
                  isActive
                    ? 'border-primary/50 bg-primary/8 shadow-sm'
                    : 'border-border/40 bg-background/40 hover:border-primary/30 hover:bg-card',
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteDemo(demo.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteDemo(demo.id);
                    }
                  }}
                  className="absolute right-3 top-3 z-10 rounded-full border border-foreground/10 bg-background/85 p-1 text-foreground/35 opacity-0 shadow-sm transition hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  title="删除这条历史"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="aspect-square w-full overflow-hidden rounded-md border border-border/40 bg-muted">
                  <img
                    src={demo.rootImageUrl}
                    alt={demo.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="line-clamp-1 text-xs font-medium text-foreground">
                    {demo.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelative(demo.createdAt)} · {demo.scenes.length} 张图
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
