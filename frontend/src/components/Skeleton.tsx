/** Reusable animated skeleton placeholders for data-fetching components. */

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-700 rounded ${className}`} />
}

export function IncidentListSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-3 rounded border border-white/5 bg-panel-light space-y-2">
          <div className="flex justify-between">
            <Pulse className="h-3 w-32" />
            <Pulse className="h-3 w-14" />
          </div>
          <Pulse className="h-2 w-48" />
          <Pulse className="h-2 w-20" />
        </div>
      ))}
    </div>
  )
}

export function TeamListSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 rounded border border-white/5 bg-panel-light space-y-2">
          <div className="flex justify-between items-center">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
          <Pulse className="h-2 w-36" />
          <Pulse className="h-7 w-full rounded" />
        </div>
      ))}
    </div>
  )
}

export function DetectionLogSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-2 rounded border border-white/5 bg-panel-light space-y-1">
          <div className="flex justify-between">
            <Pulse className="h-3 w-16" />
            <Pulse className="h-3 w-12" />
          </div>
          <Pulse className="h-1.5 w-full rounded-full" />
          <Pulse className="h-2 w-28" />
        </div>
      ))}
    </div>
  )
}
