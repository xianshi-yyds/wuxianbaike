import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '登录后可以收藏图版。' }, { status: 401 });
  }

  let body: { sessionId?: unknown; nodeId?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown; nodeId?: unknown };
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (typeof body.sessionId !== 'string' || typeof body.nodeId !== 'string') {
    return NextResponse.json({ error: '缺少有效的收藏参数。' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    favorite: {
      userId: user.id,
      sessionId: body.sessionId,
      nodeId: body.nodeId,
      createdAt: new Date().toISOString(),
    },
  });
}
