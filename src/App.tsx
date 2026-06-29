import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { PrivacyProvider } from '@/contexts/PrivacyContext'
import { BottomNav } from '@/components/BottomNav'
import { SideNav } from '@/components/SideNav'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { ImportPage } from '@/pages/ImportPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { SettingsPage } from '@/pages/SettingsPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-2 border-clay border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <PrivacyProvider>
      <BrowserRouter>
        <div className="min-h-svh bg-paper lg:flex">
        <SideNav />
        <main className="flex-1 min-w-0 lg:ml-60">
          <Routes>
            <Route path="/" element={<DashboardPage user={user} />} />
            <Route path="/transactions" element={<TransactionsPage user={user} />} />
            <Route path="/import" element={<ImportPage user={user} />} />
            <Route path="/reports" element={<ReportsPage user={user} />} />
            <Route path="/accounts" element={<AccountsPage user={user} />} />
            <Route path="/settings" element={<SettingsPage user={user} />} />
          </Routes>
        </main>
        <BottomNav />
        </div>
      </BrowserRouter>
    </PrivacyProvider>
  )
}
