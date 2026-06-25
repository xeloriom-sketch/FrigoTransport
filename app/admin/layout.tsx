'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Users, LayoutDashboard, Snowflake, LogOut } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { href: '/admin/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/trucks/', label: 'Camions', icon: Truck },
  { href: '/admin/workers/', label: 'Ouvriers', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login/')
  }

  return (
    <div className="min-h-screen bg-bg-main text-white" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.01em' }}>

      {/* ── Header desktop (hidden on mobile) ── */}
      <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-border-thin">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
              <Snowflake className="w-3 h-3 text-black" />
            </div>
            <span className="text-base font-bold tracking-tight">FrigoTransport.</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            {nav.map(({ href, label, exact }) => {
              const active = exact
                ? pathname === href || pathname === href.slice(0, -1)
                : pathname.startsWith(href.slice(0, -1))
              return (
                <Link key={href} href={href} className={clsx('transition', active ? 'text-white' : 'text-txt-muted hover:text-white')}>
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-card border border-border-thin text-txt-muted hover:text-white rounded-full text-xs transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </header>

      {/* ── Header mobile ── */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border-thin">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
            <Snowflake className="w-3.5 h-3.5 text-black" />
          </div>
          <span className="text-sm font-bold tracking-tight">FrigoTransport.</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-txt-muted hover:text-white rounded-xl hover:bg-bg-card transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* ── Page content ── */}
      <main className="p-4 lg:p-5 pb-24 lg:pb-5">
        {children}
      </main>

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-card/95 backdrop-blur-md border-t border-border-thin"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href || pathname === href.slice(0, -1)
              : pathname.startsWith(href.slice(0, -1))
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition',
                  active ? 'text-accent' : 'text-txt-muted'
                )}
              >
                <Icon className={clsx('w-5 h-5', active ? 'text-accent' : 'text-txt-muted')} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
