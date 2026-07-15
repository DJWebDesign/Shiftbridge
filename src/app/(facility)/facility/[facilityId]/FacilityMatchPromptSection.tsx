'use client'

import { useState } from 'react'
import FacilityMatchPrompt from '@/components/placeholders/FacilityMatchPrompt'

interface Match {
  id: string
  name: string
  agencyId: string
  agencyName: string
  connectionStatus: string
}

interface Props {
  matches: Match[]
}

export default function FacilityMatchPromptSection({ matches: initialMatches }: Props) {
  const [matches, setMatches] = useState<Match[]>(initialMatches)

  function handleRequestSent(placeholderId: string) {
    setMatches(prev =>
      prev.map(m => m.id === placeholderId ? { ...m, connectionStatus: 'request_pending' } : m)
    )
  }

  const visible = matches.filter(m => m.connectionStatus !== 'connected')
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        Agency Connections
      </h2>
      {visible.map(m => (
        <FacilityMatchPrompt
          key={m.id}
          placeholderId={m.id}
          placeholderName={m.name}
          agencyName={m.agencyName}
          connectionStatus={m.connectionStatus}
          onRequestSent={handleRequestSent}
        />
      ))}
    </div>
  )
}
