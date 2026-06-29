import { useRef, useState, type ReactNode } from 'react'

interface ChartCarouselProps {
  // How many viewport-width sections the chart spans on mobile. <= 1 disables paging.
  pages: number
  // Rendered at full width on desktop, and as a wide scroll-snap track on mobile.
  children: ReactNode
}

// On large screens the chart renders normally. On small screens it becomes a
// horizontally swipeable, scroll-snapped track `pages` viewports wide, with dot
// pagination tracking the scroll position (see reference screenshots).
export function ChartCarousel({ pages, children }: ChartCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const paged = pages > 1

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActive(Math.min(pages - 1, Math.max(0, idx)))
  }

  return (
    <>
      {/* Desktop: full chart */}
      <div className="hidden lg:block">{children}</div>

      {/* Mobile: swipeable, or plain if a single page */}
      <div className="lg:hidden">
        {paged ? (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="overflow-x-auto snap-x snap-mandatory scrollbar-none"
            >
              <div className="relative" style={{ width: `${pages * 100}%` }}>
                {children}
                {/* Transparent snap targets, one per viewport-width page. */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: pages }).map((_, i) => (
                    <div key={i} className="flex-1 snap-start" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-1.5 pt-3">
              {Array.from({ length: pages }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-ink' : 'w-1.5 bg-sand'}`}
                />
              ))}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </>
  )
}
