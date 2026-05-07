import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APIMART_GENERATE_URL = 'https://api.apimart.ai/v1/images/generations';

export async function POST(req: Request) {
  const apiKey = process.env.APIMART_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: '服务端未配置 APIMART_KEY' }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const upstream = await fetch(APIMART_GENERATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
