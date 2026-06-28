import type { User } from '@supabase/supabase-js'
import { Card } from '@/components/ui/Card'
import { CategoryRulesSection } from '@/components/CategoryRulesSection'

interface SettingsPageProps {
  user: User
}

export function SettingsPage({ user }: SettingsPageProps) {
  const displayName = user.user_metadata?.full_name ?? user.email ?? 'User'
  const email = user.email ?? ''
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="pb-24 lg:pb-10 px-4 lg:px-8 pt-6 lg:pt-8 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4 lg:mb-6">Settings</h1>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 space-y-4 lg:space-y-0 lg:items-start">
        {/* Left column — profile */}
        <div className="space-y-4">
          <Card className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-sm text-gray-500 truncate">{email}</p>
            </div>
          </Card>
        </div>

        {/* Right column — category rules */}
        <CategoryRulesSection userId={user.id} />
      </div>
    </div>
  )
}
