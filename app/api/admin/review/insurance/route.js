import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/service-role'
import { serverError } from '@/lib/api-errors'

export async function POST(req) {
  // Re-check admin session server-side
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id, status } = await req.json()

    if (!['approved', 'disapproved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Use SECURITY DEFINER RPC to bypass the trigger
    const { error } = await supabase.rpc('admin_review_insurance', {
      p_insurance_id: id,
      p_status: status,
      p_reviewed_at: new Date().toISOString(),
    })

    if (error) {
      return serverError('admin/review/insurance', error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError('admin/review/insurance', err)
  }
}
