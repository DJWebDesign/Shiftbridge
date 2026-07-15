import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ROLE_REDIRECTS: Record<string, string> = {
  super_admin: '/admin',
  agency_admin: '/agency',
  facility_admin: '/facility',
  nurse: '/nurse',
  demo: '/demo',
}

const PUBLIC_ROUTES = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/confirm', '/decline',
  '/api/auth',         // signup + callback
  '/api/places',       // address autocomplete (used on public signup form)
  '/api/confirm-token', // coordinator one-click confirm (no login required)
  '/api/decline-token', // coordinator one-click decline (no login required)
  '/api/track',         // CTA click tracking redirects (no login required)
  '/api/demo/launch',  // demo session creation (no auth yet)
]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  if (isPublicRoute) return supabaseResponse

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Read role from JWT app_metadata (set when account is created — no DB query needed)
  const role = user.app_metadata?.role as string | undefined

  // Redirect to login if no role found
  if (!role) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Enforce role-based route access
  const rolePrefix = ROLE_REDIRECTS[role]

  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = rolePrefix
    return NextResponse.redirect(url)
  }

  const allowedPrefix = rolePrefix
  const isAllowed =
    pathname.startsWith(allowedPrefix) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')

  if (!isAllowed) {
    const url = request.nextUrl.clone()
    url.pathname = rolePrefix
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
