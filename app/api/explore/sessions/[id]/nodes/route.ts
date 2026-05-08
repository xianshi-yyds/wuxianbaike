import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { appendExploreNode, ExploreError } from '@/lib/server/explore';
import {
  canAccessExploreSession,
  readExploreSession,
  saveExploreSession,
} from '@/lib/server/explore-storage';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  ctx: RouteContext<'/api/explore/sessions/[id]/nodes'>,
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();

  let body: { parentNodeId?: unknown; pointId?: unknown };
  try {
    body = (await req.json()) as { parentNodeId?: unknown; pointId?: unknown };
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (typeof body.parentNodeId !== 'string' || typeof body.pointId !== 'string') {
    return NextResponse.json({ error: '缺少有效的知识点参数。' }, { status: 400 });
  }

  try {
    const session = await readExploreSession(id);
    if (!canAccessExploreSession(session, user?.id ?? null)) {
      return NextResponse.json({ error: '没有权限继续这个探索会话。' }, { status: 403 });
    }
    const nextSession = appendExploreNode(session, body.parentNodeId, body.pointId);
    await saveExploreSession(nextSession);
    const node = nextSession.nodes.find((item) => item.id === nextSession.activeNodeId);
    return NextResponse.json({
      session: nextSession,
      node,
      status: nextSession.status,
    });
  } catch (error) {
    if (error instanceof ExploreError) {
      return NextResponse.json(
        { error: error.message, code: error.code, status: 'failed' },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: '生成下一层探索失败，请稍后重试。' }, { status: 500 });
  }
}
