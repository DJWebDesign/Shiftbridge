import type { ReactNode } from 'react'

// Shared card shell — replaces the `bg-white rounded-xl border border-gray-200`
// markup that was hand-rolled independently across ~20 files.

export function Card({
  className = '', children,
}: { className?: string; children: ReactNode }) {
  return <div className={`card overflow-hidden ${className}`}>{children}</div>
}

export function CardHeader({
  title, action, className = '',
}: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-b border-line flex items-center justify-between gap-3 ${className}`}>
      <h3 className="section-title text-[17px]">{title}</h3>
      {action}
    </div>
  )
}

export function StatTile({
  label, value, caption, accent = false, valueClassName = '',
}: { label: string; value: ReactNode; caption?: string; accent?: boolean; valueClassName?: string }) {
  return (
    <div className={`card px-4 py-4 ${accent ? 'border-t-[2.5px] border-t-brand' : ''}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`text-2xl font-bold text-ink mt-1 tabular-nums ${valueClassName}`}>{value}</p>
      {caption && <p className="text-xs text-ink-2 mt-0.5">{caption}</p>}
    </div>
  )
}
