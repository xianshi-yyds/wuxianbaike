'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SceneEntry {
  id: string;
  imageUrl: string;
  alt?: string;
}

interface MapViewProps {
  scenes: SceneEntry[];
  currentSceneId: string;
  /**
   * 上一张正在"撑大淡出"的 scene。有值时该 scene 叠在 current 之上，
   * 以 (originX%, originY%) 为 transform-origin 从 scale(1) 撑大到 scale(5)
   * 同时 opacity 1→0，揭开下层 currentScene，模拟"钻进点击区域"。
   * 转场结束（约 720ms 后）由父组件清空。
   */
  transitionFrom?: { sceneId: string; originX: number; originY: number } | null;
  onSceneClick?: (position: { x: number; y: number }) => void;
  onImageError?: (src: string) => void;
  onImageLoad?: () => void;
  allowPanZoom?: boolean;
  imageFit?: 'cover' | 'contain';
  children?: React.ReactNode;
}

interface NaturalSize {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function MapView({
  scenes,
  currentSceneId,
  transitionFrom,
  onSceneClick,
  onImageError,
  onImageLoad,
  allowPanZoom = true,
  imageFit = 'contain',
  children,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [naturalSizes, setNaturalSizes] = useState<Record<string, NaturalSize>>({});
  const dragStart = useRef({ x: 0, y: 0 });
  const transformStart = useRef({ x: 0, y: 0 });
  const movedDuringDrag = useRef(false);

  // 切换 scene 时重置 pan/zoom 到初始
  useEffect(() => {
    window.queueMicrotask(() => {
      setTransform({ scale: 1, x: 0, y: 0 });
    });
  }, [currentSceneId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!allowPanZoom) return;
      setIsDragging(true);
      movedDuringDrag.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      transformStart.current = { x: transform.x, y: transform.y };
    },
    [allowPanZoom, transform.x, transform.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!allowPanZoom || !isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        movedDuringDrag.current = true;
      }
      setTransform((prev) => ({
        ...prev,
        x: transformStart.current.x + dx,
        y: transformStart.current.y + dy,
      }));
    },
    [allowPanZoom, isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!allowPanZoom) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setTransform((prev) => ({
        ...prev,
        scale: clamp(prev.scale + delta, 0.92, 2.4),
      }));
    },
    [allowPanZoom],
  );

  const handleActivePlaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSceneClick) return;
      if (movedDuringDrag.current) {
        movedDuringDrag.current = false;
        return;
      }
      const plane = planeRefs.current.get(currentSceneId);
      if (!plane) return;
      const rect = plane.getBoundingClientRect();
      const rx = ((e.clientX - rect.left) / rect.width) * 100;
      const ry = ((e.clientY - rect.top) / rect.height) * 100;
      if (rx < 0 || rx > 100 || ry < 0 || ry > 100) return;
      onSceneClick({ x: clamp(rx, 0, 100), y: clamp(ry, 0, 100) });
    },
    [currentSceneId, onSceneClick],
  );

  const getImagePlaneStyle = (sceneId: string): React.CSSProperties => {
    const ns = naturalSizes[sceneId];
    if (
      imageFit !== 'contain' ||
      !ns?.width ||
      !ns?.height ||
      !viewportSize.width ||
      !viewportSize.height
    ) {
      return { left: '0px', top: '0px', width: '100%', height: '100%' };
    }
    const scale = Math.min(viewportSize.width / ns.width, viewportSize.height / ns.height);
    const width = ns.width * scale;
    const height = ns.height * scale;
    return {
      left: `${(viewportSize.width - width) / 2}px`,
      top: `${(viewportSize.height - height) / 2}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-[#f3efe7] ${
        allowPanZoom ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(211,187,149,0.22),_transparent_26%)]" />

      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center center',
        }}
      >
        {scenes.map((scene) => {
          const isActive = scene.id === currentSceneId;
          const isZoomingOut = transitionFrom?.sceneId === scene.id;

          // 层级：旧图（zoomingOut）在最上面 z=3 滑出，新图 z=1 在底层从点击位置长大
          // layerStyle 一律 transition: none，避免 keyframe forwards 失效后多余的 fade
          const layerStyle: React.CSSProperties = {
            opacity: isActive || isZoomingOut ? 1 : 0,
            pointerEvents: isActive && !isZoomingOut ? 'auto' : 'none',
            transition: 'none',
            zIndex: isZoomingOut ? 3 : isActive ? 1 : 0,
          };

          // image-plane 上叠加动画 transform：
          //   旧图：纯平移到左下角外（无缩放无淡出），2250ms
          //   新图：起始位置/大小 = 点击区域，scale 0.16→1，2250ms 延迟 600ms
          // CSS 变量 --enter-tx / --enter-ty 让新图中心对齐点击区域中心
          const baseImagePlaneStyle = getImagePlaneStyle(scene.id);
          let planeAnimationStyle: React.CSSProperties = {};
          // 双图共享同一个 transform-origin = 点击位置（plane 系，0-100%），
          // 同步缩放：老图 1→6.25，新图 0.16→1，相同 easing 保证瞬时比例固定。
          // 1500ms 后两者同时到达终态，老图被外层 layer.opacity 瞬间切掉露出新图。
          const sharedOrigin = transitionFrom
            ? `${transitionFrom.originX}% ${transitionFrom.originY}%`
            : '50% 50%';
          if (isZoomingOut) {
            // 老图：zoom 2000ms ease-out + 独立 fade 500ms linear 延迟 1500ms
            // --end-tx / --end-ty 朝点击点反方向（plane 系百分比），让 click 区域
            // 逐渐移到视口中央
            planeAnimationStyle = {
              transformOrigin: sharedOrigin,
              animation:
                'flipbookOldZoom 2000ms cubic-bezier(0.22, 1, 0.36, 1) both, ' +
                'flipbookOldFade 800ms linear 1200ms both',
              willChange: 'transform, opacity',
              ['--end-tx' as string]: `${-(transitionFrom.originX - 50)}%`,
              ['--end-ty' as string]: `${-(transitionFrom.originY - 50)}%`,
            } as React.CSSProperties;
          } else if (isActive && transitionFrom) {
            // 新图：scale 0.16→1，1500ms 时已经到位，等老图开始淡出露出
            planeAnimationStyle = {
              transformOrigin: sharedOrigin,
              animation:
                'flipbookNewZoomIn 1500ms cubic-bezier(0.22, 1, 0.36, 1) both',
              willChange: 'transform',
            };
          }

          return (
            <div key={scene.id} className="absolute inset-0" style={layerStyle}>
              <div className="absolute inset-0">
                <div
                  ref={(el) => {
                    if (el) planeRefs.current.set(scene.id, el);
                    else planeRefs.current.delete(scene.id);
                  }}
                  className="absolute"
                  style={{ ...baseImagePlaneStyle, ...planeAnimationStyle }}
                  onClick={isActive && !isZoomingOut ? handleActivePlaneClick : undefined}
                >
                  <img
                    src={scene.imageUrl}
                    alt={scene.alt ?? ''}
                    className="h-full w-full select-none object-fill"
                    draggable={false}
                    decoding="async"
                    onLoad={(event) => {
                      const target = event.currentTarget;
                      setNaturalSizes((prev) => {
                        const existing = prev[scene.id];
                        if (
                          existing &&
                          existing.width === target.naturalWidth &&
                          existing.height === target.naturalHeight
                        ) {
                          return prev;
                        }
                        return {
                          ...prev,
                          [scene.id]: {
                            width: target.naturalWidth,
                            height: target.naturalHeight,
                          },
                        };
                      });
                      if (isActive) onImageLoad?.();
                    }}
                    onError={() => onImageError?.(scene.imageUrl)}
                  />
                  {isActive && children}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
