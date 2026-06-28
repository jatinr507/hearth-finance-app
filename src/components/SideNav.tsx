import { NavLink } from 'react-router-dom'
import { LayoutDashboard, List, Upload, Wallet, Settings, LogOut } from 'lucide-react'
import { HearthMark } from '@/components/ui/HearthMark'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: List, label: 'Transactions' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function SideNav() {
  const { signOut } = useAuth()

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-svh w-60 bg-surface border-r border-hairline z-40">
      <div className="px-5 pt-7 pb-6">
        <div className="flex items-center gap-2.5">
          <HearthMark size={28} bgColor="#FBF8F2" />
          <span className="font-bold text-ink text-lg tracking-tight">hearth</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-tint-clay text-clay'
                  : 'text-muted hover:bg-sand hover:text-ink'
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-muted hover:bg-sand hover:text-ink transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
