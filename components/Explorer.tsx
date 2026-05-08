'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { ArrowLeft, ArrowUp, ImagePlus, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import AuthPanel from '@/components/AuthPanel';
import MapView from '@/components/MapView';
import BreadcrumbNav from '@/components/BreadcrumbNav';
import HistorySidebar from '@/components/HistorySidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  cropImageToHotspot,
  generateFocusedSceneImage,
  generateOverviewImage,
} from '@/lib/ai-scene';
import {
  buildSceneLineage,
  collectDescendantsOnSpine,
  makeId,
} from '@/lib/scene';
import type {
  AuthUser,
  DemoHistoryItem,
  ExploreKnowledgePoint,
  ExploreNodePayload,
  ExploreSessionPayload,
  GeneratedScene,
} from '@/types';

const MAX_HISTORY_ITEMS = 20;
const GUEST_SESSION_LIMIT = 1;
const GUEST_HISTORY_KEY = 'wuxian_guest_explore_history';
const GUEST_USAGE_KEY = 'wuxian_guest_explore_usage';

const recommendedTopics = [
  '鲸鱼的歌声如何在海里传播',
  '黑洞边缘会发生什么',
  '丝绸之路如何连接城市',
  '番茄从田间到餐桌的结构',
  '雪豹如何在峭壁间捕猎',
  '雷暴云里面正在发生什么',
];

const sampleTopics = [
  '原来鲸鱼的歌声也能像地图一样被科学家读取',
  '一颗番茄里面藏着运输水分和糖分的路线',
  '黑洞边缘不是墙，而是一条信息很难回头的边界',
];

const isPersistedImageUrl = (value: string) =>
  value.startsWith('/api/generated/images/') ||
  value.startsWith('https://xianshi.icu/api/generated/images/');

const canPersistHistoryItem = (item: DemoHistoryItem) =>
  isPersistedImageUrl(item.rootImageUrl) &&
  item.scenes.every((scene) => isPersistedImageUrl(scene.imageUrl));

const normalizeHistory = (items: DemoHistoryItem[]) =>
  items.filter(canPersistHistoryItem).slice(0, MAX_HISTORY_ITEMS);

const readGuestUsage = () => {
  if (typeof window === 'undefined') return 0;
  const value = Number(window.localStorage.getItem(GUEST_USAGE_KEY) ?? '0');
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};

const writeGuestUsage = (value: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_USAGE_KEY, String(Math.max(0, value)));
};

const readGuestHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_HISTORY_KEY);
    return normalizeHistory(raw ? (JSON.parse(raw) as DemoHistoryItem[]) : []);
  } catch {
    return [];
  }
};

const writeGuestHistory = (history: DemoHistoryItem[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    GUEST_HISTORY_KEY,
    JSON.stringify(normalizeHistory(history)),
  );
};

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `请求失败 ${response.status}`);
  }
  return payload;
};

const fetchUserHistory = async () => {
  const payload = await fetchJson<{ history?: DemoHistoryItem[] }>('/api/explore/history', {
    cache: 'no-store',
  });
  return normalizeHistory(payload.history ?? []);
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法读取上传的图片。'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败。'));
    reader.readAsDataURL(file);
  });

interface ClickMarker {
  sceneId: string;
  x: number;
  y: number;
  parentSceneTitle: string;
}

interface ProcessingTag {
  hint: string;
  thumbnailUrl: string | null;
}

type ExploreUiStatus =
  | 'idle'
  | 'queued'
  | 'generating-content'
  | 'generating-image'
  | 'success'
  | 'failed';

type FailedAction =
  | { type: 'root'; topic: string }
  | {
      type: 'node';
      demoId: string;
      sceneId: string;
      hotspot: ExploreKnowledgePoint;
    };

interface CreateExploreSessionResponse {
  session?: ExploreSessionPayload;
  node?: ExploreNodePayload;
  status?: string;
  error?: string;
  code?: string;
  suggestedTopics?: string[];
}

interface AppendExploreNodeResponse {
  session?: ExploreSessionPayload;
  node?: ExploreNodePayload;
  status?: string;
  error?: string;
}

export default function Explorer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emptyUploadRef = useRef<HTMLInputElement>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [historySyncStatus, setHistorySyncStatus] = useState<'idle' | 'saving'>('idle');
  const [history, setHistory] = useState<DemoHistoryItem[]>([]);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ExploreUiStatus>('idle');
  const [processingTag, setProcessingTag] = useState<ProcessingTag | null>(null);
  const [tagDismissed, setTagDismissed] = useState(false);
  const [clickMarker, setClickMarker] = useState<ClickMarker | null>(null);
  const [guestUsage, setGuestUsage] = useState(0);
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);
  const [outOfScopeSuggestions, setOutOfScopeSuggestions] = useState<string[]>([]);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  // 旧场景 zoom-out 转场：保留旧 scene id + 点击位置作为 transform-origin
  const [transitionFrom, setTransitionFrom] = useState<{
    sceneId: string;
    originX: number;
    originY: number;
  } | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const selectedDemo = useMemo(
    () => history.find((item) => item.id === selectedDemoId) ?? null,
    [history, selectedDemoId],
  );

  const selectedScene = useMemo(() => {
    if (!selectedDemo) return null;
    return (
      selectedDemo.scenes.find((scene) => scene.id === selectedSceneId) ??
      selectedDemo.scenes.find((scene) => scene.id === selectedDemo.activeLeafId) ??
      null
    );
  }, [selectedDemo, selectedSceneId]);

  // 面包屑由 activeLeafId（spine 末端）反推 — 即使 selectedScene 是中间某层，
  // breadcrumb 仍展示完整的 root → activeLeaf 链路。
  const lineage = useMemo(() => {
    if (!selectedDemo) return [];
    const leaf = selectedDemo.scenes.find((s) => s.id === selectedDemo.activeLeafId) ?? null;
    return buildSceneLineage(selectedDemo.scenes, leaf);
  }, [selectedDemo]);

  const isProcessing =
    status === 'queued' ||
    status === 'generating-content' ||
    status === 'generating-image';
  const canUseGuestSession = authUser !== null || guestUsage < GUEST_SESSION_LIMIT;
  const canGenerate = userPrompt.trim().length > 0 && !isProcessing && canUseGuestSession;
  const isGuest = authUser === null;
  const isAtRoot = !selectedScene || selectedScene.parentSceneId === null;
  const showClickRing =
    clickMarker !== null &&
    selectedScene !== null &&
    selectedScene.id === clickMarker.sceneId;

  const clearTransition = useCallback(() => {
    setTransitionFrom(null);
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const finalizeProcessing = () => {
    setStatus('idle');
    setProcessingTag(null);
    setTagDismissed(false);
    setClickMarker(null);
  };

  const applyUserHistory = useCallback((user: AuthUser | null, nextHistory: DemoHistoryItem[]) => {
    const restored = normalizeHistory(nextHistory);
    const latest = restored[0] ?? null;
    setAuthUser(user);
    setHistory(restored);
    setSelectedDemoId(latest?.id ?? null);
    setSelectedSceneId(latest?.activeLeafId ?? null);
    clearTransition();
  }, [clearTransition]);

  const handleAuthenticated = async (user: AuthUser) => {
    const restored = await fetchUserHistory();
    window.queueMicrotask(() => {
      applyUserHistory(user, restored);
      setShowAuthPanel(false);
      setAuthStatus('ready');
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const payload = await fetchJson<{ user: AuthUser | null }>('/api/auth/me', {
          cache: 'no-store',
        });
        const restored = payload.user ? await fetchUserHistory() : readGuestHistory();
        if (cancelled) return;
        window.queueMicrotask(() => {
          if (cancelled) return;
          applyUserHistory(payload.user, restored);
          setGuestUsage(readGuestUsage());
          setAuthStatus('ready');
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '读取登录状态失败';
        toast.error('登录状态读取失败', { description: message });
        window.queueMicrotask(() => {
          if (cancelled) return;
          applyUserHistory(null, readGuestHistory());
          setGuestUsage(readGuestUsage());
          setAuthStatus('ready');
        });
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [applyUserHistory]);

  const persistHistory = async (nextHistory: DemoHistoryItem[]) => {
    const normalized = normalizeHistory(nextHistory);
    setHistory(normalized);
    if (!authUser) {
      writeGuestHistory(normalized);
      return normalized;
    }

    setHistorySyncStatus('saving');
    try {
      const payload = await fetchJson<{ history?: DemoHistoryItem[] }>('/api/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: normalized }),
      });
      const saved = normalizeHistory(payload.history ?? normalized);
      setHistory(saved);
      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务器保存失败';
      toast.error('历史记录保存失败', { description: message });
      return normalized;
    } finally {
      setHistorySyncStatus('idle');
    }
  };

  const handleLogout = async () => {
    if (isProcessing) return;
    if (!authUser) {
      setShowAuthPanel(true);
      return;
    }
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '退出失败';
      toast.error('退出登录失败', { description: message });
    } finally {
      applyUserHistory(null, readGuestHistory());
      setReferenceFile(null);
    }
  };

  const startTransition = (sceneId: string, x: number, y: number) => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }
    setTransitionFrom({ sceneId, originX: x, originY: y });
    transitionTimerRef.current = window.setTimeout(() => {
      setTransitionFrom(null);
      transitionTimerRef.current = null;
    }, 2020);
  };

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const handleNewSession = () => {
    if (isProcessing) return;
    setUserPrompt('');
    setReferenceFile(null);
    setSelectedDemoId(null);
    setSelectedSceneId(null);
    clearTransition();
  };

  const handleSelectDemo = (demoId: string) => {
    if (isProcessing) return;
    const demo = history.find((item) => item.id === demoId);
    if (!demo) return;
    clearTransition();
    setSelectedDemoId(demoId);
    setSelectedSceneId(demo.activeLeafId);
  };

  const handleDeleteDemo = (demoId: string) => {
    if (isProcessing) return;
    const next = history.filter((item) => item.id !== demoId);
    if (demoId === selectedDemoId) {
      const fallback = next[0] ?? null;
      setSelectedDemoId(fallback?.id ?? null);
      setSelectedSceneId(fallback?.activeLeafId ?? null);
      clearTransition();
    }
    void persistHistory(next);
  };

  const handleClearHistory = () => {
    if (isProcessing) return;
    setHistory([]);
    setSelectedDemoId(null);
    setSelectedSceneId(null);
    clearTransition();
    void persistHistory([]);
  };

  const handleSelectLineage = (sceneId: string) => {
    if (isProcessing) return;
    clearTransition();
    setSelectedSceneId(sceneId);
  };

  const handleGoBack = () => {
    if (isProcessing) return;
    if (!selectedScene?.parentSceneId) return;
    clearTransition();
    setSelectedSceneId(selectedScene.parentSceneId);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setReferenceFile(file);
    event.target.value = '';
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleStartGenerate();
    }
  };

  const buildSceneFromNode = ({
    node,
    imageUrl,
    depth,
    parentSceneId,
    sourceHotspot,
  }: {
    node: ExploreNodePayload;
    imageUrl: string;
    depth: number;
    parentSceneId: string | null;
    sourceHotspot?: ExploreKnowledgePoint | null;
  }): GeneratedScene => ({
    id: node.id,
    title: node.title,
    summary: node.intro,
    intro: node.intro,
    imagePrompt: node.imagePrompt,
    scope: node.scope,
    hotspots: node.knowledgePoints,
    nextTopics: node.nextTopics,
    imageUrl,
    depth,
    parentSceneId,
    sourceHotspotId: sourceHotspot?.id ?? null,
    sourceHotspotLabel: sourceHotspot?.label ?? null,
  });

  const handleStartGenerate = async (topicOverride?: string) => {
    const topic = (topicOverride ?? userPrompt).trim();
    if (!topic || isProcessing) return;
    if (!authUser && guestUsage >= GUEST_SESSION_LIMIT) {
      toast.info('访客试用次数已用完，登录后可以继续探索并保存历史。');
      setShowAuthPanel(true);
      return;
    }

    setUserPrompt(topic);
    setFailedAction(null);
    setOutOfScopeSuggestions([]);
    setStatus('queued');
    setTagDismissed(false);
    setProcessingTag({
      hint: referenceFile
        ? `根据参考图「${referenceFile.name}」生成总览图`
        : `排队中：准备生成「${topic}」`,
      thumbnailUrl: null,
    });

    try {
      const referenceImageUrl = referenceFile ? await readFileAsDataUrl(referenceFile) : null;
      setStatus('generating-content');
      setProcessingTag({
        hint: `正在判断主题范围并生成「${topic}」的结构化知识点`,
        thumbnailUrl: null,
      });

      const response = await fetch('/api/explore/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const payload = (await response.json().catch(() => ({}))) as CreateExploreSessionResponse;

      if (!response.ok || !payload.session || !payload.node) {
        if (payload.code === 'out_of_scope') {
          const suggestions = payload.suggestedTopics?.length
            ? payload.suggestedTopics
            : recommendedTopics;
          setOutOfScopeSuggestions(suggestions);
          setFailedAction({ type: 'root', topic: suggestions[0] ?? topic });
          toast.info(payload.error ?? '这个主题暂时不在实时探索范围内。');
          return;
        }
        throw new Error(payload.error ?? `请求失败 ${response.status}`);
      }

      setStatus('generating-image');
      setProcessingTag({
        hint: `生成中：正在绘制「${payload.node.title}」百科图版`,
        thumbnailUrl: null,
      });
      const rootImageUrl = await generateOverviewImage({
        prompt: payload.node.imagePrompt,
        referenceImageUrl,
      });

      const rootScene = buildSceneFromNode({
        node: payload.node,
        imageUrl: rootImageUrl,
        depth: 0,
        parentSceneId: null,
      });

      const demo: DemoHistoryItem = {
        id: makeId('demo'),
        name: rootScene.title,
        createdAt: new Date().toISOString(),
        prompt: topic,
        exploreSessionId: payload.session.id,
        rootImageUrl,
        rootSceneId: rootScene.id,
        activeLeafId: rootScene.id,
        scenes: [rootScene],
      };

      const nextHistory = [demo, ...history].slice(0, MAX_HISTORY_ITEMS);
      void persistHistory(nextHistory);
      if (!authUser) {
        const nextUsage = guestUsage + 1;
        setGuestUsage(nextUsage);
        writeGuestUsage(nextUsage);
      }
      clearTransition();
      setSelectedDemoId(demo.id);
      setSelectedSceneId(rootScene.id);
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      setFailedAction({ type: 'root', topic });
      setStatus('failed');
      toast.error('总览图生成失败', { description: message });
    } finally {
      finalizeProcessing();
    }
  };

  const handleSceneClick = () => {
    if (isProcessing) return;
    toast.info('请选择图版上的知识点继续探索');
  };

  const handleKnowledgePointClick = async (hotspot: ExploreKnowledgePoint) => {
    if (isProcessing) {
      toast.info('上一张还在生成，请稍等');
      return;
    }
    if (!selectedDemo || !selectedScene) {
      toast.info('请先生成一张总览图');
      return;
    }
    if (!selectedDemo.exploreSessionId) {
      toast.info('这条旧记录没有结构化知识点，请重新生成一次主题。');
      return;
    }

    const marker: ClickMarker = {
      sceneId: selectedScene.id,
      x: hotspot.position.x,
      y: hotspot.position.y,
      parentSceneTitle: selectedScene.title,
    };
    setClickMarker(marker);
    setTagDismissed(false);
    setFailedAction(null);
    setStatus('queued');
    setProcessingTag({
      hint: `排队中：准备进入「${hotspot.label}」`,
      thumbnailUrl: selectedScene.imageUrl,
    });

    try {
      setStatus('generating-content');
      setProcessingTag({
        hint: `正在生成「${hotspot.label}」的下一层知识点`,
        thumbnailUrl: selectedScene.imageUrl,
      });
      const payload = await fetchJson<AppendExploreNodeResponse>(
        `/api/explore/sessions/${encodeURIComponent(selectedDemo.exploreSessionId)}/nodes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentNodeId: selectedScene.id,
            pointId: hotspot.id,
          }),
        },
      );
      if (!payload.session || !payload.node) {
        throw new Error(payload.error ?? '下一层结构化内容生成失败');
      }

      const croppedImage = await cropImageToHotspot(
        selectedScene.imageUrl,
        hotspot,
      );

      setStatus('generating-image');
      setProcessingTag({
        hint: `生成中：正在绘制「${payload.node.title}」`,
        thumbnailUrl: croppedImage,
      });
      const childImageUrl = await generateFocusedSceneImage({
        sourceImageUrl: croppedImage,
        hotspot: {
          ...hotspot,
          label: payload.node.title,
          generationPrompt: payload.node.imagePrompt,
        },
      });

      const childScene = buildSceneFromNode({
        node: payload.node,
        imageUrl: childImageUrl,
        depth: selectedScene.depth + 1,
        parentSceneId: selectedScene.id,
        sourceHotspot: hotspot,
      });

      // 如果用户在中间节点（selectedScene 不是 spine 末端）发起重新生成，
      // 截断 selectedScene 之后到 activeLeaf 的所有旧场景。
      const idsToRemove =
        selectedScene.id !== selectedDemo.activeLeafId
          ? collectDescendantsOnSpine(
              selectedDemo.scenes,
              selectedScene.id,
              selectedDemo.activeLeafId,
            )
          : new Set<string>();

      const nextHistory = history.map((item) =>
        item.id === selectedDemo.id
          ? {
              ...item,
              scenes: [
                ...item.scenes.filter((scene) => !idsToRemove.has(scene.id)),
                childScene,
              ],
              activeLeafId: childScene.id,
            }
          : item,
      );
      void persistHistory(nextHistory);
      // 触发 flipbook 风 zoom-out 转场：旧 scene 以点击位置为中心撑大淡出，
      // 新 scene 在底层直接显示，模拟"钻进点击区域"。
      startTransition(selectedScene.id, hotspot.position.x, hotspot.position.y);
      setSelectedSceneId(childScene.id);
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      setFailedAction({
        type: 'node',
        demoId: selectedDemo.id,
        sceneId: selectedScene.id,
        hotspot,
      });
      setStatus('failed');
      toast.error('细节图生成失败', { description: message });
    } finally {
      finalizeProcessing();
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();
  const triggerEmptyUpload = () => emptyUploadRef.current?.click();

  const handleTopicSelect = (topic: string) => {
    setUserPrompt(topic);
    setOutOfScopeSuggestions([]);
  };

  const handleRetry = () => {
    if (!failedAction || isProcessing) return;
    if (failedAction.type === 'root') {
      void handleStartGenerate(failedAction.topic);
      return;
    }

    if (selectedDemoId !== failedAction.demoId) {
      setSelectedDemoId(failedAction.demoId);
    }
    setSelectedSceneId(failedAction.sceneId);
    void handleKnowledgePointClick(failedAction.hotspot);
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (showAuthPanel && !authUser) {
    return (
      <AuthPanel
        onAuthenticated={handleAuthenticated}
        onCancel={() => setShowAuthPanel(false)}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen items-stretch overflow-hidden p-4">
      {/* Browser-frame outer card */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-foreground/15 bg-card/70 shadow-[0_24px_60px_-30px_rgba(40,28,16,0.35)] backdrop-blur-sm">
        <HistorySidebar
          history={history}
          selectedDemoId={selectedDemoId}
          onSelectDemo={handleSelectDemo}
          onNewSession={handleNewSession}
          onDeleteDemo={handleDeleteDemo}
          onClearHistory={handleClearHistory}
          username={authUser?.username ?? `访客试用 ${guestUsage}/${GUEST_SESSION_LIMIT}`}
          isGuest={isGuest}
          isHistorySaving={historySyncStatus === 'saving'}
          onLogout={handleLogout}
          onLoginRequest={() => setShowAuthPanel(true)}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Window top bar: traffic lights + pill input */}
          <header className="flex items-center gap-4 border-b border-foreground/10 px-5 py-3">
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full border border-foreground/30" />
              <span className="h-2.5 w-2.5 rounded-full border border-foreground/30" />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <div
              className={cn(
                'flex flex-1 items-center gap-2 rounded-full border-2 border-foreground/80 bg-background/70 px-5 py-2 transition',
                isProcessing && 'opacity-60',
              )}
            >
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="描述你想看的总览场景..."
                disabled={isProcessing}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/35"
              />
              {referenceFile && (
                <span className="hidden items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] text-foreground/70 sm:inline-flex">
                  <span className="max-w-[120px] truncate">{referenceFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setReferenceFile(null)}
                    className="text-foreground/50 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={triggerUpload}
                disabled={isProcessing}
                title={referenceFile ? `已选：${referenceFile.name}` : '上传参考图（可选）'}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-foreground/30 transition',
                  referenceFile
                    ? 'bg-foreground text-background'
                    : 'bg-background hover:bg-foreground/10',
                )}
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleStartGenerate()}
                disabled={!canGenerate}
                title="生成总览图（回车）"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </header>

          {selectedDemo && (
            <div className="border-b border-foreground/10 px-5 py-2">
              <BreadcrumbNav
                lineage={lineage}
                currentSceneId={selectedScene?.id ?? null}
                onSelect={handleSelectLineage}
              />
            </div>
          )}

          <div className="relative flex-1 overflow-hidden">
            {selectedDemo && selectedScene ? (
              <MapView
                scenes={selectedDemo.scenes.map((s) => ({
                  id: s.id,
                  imageUrl: s.imageUrl,
                  alt: s.title,
                }))}
                currentSceneId={selectedScene.id}
                transitionFrom={transitionFrom}
                onSceneClick={handleSceneClick}
                allowPanZoom
                imageFit="contain"
              >
                {selectedScene.hotspots && selectedScene.hotspots.length > 0 && (
                  <KnowledgePointLayer
                    points={selectedScene.hotspots}
                    disabled={isProcessing}
                    onSelect={handleKnowledgePointClick}
                  />
                )}
                {showClickRing && clickMarker && (
                  <ClickRingMarker
                    x={clickMarker.x}
                    y={clickMarker.y}
                    rippling={isProcessing}
                  />
                )}
              </MapView>
            ) : (
              <EmptyState
                onUpload={triggerEmptyUpload}
                fileInputRef={emptyUploadRef}
                onFileChange={handleFileChange}
                recommendedTopics={outOfScopeSuggestions.length ? outOfScopeSuggestions : recommendedTopics}
                sampleTopics={sampleTopics}
                guestUsage={guestUsage}
                guestLimit={GUEST_SESSION_LIMIT}
                isGuest={isGuest}
                onTopicSelect={handleTopicSelect}
                onGenerateTopic={(topic) => void handleStartGenerate(topic)}
              />
            )}

            {!isProcessing && failedAction && (
              <FailureRetryCard onRetry={handleRetry} />
            )}

            {isProcessing && processingTag && !tagDismissed && (
              <ProcessingTagCard
                hint={processingTag.hint}
                thumbnailUrl={processingTag.thumbnailUrl}
                onDismiss={() => setTagDismissed(true)}
              />
            )}

            {selectedScene && !isAtRoot && !isProcessing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGoBack}
                className="absolute bottom-6 right-6 shadow-md"
              >
                <ArrowLeft className="h-4 w-4" />
                返回上一层
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ClickRingMarker({
  x,
  y,
  rippling,
}: {
  x: number;
  y: number;
  rippling: boolean;
}) {
  return (
    <div
      className="pointer-events-none absolute h-12 w-12"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 持续显示的黑色描边圆环（标记选中点） */}
      <div className="absolute inset-0 rounded-full border-[3px] border-foreground bg-transparent shadow-[0_0_0_2px_rgba(255,255,255,0.6)]" />
      {/* 加载中：从同一中心向外扩散的半透明白色波纹（节奏放慢） */}
      {rippling && (
        <>
          <div className="absolute inset-0 animate-click-ring rounded-full border-[3px] border-white/85" />
          <div
            className="absolute inset-0 animate-click-ring rounded-full border-[3px] border-white/70"
            style={{ animationDelay: '0.85s' }}
          />
          <div
            className="absolute inset-0 animate-click-ring rounded-full border-[3px] border-white/55"
            style={{ animationDelay: '1.7s' }}
          />
        </>
      )}
    </div>
  );
}

function KnowledgePointLayer({
  points,
  disabled,
  onSelect,
}: {
  points: ExploreKnowledgePoint[];
  disabled: boolean;
  onSelect: (point: ExploreKnowledgePoint) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {points.slice(0, 30).map((point) => (
        <button
          key={point.id}
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(point);
          }}
          className="group pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-foreground text-[10px] font-semibold text-background shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition hover:scale-110 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            left: `${point.position.x}%`,
            top: `${point.position.y}%`,
          }}
          title={point.description ?? point.label}
        >
          {point.index ?? point.badge ?? '•'}
          <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden min-w-max -translate-x-1/2 rounded-md border border-foreground/10 bg-card/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-lg group-hover:block">
            {point.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function ProcessingTagCard({
  hint,
  thumbnailUrl,
  onDismiss,
}: {
  hint: string;
  thumbnailUrl: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute right-6 top-6 flex w-[320px] items-start gap-3 rounded-2xl border border-foreground/10 bg-card/95 px-4 py-3 shadow-[0_18px_40px_-16px_rgba(40,28,16,0.45)] backdrop-blur scale-in">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-foreground/15 bg-muted">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm leading-snug text-foreground">{hint}</p>
        <p className="mt-1 text-[11px] text-foreground/50">
          通常需要 30-60 秒，请耐心等待…
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-full p-1 text-foreground/40 transition hover:bg-foreground/10 hover:text-foreground"
        title="收起"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FailureRetryCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute right-6 top-6 flex w-[300px] items-start gap-3 rounded-2xl border border-destructive/20 bg-card/95 px-4 py-3 shadow-[0_18px_40px_-16px_rgba(40,28,16,0.45)] backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">生成没有完成</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          可能是模型超时或服务繁忙，可以从刚才的位置重新尝试。
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:bg-foreground/85"
        title="重试"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyState({
  onUpload,
  fileInputRef,
  onFileChange,
  recommendedTopics,
  sampleTopics,
  guestUsage,
  guestLimit,
  isGuest,
  onTopicSelect,
  onGenerateTopic,
}: {
  onUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  recommendedTopics: string[];
  sampleTopics: string[];
  guestUsage: number;
  guestLimit: number;
  isGuest: boolean;
  onTopicSelect: (topic: string) => void;
  onGenerateTopic: (topic: string) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-auto px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            real-time exploration
          </p>
          <h2 className="mt-4 font-handwriting text-4xl leading-snug text-foreground sm:text-6xl">
            从一个问题进入一张百科图，
            <br />
            再沿着知识点继续深入。
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            首次图版会提供 20-30 个可点击知识点。生成内容以图片百科为主，不是普通聊天回答。
          </p>
          {isGuest && (
            <p className="mt-3 inline-flex rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              访客试用 {guestUsage}/{guestLimit} 次，登录后保存探索历史。
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onUpload}
          className="flex items-center gap-2 rounded-full border-2 border-foreground/80 bg-background/70 px-5 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
        >
          <ImagePlus className="h-4 w-4" />
          上传图片
        </button>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <h3 className="text-sm font-semibold text-foreground">推荐探索入口</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recommendedTopics.slice(0, 6).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onGenerateTopic(topic)}
                  className="rounded-lg border border-border/70 bg-card/70 px-4 py-3 text-left text-sm leading-6 transition hover:border-primary/50 hover:bg-background"
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground">已生成样例的发现感</h3>
            <div className="mt-3 flex flex-col gap-2">
              {sampleTopics.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onTopicSelect(item)}
                  className="rounded-lg border border-border/60 bg-background/50 px-4 py-3 text-left text-sm leading-6 text-muted-foreground transition hover:text-foreground"
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
