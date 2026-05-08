'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Lock, LogIn, User, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/types';

interface AuthPanelProps {
  onAuthenticated: (user: AuthUser) => Promise<void> | void;
  onCancel?: () => void;
}

type AuthMode = 'login' | 'register';

export default function AuthPanel({ onAuthenticated, onCancel }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        user?: AuthUser;
        error?: string;
      };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? (mode === 'login' ? '登录失败' : '注册失败'));
      }

      await onAuthenticated(payload.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      toast.error(mode === 'login' ? '登录失败' : '注册失败', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-foreground/15 bg-card/80 p-5 shadow-[0_24px_60px_-30px_rgba(40,28,16,0.4)] backdrop-blur-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">无限知识</h1>
          <p className="mt-1 text-sm text-muted-foreground">账号登录</p>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-lg text-sm transition',
              mode === 'login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60',
            )}
          >
            <LogIn className="h-4 w-4" />
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-lg text-sm transition',
              mode === 'register'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/60',
            )}
          >
            <UserPlus className="h-4 w-4" />
            注册
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            账号
            <div className="relative">
              <User className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="h-10 pl-8"
                placeholder="输入账号"
                disabled={isSubmitting}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            密码
            <div className="relative">
              <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="h-10 pl-8"
                placeholder="输入密码"
                disabled={isSubmitting}
              />
            </div>
          </label>

          <Button type="submit" className="mt-2 h-10" disabled={isSubmitting}>
            {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isSubmitting ? '处理中' : mode === 'login' ? '登录' : '创建账号'}
          </Button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-9 text-sm text-muted-foreground transition hover:text-foreground"
              disabled={isSubmitting}
            >
              继续访客试用
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
