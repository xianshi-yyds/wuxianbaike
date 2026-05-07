export interface ImageHotspot {
  id: string;
  label: string;
  description?: string;
  generationPrompt?: string;
  badge?: string;
  position: { x: number; y: number };
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  index?: number;
}

export interface GeneratedScene {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  depth: number;
  parentSceneId: string | null;
  sourceHotspotId: string | null;
  sourceHotspotLabel: string | null;
}

export interface DemoHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  prompt: string;
  rootImageUrl: string;
  rootSceneId: string;
  /** 当前 spine 的最深节点；breadcrumb 由它向上回溯 */
  activeLeafId: string;
  scenes: GeneratedScene[];
}

export interface AuthUser {
  id: string;
  username: string;
}
