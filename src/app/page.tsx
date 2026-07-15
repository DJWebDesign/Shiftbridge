import { redirect } from 'next/navigation'

// Middleware handles role-based redirect.
// This is a fallback for unauthenticated users.
export default function RootPage() {
  redirect('/login')
}
