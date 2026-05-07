import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  AuthError,
  SESSION_COOKIE_NAME,
  createSessionToken,
  createUser,
  getSessionCookieOptions,
} from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = (await req.json()) as { username?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  try {
    const user = createUser(body.username, body.password);
    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      createSessionToken(user.id),
      getSessionCookieOptions(),
    );
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
