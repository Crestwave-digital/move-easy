import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createAdminToken, COOKIE_NAME, SESSION_DURATION } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const invalid = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

// POST /api/admin/login { email, password }
// Admins are normal Supabase accounts with profiles.is_admin = true. The
// password is checked by Supabase Auth (stored hashed) — nothing in env files.
export async function POST(req) {
  try {
    const { email, password } = await req.json().catch(() => ({}))
    if (!email || !password) return invalid()

    // Throwaway client: verifies the password without touching the user's
    // normal site session cookies.
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await auth.auth.signInWithPassword({
      email: String(email).trim(),
      password: String(password),
    })
    if (error || !data?.user) return invalid()

    // Only this sign-in's session is revoked; the user's other sessions stay.
    await auth.auth.signOut({ scope: 'local' }).catch(() => {})

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .maybeSingle()

    // Same message as a wrong password: don't reveal which accounts exist
    if (!profile?.is_admin) return invalid()

    const token = createAdminToken({ userId: data.user.id, email: data.user.email })
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION / 1000,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/login]', err.message)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
