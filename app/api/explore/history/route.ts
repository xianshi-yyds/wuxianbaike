import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/server/auth';
import { readUserHistory } from '@/lib/server/history';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ history: [], mode: 'guest' });
  }

  const history = await readUserHistory(user.id);
  return NextResponse.json({ history, mode: 'account' });
}
