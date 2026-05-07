import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_HOSTS = new Set([
  'api.apimart.ai',
  'cdn.apimart.ai',
  'upload.apimart.ai',
  'xianshi.icu',
]);

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: '缺少 url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: '非法 url' }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: `不在白名单的 host：${target.hostname}` }, { status: 403 });
  }

  const apiKey = process.env.APIMART_KEY?.trim();
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const upstream = await fetch(target.toString(), { headers });
  if (!upstream.ok) {
    return NextResponse.json({ error: `上游图片下载失败 ${upstream.status}` }, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
