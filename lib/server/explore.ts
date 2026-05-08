import { randomUUID } from 'crypto';

import type {
  ExploreKnowledgePoint,
  ExploreNodePayload,
  ExploreScope,
  ExploreSessionPayload,
} from '@/types';

const MAX_TOPIC_LENGTH = 80;
const KNOWLEDGE_POINT_COUNT = 24;

const scopeLabels: Record<ExploreScope, string> = {
  science: '科学',
  history: '历史',
  animal: '动物',
  life: '生活',
};

const scopeKeywords: Record<ExploreScope, string[]> = {
  science: [
    '科学',
    '物理',
    '化学',
    '宇宙',
    '天文',
    '星',
    '光',
    '电',
    '磁',
    '地球',
    '海洋',
    '植物',
    '细胞',
    '人体',
    '机器',
    '芯片',
    'AI',
    '人工智能',
    '数学',
    '实验',
  ],
  history: [
    '历史',
    '古代',
    '文明',
    '王朝',
    '战争',
    '丝绸之路',
    '敦煌',
    '博物馆',
    '文物',
    '卢浮宫',
    '城市',
    '建筑',
    '地图',
    '考古',
    '帝国',
    '遗址',
  ],
  animal: [
    '动物',
    '鸟',
    '鱼',
    '鲸',
    '猫',
    '犬',
    '虎',
    '豹',
    '昆虫',
    '恐龙',
    '海豚',
    '企鹅',
    '熊',
    '蛇',
    '生态',
    '迁徙',
  ],
  life: [
    '生活',
    '食物',
    '食材',
    '蔬菜',
    '水果',
    '烹饪',
    '厨房',
    '健康',
    '运动',
    '安全',
    '交通',
    '家居',
    '天气',
    '急救',
    '衣物',
    '睡眠',
  ],
};

const safetyBlockedKeywords = [
  '色情',
  '裸露',
  '自残',
  '自杀',
  '炸弹',
  '制毒',
  '诈骗',
  '仇恨',
  '血腥',
];

const pointPools: Record<ExploreScope, string[]> = {
  science: [
    '核心结构',
    '能量来源',
    '尺度对比',
    '形成过程',
    '关键材料',
    '内部层级',
    '测量方法',
    '实验线索',
    '常见误解',
    '真实案例',
    '微观视角',
    '宏观影响',
    '变化周期',
    '边界条件',
    '系统连接',
    '运行机制',
    '数据证据',
    '可视化模型',
    '异常现象',
    '未来应用',
    '观察方法',
    '风险边界',
    '比较对象',
    '延伸问题',
  ],
  history: [
    '时间线',
    '地理位置',
    '关键人物',
    '制度背景',
    '技术条件',
    '贸易路线',
    '日常生活',
    '建筑结构',
    '文物线索',
    '冲突转折',
    '文化交流',
    '权力关系',
    '地图变化',
    '材料工艺',
    '重要事件',
    '影响范围',
    '证据来源',
    '复原方式',
    '常见误读',
    '后续影响',
    '对比文明',
    '现场细节',
    '保存现状',
    '继续追问',
  ],
  animal: [
    '头部结构',
    '感官系统',
    '骨骼肌肉',
    '皮毛羽鳞',
    '捕食方式',
    '防御机制',
    '栖息环境',
    '迁徙路线',
    '交流信号',
    '繁殖养育',
    '群体关系',
    '食物链位置',
    '速度与力量',
    '体温调节',
    '隐藏技能',
    '幼体成长',
    '昼夜节律',
    '足迹痕迹',
    '生态作用',
    '生存威胁',
    '保护现状',
    '相似物种',
    '观察方法',
    '下一层谜题',
  ],
  life: [
    '组成结构',
    '来源路径',
    '处理流程',
    '使用场景',
    '关键材料',
    '安全边界',
    '保存方式',
    '常见误区',
    '效率技巧',
    '身体影响',
    '环境因素',
    '成本对比',
    '工具选择',
    '判断信号',
    '变化过程',
    '日常案例',
    '风险点',
    '替代方案',
    '维护方法',
    '体验差异',
    '科学原理',
    '小实验',
    '延伸习惯',
    '下一步问题',
  ],
};

const gridPositions = [
  { x: 12, y: 14 },
  { x: 25, y: 11 },
  { x: 40, y: 13 },
  { x: 57, y: 11 },
  { x: 73, y: 14 },
  { x: 88, y: 18 },
  { x: 9, y: 34 },
  { x: 23, y: 30 },
  { x: 39, y: 32 },
  { x: 59, y: 30 },
  { x: 76, y: 33 },
  { x: 91, y: 39 },
  { x: 10, y: 58 },
  { x: 26, y: 55 },
  { x: 43, y: 58 },
  { x: 58, y: 56 },
  { x: 75, y: 57 },
  { x: 89, y: 61 },
  { x: 13, y: 82 },
  { x: 29, y: 78 },
  { x: 45, y: 83 },
  { x: 61, y: 79 },
  { x: 77, y: 82 },
  { x: 90, y: 78 },
];

export class ExploreError extends Error {
  status: number;
  code: string;
  suggestions?: string[];

  constructor(message: string, status: number, code: string, suggestions?: string[]) {
    super(message);
    this.name = 'ExploreError';
    this.status = status;
    this.code = code;
    this.suggestions = suggestions;
  }
}

const normalizeTopic = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_TOPIC_LENGTH) : '';

export const suggestedExploreTopics = [
  '鲸鱼的歌声如何在海里传播',
  '黑洞边缘会发生什么',
  '丝绸之路如何连接城市',
  '番茄从田间到餐桌的结构',
  '雪豹如何在峭壁间捕猎',
  '雷暴云里面正在发生什么',
];

export const detectExploreScope = (topicValue: unknown): ExploreScope | null => {
  const topic = normalizeTopic(topicValue).toLowerCase();
  if (!topic) return null;

  for (const [scope, keywords] of Object.entries(scopeKeywords) as Array<[ExploreScope, string[]]>) {
    if (keywords.some((keyword) => topic.includes(keyword.toLowerCase()))) {
      return scope;
    }
  }

  return null;
};

export const validateExploreTopic = (topicValue: unknown) => {
  const topic = normalizeTopic(topicValue);
  if (topic.length < 2) {
    throw new ExploreError('请输入一个更具体的探索主题。', 400, 'topic_too_short');
  }

  const blocked = safetyBlockedKeywords.find((keyword) => topic.includes(keyword));
  if (blocked) {
    throw new ExploreError(
      `这个主题包含暂不支持的内容：${blocked}。可以换成科学、历史、动物或生活类主题。`,
      400,
      'unsafe_topic',
    );
  }

  const scope = detectExploreScope(topic);
  if (!scope) {
    throw new ExploreError(
      '这个主题暂时不在实时探索范围内。可以换成科学、历史、动物或生活类主题。',
      422,
      'out_of_scope',
      suggestedExploreTopics,
    );
  }

  return { topic, scope };
};

const buildPath = (topic: string, parent?: ExploreNodePayload, sourcePoint?: ExploreKnowledgePoint) => {
  if (!parent) return [topic];
  return [...parent.path, sourcePoint?.label ?? topic].slice(-8);
};

const buildIntro = (topic: string, scope: ExploreScope, path: string[]) => {
  const scopeLabel = scopeLabels[scope];
  const pathText = path.length > 1 ? `你正在沿着“${path.join(' -> ')}”继续深入。` : '';
  return `${pathText}这张图会把“${topic}”拆成可以继续点击的${scopeLabel}知识点，让发现从一个问题自然长出下一层问题。`;
};

const buildImagePrompt = (topic: string, scope: ExploreScope, path: string[]) =>
  [
    `主题：${topic}`,
    `范围：${scopeLabels[scope]}`,
    path.length > 1 ? `探索路径：${path.join(' -> ')}` : '',
    '请生成一张 4:3 横版百科剖析图，中心主体突出，画面上要有 20-30 个可被用户继续探索的知识点位置。',
    '知识点应围绕结构、过程、证据、关系、细节和下一步问题展开，图像为主，文字短，不要做成长文章或聊天回答。',
  ]
    .filter(Boolean)
    .join('\n');

const buildKnowledgePoints = (
  topic: string,
  scope: ExploreScope,
  path: string[],
): ExploreKnowledgePoint[] =>
  pointPools[scope].slice(0, KNOWLEDGE_POINT_COUNT).map((label, index) => {
    const position = gridPositions[index % gridPositions.length];
    const nextTopic = `${topic}：${label}`;
    return {
      id: `kp-${index + 1}-${randomUUID().slice(0, 8)}`,
      index: index + 1,
      label,
      category: scopeLabels[scope],
      badge: `${index + 1}`,
      description: `继续探索“${topic}”里的${label}。`,
      nextTopic,
      generationPrompt: [
        `请基于裁剪区域继续生成“${nextTopic}”的下一张百科剖析图。`,
        `当前探索路径：${[...path, label].join(' -> ')}`,
        '保持主体突出，提供 20-30 个新的可点击知识点。',
      ].join('\n'),
      position,
      bounds: {
        x: Math.max(2, position.x - 8),
        y: Math.max(2, position.y - 8),
        width: 16,
        height: 16,
      },
    };
  });

export const buildExploreNode = ({
  topic,
  scope,
  depth,
  parent,
  sourcePoint,
}: {
  topic: string;
  scope: ExploreScope;
  depth: number;
  parent?: ExploreNodePayload;
  sourcePoint?: ExploreKnowledgePoint;
}): ExploreNodePayload => {
  const path = buildPath(topic, parent, sourcePoint);
  return {
    id: `node-${randomUUID()}`,
    title: depth === 0 ? `${topic} 知识图版` : `${sourcePoint?.label ?? topic} 深入图版`,
    intro: buildIntro(topic, scope, path),
    imagePrompt: buildImagePrompt(topic, scope, path),
    scope,
    path,
    knowledgePoints: buildKnowledgePoints(topic, scope, path),
    nextTopics: pointPools[scope].slice(0, 6).map((label) => `${topic}：${label}`),
    status: 'succeeded',
  };
};

export const createExploreSession = (topicValue: unknown, userId: string | null) => {
  const { topic, scope } = validateExploreTopic(topicValue);
  const now = new Date().toISOString();
  const root = buildExploreNode({ topic, scope, depth: 0 });
  const session: ExploreSessionPayload & { userId: string | null } = {
    id: `session-${randomUUID()}`,
    topic,
    scope,
    status: 'succeeded',
    createdAt: now,
    updatedAt: now,
    activeNodeId: root.id,
    nodes: [root],
    userId,
  };
  return session;
};

export const appendExploreNode = (
  session: ExploreSessionPayload & { userId: string | null },
  parentNodeId: string,
  pointId: string,
) => {
  const parent = session.nodes.find((node) => node.id === parentNodeId);
  if (!parent) {
    throw new ExploreError('找不到要继续探索的上一张图版。', 404, 'parent_not_found');
  }

  const sourcePoint = parent.knowledgePoints.find((point) => point.id === pointId);
  if (!sourcePoint) {
    throw new ExploreError('找不到这个知识点。', 404, 'point_not_found');
  }

  const child = buildExploreNode({
    topic: sourcePoint.nextTopic,
    scope: parent.scope,
    depth: parent.path.length,
    parent,
    sourcePoint,
  });

  return {
    ...session,
    status: 'succeeded' as const,
    updatedAt: new Date().toISOString(),
    activeNodeId: child.id,
    nodes: [...session.nodes, child],
  };
};
