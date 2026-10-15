import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ALGORITHM = 'sha256'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const COOKIE_NAME = 'admin_session'

/**
 * Create a signed session token.
 * Format: base64url(payload).base64url(signature)
 */
export function createAdminToken({ userId, email }) {
  const payload = JSON.stringify({
    userId,
    email,
    exp: Date.now() + SESSION_DURATION,
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

/**
 * Verify a token and return the payload, or null if invalid/expired.
 */
export function verifyAdminToken(token) {
  try {
    const lastDot = token.lastIndexOf('.')
    if (lastDot === -1) return null

    const encoded = token.slice(0, lastDot)
    const signature = token.slice(lastDot + 1)

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(encoded)))) {
      return null
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))

    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}

function sign(data) {
  return createHmac(ALGORITHM, getSecret()).update(data).digest('base64url')
}

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set')
  return secret
}

/**
 * The signed-in admin, or null. Checks the cookie AND that the user is still
 * an admin in the database (profiles.is_admin), so removing the flag revokes
 * access on the next request.
 */
export async function getAdminSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  const payload = token ? verifyAdminToken(token) : null
  if (!payload?.userId) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', payload.userId)
    .maybeSingle()

  return profile?.is_admin ? { userId: payload.userId, email: payload.email } : null
}

export { COOKIE_NAME, SESSION_DURATION }
