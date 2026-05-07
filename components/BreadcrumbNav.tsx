'use client';

import { ChevronRight, Home } from 'lucide-react';
import type { GeneratedScene } from '@/types';
import { cn } from '@/lib/utils';

interface BreadcrumbNavProps {
  lineage: GeneratedScene[];
  currentSceneId: string | null;
  onSelect: (sceneId: string) => void;
}

export default function BreadcrumbNav({ lineage, currentSceneId, onSelect }: BreadcrumbNavProps) {
  if (!lineage.length) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-foreground/70">
      {lineage.map((scene, index) => {
        const isLast = scene.id === currentSceneId;
        const label = index === 0 ? '总览' : scene.title;
        return (
          <div key={scene.id} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 text-foreground/40" />}
            <button
              type="button"
              onClick={() => onSelect(scene.id)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-3 py-1 transition',
                isLast
                  ? 'border-primary/40 bg-primary/10 text-primary font-medium cursor-default'
                  : 'border-border/60 bg-card/60 hover:bg-card hover:border-primary/30',
              )}
              disabled={isLast}
              title={scene.title}
            >
              {index === 0 && <Home className="h-3 w-3" />}
              <span className="max-w-[180px] truncate">{label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
