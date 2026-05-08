import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { createExploreSession, ExploreError } from '@/lib/server/explore';
import { saveExploreSession } from '@/lib/server/explore-storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { topic?: unknown };
  try {
    body = (await req.json()) as { topic?: unknown };
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const user = await getCurrentUser();

  try {
    const session = createExploreSession(body.topic, user?.id ?? null);
    await saveExploreSession(session);
    return NextResponse.json({
      session,
      node: session.nodes[0],
      status: session.status,
    });
  } catch (error) {
    if (error instanceof ExploreError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          status: error.code === 'out_of_scope' ? 'out_of_scope' : 'failed',
          suggestedTopics: error.suggestions ?? [],
        },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: '创建探索失败，请稍后重试。' }, { status: 500 });
  }
}
