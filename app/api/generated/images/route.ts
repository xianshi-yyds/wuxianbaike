import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GENERATED_IMAGE_DIR =
  process.env.GENERATED_IMAGE_DIR ?? path.join(process.cwd(), 'generated-images');
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

interface SaveImageBody {
  imageDataUrl?: string;
  imageUrl?: string;
  filenamePrefix?: string;
}

const parseDataUrl = (value: string) => {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const extensionFromMime = (mimeType: string | null) => {
  if (mimeType?.includes('webp')) return 'webp';
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'jpg';
  return 'png';
};

const safePrefix = (value: string | undefined) =>
  (value ?? 'generated').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 32) || 'generated';

export async function POST(req: Request) {
  let body: SaveImageBody;
  try {
    body = (await req.json()) as SaveImageBody;
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  let buffer: Buffer;
  let extension: string;

  if (body.imageDataUrl) {
    const parsed = parseDataUrl(body.imageDataUrl);
    if (!parsed) {
      return NextResponse.json({ error: '缺少有效的 imageDataUrl' }, { status: 400 });
    }
    buffer = parsed.buffer;
    extension = parsed.extension;
  } else if (body.imageUrl) {
    let target: URL;
    try {
      target = new URL(body.imageUrl);
    } catch {
      return NextResponse.json({ error: '非法 imageUrl' }, { status: 400 });
    }

    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `图片下载失败 ${upstream.status}` },
        { status: upstream.status },
      );
    }
    const arrayBuffer = await upstream.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    extension = extensionFromMime(upstream.headers.get('content-type'));
  } else {
    return NextResponse.json({ error: '缺少 imageDataUrl 或 imageUrl' }, { status: 400 });
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: '图片过大，无法保存' }, { status: 413 });
  }

  await mkdir(GENERATED_IMAGE_DIR, { recursive: true });
  const filename = `${safePrefix(body.filenamePrefix)}-${Date.now()}-${randomUUID()}.${extension}`;
  await writeFile(path.join(GENERATED_IMAGE_DIR, filename), buffer);

  return NextResponse.json({
    url: `/api/generated/images/${filename}`,
    filename,
    bytes: buffer.byteLength,
  });
}
