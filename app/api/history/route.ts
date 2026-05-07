import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { clearUserHistory, readUserHistory, writeUserHistory } from '@/lib/server/history';

export const runtime = 'nodejs';

const requireUser = async () => {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
      user: null,
    };
  }
  return { response: null, user };
};

export async function GET() {
  const { response, user } = await requireUser();
  if (response) return response;

  const history = await readUserHistory(user.id);
  return NextResponse.json({ history });
}

export async function PUT(req: Request) {
  const { response, user } = await requireUser();
  if (response) return response;

  let body: { history?: unknown };
  try {
    body = (await req.json()) as { history?: unknown };
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.history)) {
    return NextResponse.json({ error: '缺少有效的 history 数组' }, { status: 400 });
  }

  const history = await writeUserHistory(user.id, body.history);
  return NextResponse.json({ history });
}

export async function DELETE() {
  const { response, user } = await requireUser();
  if (response) return response;

  await clearUserHistory(user.id);
  return NextResponse.json({ history: [] });
}
