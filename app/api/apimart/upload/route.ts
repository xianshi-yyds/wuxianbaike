import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APIMART_UPLOAD_URL = 'https://api.apimart.ai/v1/uploads/images';

interface UploadBody {
  imageDataUrl?: string;
  filename?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.APIMART_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: '服务端未配置 APIMART_KEY' }, { status: 500 });
  }

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const imageDataUrl = body.imageDataUrl ?? '';
  const filename = body.filename ?? 'upload.png';

  if (!imageDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: '缺少有效的 imageDataUrl' }, { status: 400 });
  }

  const imageResponse = await fetch(imageDataUrl);
  const blob = await imageResponse.blob();

  const formData = new FormData();
  formData.append('file', new File([blob], filename, { type: blob.type || 'image/png' }));

  const upstream = await fetch(APIMART_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
