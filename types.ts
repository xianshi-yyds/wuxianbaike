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

export type ExploreScope = 'science' | 'history' | 'animal' | 'life';

export type ExploreSessionStatus =
  | 'queued'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'out_of_scope';

export interface ExploreKnowledgePoint extends ImageHotspot {
  nextTopic: string;
  category: string;
}

export interface ExploreNodePayload {
  id: string;
  title: string;
  intro: string;
  imagePrompt: string;
  scope: ExploreScope;
  path: string[];
  knowledgePoints: ExploreKnowledgePoint[];
  nextTopics: string[];
  status: ExploreSessionStatus;
}

export interface ExploreSessionPayload {
  id: string;
  topic: string;
  scope: ExploreScope;
  status: ExploreSessionStatus;
  createdAt: string;
  updatedAt: string;
  activeNodeId: string;
  nodes: ExploreNodePayload[];
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
  intro?: string;
  imagePrompt?: string;
  scope?: ExploreScope;
  hotspots?: ExploreKnowledgePoint[];
  nextTopics?: string[];
}

export interface DemoHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  prompt: string;
  exploreSessionId?: string;
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
