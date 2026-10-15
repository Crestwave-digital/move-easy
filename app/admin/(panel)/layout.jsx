import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import AdminNav from './AdminNav'

// Every admin page except /admin/login. Kept in its own route group so the
// nav + container render on client-side navigation too (a shared layout is
// not re-rendered when moving between pages, so it must not depend on the path).
export default async function AdminPanelLayout({ children }) {
  // Valid admin cookie AND still is_admin in the database
  if (!(await getAdminSession())) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}
