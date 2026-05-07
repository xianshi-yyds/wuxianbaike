import type { ImageHotspot } from '@/types';

const APIMART_PROXY_UPLOAD_ENDPOINT = '/api/apimart/upload';
const APIMART_PROXY_GENERATE_ENDPOINT = '/api/apimart/generate';
const APIMART_PROXY_TASKS_ENDPOINT = '/api/apimart/tasks';
const APIMART_PROXY_IMAGE_ENDPOINT = '/api/apimart/image';
const GENERATED_IMAGE_SAVE_ENDPOINT = '/api/generated/images';
const IMAGE_HOST = 'https://xianshi.icu';
const GENERATE_TIMEOUT_MS = 300_000;
const TASK_INITIAL_DELAY_MS = 10_000;
const TASK_POLL_INTERVAL_MS = 4_000;
const DEFAULT_IMAGE_SIZE = '4:3';
const GENERATE_RETRY_DELAYS_MS = [2_500, 6_000, 12_000];
const RETRYABLE_GENERATE_STATUS = new Set([429, 500, 502, 503, 504]);

export const defaultStylePrompt = `风格参考：
- 欧洲古典旅行指南
- 博物馆官方导览页
- Vintage infographic
- Isometric architectural guide
- Editorial museum brochure
主体画风：
- 精致钢笔线稿 + 水彩淡彩上色
- 米白色、羊皮纸色、浅灰褐色为主
- 低饱和暖色调
- 古典排版
- 高细节建筑透视
- 对称稳定构图
色彩：
- parchment beige
- sepia
- ivory
- warm gray
- muted gold accents
禁止：
- 现代UI
- 浏览器框
- 强烈鲜艳色彩
- 卡通化
- 写实摄影风
- 过度3D渲染
- 杂乱背景`;

const encyclopediaPlateStructurePrompt = `百科剖析图结构要求：
- 默认生成 4:3 横版图像，像高级科普杂志、植物科学图册、食材科学图解页或技术说明图中的单页。
- 采用"大主体 + 少量重点模块"：中心主体必须明显放大，占据画面主要视觉面积，成为绝对焦点。
- 四周仅安排 5-7 个信息模块，每个模块只表达一个重点；标题短，说明 1-3 行，图为主、字为辅。
- 可按主题选择 Growth Stages、Soil & Root Uptake、Texture / Cell Structure、Trim & Wash、Cooking Journey、Nutrient & Storage Summary、From Field to Table 等模块，但不要全部硬塞。
- 如果主题不是植物、食材或自然科学，也要沿用同样的百科剖析图逻辑，转译为对应主题的结构、材质、功能、流程或局部关系。
- 主体可包含完整主体、剖开后的主体、局部切面，并只用 3-5 个细引导线标注最关键结构点。
- 背景使用 warm off-white / ivory / pale paper beige，线条使用 taupe / soft graphite，主体和辅助色保持低饱和、印刷型技术图解配色。
- 保持舒适留白、细边框、细箭头或细虚线；不要信息过密、文字过长、模块过多、视觉焦点混乱。`;

const focusedPlateStructurePrompt = `下一层细节图结构要求：
- 仍然保持 4:3 横版百科剖析图逻辑，围绕红框区域生成更近、更清楚、更有层次的局部解析图。
- 红框主体必须放大并居中，优先展示局部结构、剖面、质地、功能关系或关键细节。
- 周围只保留 3-5 个短标注或少量辅助模块，不要把画面做成密集信息板。
- 保持上一层的低饱和图册页视觉语言、纸张感、细线描边和克制留白。`;

interface ApimartTaskSubmitResponse {
  code?: number;
  data?: Array<{
    status?: string;
    task_id?: string;
  }>;
}

interface ApimartTaskStatusResponse {
  code?: number;
  data?: {
    id?: string;
    status?: string;
    progress?: number;
    result?: {
      images?: Array<{
        url?: string[];
      }>;
    };
    error?: {
      message?: string;
      code?: number | string;
      type?: string;
    };
  };
}

class GenerateHttpError extends Error {}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const getGenerateFailureMessage = (status: number, text: string, retried: boolean) => {
  let upstreamMessage = '';
  try {
    const payload = JSON.parse(text) as {
      error?: {
        message?: string;
        type?: string;
      };
    };
    upstreamMessage = payload.error?.message?.trim() ?? '';
  } catch {
    upstreamMessage = text.trim();
  }

  if (status === 503) {
    return retried
      ? '生图服务暂时繁忙（503），已经自动重试多次仍未成功，请稍后再试。'
      : '生图服务暂时繁忙（503），请稍后再试。';
  }

  if (status === 429) {
    return retried
      ? '生图服务请求过于频繁（429），已经自动重试多次仍未成功，请稍后再试。'
      : '生图服务请求过于频繁（429），请稍后再试。';
  }

  return upstreamMessage
    ? `请求失败 ${status}: ${upstreamMessage}`
    : `请求失败 ${status}`;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('无法把图片 Blob 转成 data URL。'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取图片 Blob 失败。'));
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error('无法读取 data URL 图片数据。');
  }
  return response.blob();
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    image.src = src;
  });

const downscaleImageDataUrl = async (
  source: string,
  maxDimension = 1400,
  quality = 0.82,
): Promise<string> => {
  const image = await loadImageElement(source);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (longestSide <= maxDimension) return source;

  const scale = maxDimension / longestSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return source;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

const convertImageDataUrlToWebp = async (
  source: string,
  quality = 0.82,
): Promise<string> => {
  const image = await loadImageElement(source);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return source;

  context.drawImage(image, 0, 0);
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : source;
};

const normalizeImageUrl = (value: string): string => {
  const trimmed = value.trim().replace(/[)\],.;]+$/, '');
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return `${IMAGE_HOST}${trimmed}`;
  return `${IMAGE_HOST}/${trimmed.replace(/^\.?\//, '')}`;
};

const fetchImageAsDataUrl = async (url: string): Promise<string> => {
  const proxied = `${APIMART_PROXY_IMAGE_ENDPOINT}?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxied);
  if (!response.ok) {
    throw new Error(`生成图下载失败 ${response.status}: ${url}`);
  }
  const blob = await response.blob();
  const rawDataUrl = await blobToDataUrl(blob);
  return downscaleImageDataUrl(rawDataUrl);
};

const resolveGeneratedImageSource = async (value: string): Promise<string> => {
  const normalized = normalizeImageUrl(value);
  if (normalized.startsWith('data:image/')) {
    return downscaleImageDataUrl(normalized);
  }
  try {
    return await fetchImageAsDataUrl(normalized);
  } catch {
    return normalized;
  }
};

const saveGeneratedImage = async (imageSource: string, filenamePrefix: string): Promise<string> => {
  const storableImageSource = imageSource.startsWith('data:image/')
    ? await convertImageDataUrlToWebp(imageSource)
    : imageSource;
  const body = imageSource.startsWith('data:image/')
    ? { imageDataUrl: storableImageSource, filenamePrefix }
    : { imageUrl: normalizeImageUrl(storableImageSource), filenamePrefix };

  const response = await fetch(GENERATED_IMAGE_SAVE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`保存生成图片失败 ${response.status}: ${text}`);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('保存生成图片成功，但没有返回 URL。');
  }
  return payload.url;
};

const uploadImageToApimart = async (imageSource: string, filename: string): Promise<string> => {
  let blob: Blob;
  if (imageSource.startsWith('data:image/')) {
    blob = await dataUrlToBlob(imageSource);
  } else {
    const normalized = normalizeImageUrl(imageSource);
    const proxied = normalized.startsWith('http')
      ? `${APIMART_PROXY_IMAGE_ENDPOINT}?url=${encodeURIComponent(normalized)}`
      : normalized;
    const response = await fetch(proxied);
    if (!response.ok) {
      throw new Error(`上传前下载图片失败 ${response.status}: ${normalized}`);
    }
    blob = await response.blob();
  }

  const imageDataUrl = await blobToDataUrl(blob);
  const response = await fetch(APIMART_PROXY_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, imageDataUrl }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`上传参考图失败 ${response.status}: ${text}`);
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('上传参考图成功，但没有返回 URL。');
  }
  return payload.url;
};

const postGenerateJson = async <T>(body: Record<string, unknown>, timeoutMs: number): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= GENERATE_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(APIMART_PROXY_GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        const canRetry =
          RETRYABLE_GENERATE_STATUS.has(response.status) &&
          attempt < GENERATE_RETRY_DELAYS_MS.length;

        if (canRetry) {
          await sleep(GENERATE_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        throw new GenerateHttpError(
          getGenerateFailureMessage(response.status, text, attempt > 0),
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
      }

      if (error instanceof GenerateHttpError) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error('请求失败');

      if (attempt < GENERATE_RETRY_DELAYS_MS.length) {
        await sleep(GENERATE_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw lastError;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('请求失败');
};

const getTaskStatus = async (taskId: string): Promise<ApimartTaskStatusResponse> => {
  const response = await fetch(`${APIMART_PROXY_TASKS_ENDPOINT}/${encodeURIComponent(taskId)}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`轮询任务失败 ${response.status}: ${text}`);
  }
  return (await response.json()) as ApimartTaskStatusResponse;
};

const waitForApimartTaskImage = async (taskId: string): Promise<string> => {
  const startedAt = Date.now();
  await sleep(TASK_INITIAL_DELAY_MS);

  while (Date.now() - startedAt < GENERATE_TIMEOUT_MS) {
    const payload = await getTaskStatus(taskId);
    const task = payload.data;
    const status = task?.status;

    if (status === 'completed') {
      const imageUrl = task?.result?.images?.[0]?.url?.[0];
      if (!imageUrl) {
        throw new Error('任务已完成，但没有返回图片 URL。');
      }
      return imageUrl;
    }

    if (status === 'failed' || status === 'cancelled') {
      throw new Error(task?.error?.message ?? `任务失败，状态：${status}`);
    }

    await sleep(TASK_POLL_INTERVAL_MS);
  }

  throw new Error(`生图任务超时（${Math.round(GENERATE_TIMEOUT_MS / 1000)} 秒）`);
};

interface GenerateOverviewParams {
  prompt: string;
  stylePrompt?: string;
  referenceImageUrl?: string | null;
}

export const generateOverviewImage = async ({
  prompt,
  stylePrompt,
  referenceImageUrl,
}: GenerateOverviewParams): Promise<string> => {
  const text = [
    `请根据用户需求生成一张清晰、完整、可继续点击局部放大的百科剖析图。用户需求是：${prompt}`,
    '请优先忠实表现用户需求中的主体、题材、关系、动作、材质与场景，不要把主题自动改写成城堡、王国、城市地图、景区导览、建筑群或博物馆画册，除非用户明确要求。',
    '这张图的职责是作为"自由点击放大解析系统"的起点，因此主体区域需要清楚、有层次、可辨识，方便用户点击任意局部后继续生成细节图。',
    '视角、构图和内容组织应服务于用户指定的主题；只有当用户要求地图、导览、建筑总览或空间布局时，才使用顶视图、俯视图或导览图视角。',
    encyclopediaPlateStructurePrompt,
    '画面中不要强制编号，不要现代 UI；如需说明内容，只使用少量图册式模块、短标题和短标注。',
    '输出应是一张完整插画风格图像，不要浏览器边框或截图界面。',
    referenceImageUrl ? '请优先参考提供图片中的主体、结构、姿态、材质、构图或风格线索；除非用户明确要求，不要在参考图之外额外添加王国、城堡、地图或建筑导览元素。' : '',
    stylePrompt ?? defaultStylePrompt,
  ]
    .filter(Boolean)
    .join('\n');

  const uploadedReferenceImageUrl = referenceImageUrl
    ? await uploadImageToApimart(referenceImageUrl, 'overview-reference.png')
    : null;

  const payload = await postGenerateJson<ApimartTaskSubmitResponse>(
    {
      model: 'gpt-image-2',
      prompt: text,
      size: DEFAULT_IMAGE_SIZE,
      resolution: '1k',
      quality: 'low',
      output_format: 'png',
      n: 1,
      ...(uploadedReferenceImageUrl ? { image_urls: [uploadedReferenceImageUrl] } : {}),
    },
    GENERATE_TIMEOUT_MS,
  );

  const taskId = payload.data?.[0]?.task_id;
  if (!taskId) {
    throw new Error('总览图任务已提交，但没有返回 task_id。');
  }

  const finalImageUrl = await waitForApimartTaskImage(taskId);
  const resolvedImageSource = await resolveGeneratedImageSource(finalImageUrl);
  return saveGeneratedImage(resolvedImageSource, 'overview');
};

interface GenerateFocusedParams {
  sourceImageUrl: string;
  hotspot: ImageHotspot;
  stylePrompt?: string;
}

export const generateFocusedSceneImage = async ({
  sourceImageUrl,
  hotspot,
  stylePrompt,
}: GenerateFocusedParams): Promise<string> => {
  const uploadedSourceImageUrl = await uploadImageToApimart(
    sourceImageUrl,
    `focus-hotspot-${Date.now()}.png`,
  );

  const text = [
    '你正在为一套"自由点击放大解析系统"生成下一层细节图。',
    '原图中已经用红框标出了当前点击区域，请严格围绕红框内的主体生成一张更详细的解析图。',
    `当前点击区域说明：${hotspot.label}。`,
    hotspot.generationPrompt ?? '请根据红框中的内容，生成该区域更详细、更近景、更有层次的解析图。',
    '新的图片不需要编号，不需要列表，不需要详情卡片，也不要生成现代 UI。',
    '请让新图保持与上一层一致的视觉语言，但视角可以切换为更近的斜视角、局部视角或第一视角，让人感受到从总览进入细节。',
    focusedPlateStructurePrompt,
    '画面主体必须明确聚焦红框区域内的主体、局部结构、材质、功能关系或物品，不要被其他无关区域分散。',
    '输出应是一张完整、可继续被用户再次点击放大的场景细节图。',
    stylePrompt ?? defaultStylePrompt,
  ]
    .filter(Boolean)
    .join('\n');

  const payload = await postGenerateJson<ApimartTaskSubmitResponse>(
    {
      model: 'gpt-image-2',
      prompt: text,
      size: DEFAULT_IMAGE_SIZE,
      resolution: '1k',
      quality: 'low',
      output_format: 'png',
      n: 1,
      image_urls: [uploadedSourceImageUrl],
    },
    GENERATE_TIMEOUT_MS,
  );

  const taskId = payload.data?.[0]?.task_id;
  if (!taskId) {
    throw new Error('细节图任务已提交，但没有返回 task_id。');
  }

  const finalImageUrl = await waitForApimartTaskImage(taskId);
  const resolvedImageSource = await resolveGeneratedImageSource(finalImageUrl);
  return saveGeneratedImage(resolvedImageSource, 'focus');
};

export const decorateImageWithHotspotBox = async (
  imageUrl: string,
  hotspot: ImageHotspot,
): Promise<string> => {
  const image = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建绘图上下文。');
  }

  context.drawImage(image, 0, 0);

  const bounds = hotspot.bounds ?? {
    x: hotspot.position.x - 10,
    y: hotspot.position.y - 10,
    width: 20,
    height: 20,
  };

  const x = (bounds.x / 100) * canvas.width;
  const y = (bounds.y / 100) * canvas.height;
  const width = (bounds.width / 100) * canvas.width;
  const height = (bounds.height / 100) * canvas.height;

  context.strokeStyle = '#d1121b';
  context.lineWidth = Math.max(6, Math.round(canvas.width * 0.006));
  context.setLineDash([]);
  context.strokeRect(x, y, width, height);

  context.fillStyle = '#d1121b';
  context.font = `${Math.max(24, Math.round(canvas.width * 0.024))}px sans-serif`;
  const markerText = hotspot.index ? `${hotspot.index}. ${hotspot.label}` : hotspot.label;
  const tagWidth = Math.max(120, context.measureText(markerText).width + 34);
  const tagHeight = Math.max(34, Math.round(canvas.height * 0.055));
  const tagX = x;
  const tagY = Math.max(0, y - tagHeight - 8);
  context.fillRect(tagX, tagY, tagWidth, tagHeight);

  context.fillStyle = '#ffffff';
  context.fillText(markerText, tagX + 16, tagY + tagHeight * 0.68);

  return canvas.toDataURL('image/png');
};
