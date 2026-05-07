import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const APIMART_TASKS_URL = 'https://api.apimart.ai/v1/tasks';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.APIMART_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: '服务端未配置 APIMART_KEY' }, { status: 500 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });
  }

  const upstream = await fetch(`${APIMART_TASKS_URL}/${encodeURIComponent(id)}?language=zh`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
  });
}
