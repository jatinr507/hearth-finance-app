import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, List, BarChart3, Wallet, MoreHorizontal, Upload, Settings, LogOut } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAuth } from '@/hooks/useAuth'

// Four primary destinations stay in the bar; the rest live in a "More" sheet so
// touch targets stay comfortable on small phones.
const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: List, label: 'Transactions' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
]

const MORE_ITEMS = [
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()
  const { signOut } = useAuth()

  function go(to: string) {
    setMoreOpen(false)
    navigate(to)
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-hairline pb-safe z-50">
        <div className="flex">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive ? 'text-clay' : 'text-muted'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-muted transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
            More
          </button>
        </div>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {MORE_ITEMS.map(({ to, icon: Icon, label }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className="w-full flex items-center gap-3 px-2 py-3.5 rounded-sm text-sm font-medium text-ink hover:bg-sand transition-colors"
            >
              <Icon className="w-5 h-5 shrink-0 text-muted" />
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-hairline" />
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false)
              signOut()
            }}
            className="w-full flex items-center gap-3 px-2 py-3.5 rounded-sm text-sm font-medium text-ink hover:bg-sand transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0 text-muted" />
            Sign out
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
