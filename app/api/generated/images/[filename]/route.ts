import { readFile } from 'fs/promises';
import path from 'path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const GENERATED_IMAGE_DIR =
  process.env.GENERATED_IMAGE_DIR ?? path.join(process.cwd(), 'generated-images');

const contentTypeFromFilename = (filename: string) => {
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!/^[a-z0-9-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
    return NextResponse.json({ error: '非法文件名' }, { status: 400 });
  }

  try {
    const file = await readFile(path.join(GENERATED_IMAGE_DIR, filename));
    return new Response(file, {
      headers: {
        'Content-Type': contentTypeFromFilename(filename),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 });
  }
}
