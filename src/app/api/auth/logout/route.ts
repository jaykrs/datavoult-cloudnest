import { authCookie } from '@/lib/auth';

export async function POST() {
  const response = Response.json({ success: true });
  response.headers.set('Set-Cookie', authCookie(null));
  return response;
}
