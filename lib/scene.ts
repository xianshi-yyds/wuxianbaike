import type { GeneratedScene, ImageHotspot } from '@/types';

export const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createClickFocusHotspot = (
  position: { x: number; y: number },
  sceneTitle: string,
): ImageHotspot => {
  const width = 16;
  const height = 16;
  const x = Math.max(4, Math.min(100 - width - 4, position.x - width / 2));
  const y = Math.max(4, Math.min(100 - height - 4, position.y - height / 2));

  return {
    id: makeId('focus-hotspot'),
    label: `${sceneTitle} 点击区域`,
    description: `围绕"${sceneTitle}"中用户点击并裁剪出的这一块区域继续生成更细节的解析图。`,
    generationPrompt: '请根据裁剪图中的内容，围绕该区域的主体、结构、材质、功能关系或局部信息生成更细致的解析图。',
    badge: '点击放大',
    position,
    bounds: { x, y, width, height },
  };
};

export const buildSceneLineage = (
  scenes: GeneratedScene[],
  scene: GeneratedScene | null,
): GeneratedScene[] => {
  if (!scene) return [];
  const lineage: GeneratedScene[] = [];
  let cursor: GeneratedScene | null = scene;

  while (cursor) {
    const current: GeneratedScene = cursor;
    lineage.unshift(current);
    cursor = current.parentSceneId
      ? scenes.find((item) => item.id === current.parentSceneId) ?? null
      : null;
  }

  return lineage;
};

/**
 * 在 spine（从 root 到 activeLeaf 的链路）上，
 * 收集 ancestorId 之后（不含自己）到 activeLeaf 的所有节点 id。
 * 用于"在祖先节点点击重新生成"时把后续节点剪掉。
 */
export const collectDescendantsOnSpine = (
  scenes: GeneratedScene[],
  ancestorId: string,
  activeLeafId: string,
): Set<string> => {
  const toRemove = new Set<string>();
  let cursor: GeneratedScene | null =
    scenes.find((item) => item.id === activeLeafId) ?? null;
  while (cursor && cursor.id !== ancestorId) {
    toRemove.add(cursor.id);
    const parentId = cursor.parentSceneId;
    cursor = parentId ? scenes.find((item) => item.id === parentId) ?? null : null;
  }
  return toRemove;
};
