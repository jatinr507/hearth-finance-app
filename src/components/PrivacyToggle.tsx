import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '@/contexts/PrivacyContext'

// Compact toggle for app-wide Privacy mode. Masks amounts as percentages/dots
// when on — handy for viewing or sharing the app in front of others.
export function PrivacyToggle({ className = '' }: { className?: string }) {
  const { hidden, toggle } = usePrivacy()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      title={hidden ? 'Show amounts' : 'Hide amounts'}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-muted hover:text-ink hover:bg-sand transition-colors ${className}`}
    >
      {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )
}
