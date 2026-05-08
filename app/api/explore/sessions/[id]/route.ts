import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import {
  canAccessExploreSession,
  readExploreSession,
} from '@/lib/server/explore-storage';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/api/explore/sessions/[id]'>) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();

  try {
    const session = await readExploreSession(id);
    if (!canAccessExploreSession(session, user?.id ?? null)) {
      return NextResponse.json({ error: '没有权限读取这个探索会话。' }, { status: 403 });
    }
    const node = session.nodes.find((item) => item.id === session.activeNodeId) ?? session.nodes[0];
    return NextResponse.json({ session, node, status: session.status });
  } catch {
    return NextResponse.json({ error: '探索会话不存在或已过期。' }, { status: 404 });
  }
}
