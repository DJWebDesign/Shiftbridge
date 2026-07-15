'use client'

import { useState, useMemo } from 'react'

export interface AccountRow {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  entity_name: string | null  // agency or facility name
}

export interface ConnectionRow {
  agencyId: string
  agencyName: string
  facilityId: string
  facilityName: string
  status: string
  connectedAt: string | null
}

export interface DemoSessionRow {
  id: string
  created_at: string
  expires_at: string
  agency_id: string | null
  facility_id: string | null
}

interface Props {
  accounts: AccountRow[]
  connections: ConnectionRow[]
  demoSessions: DemoSessionRow[]
  activeDemoCount: number
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  agency_admin: 'bg-blue-100 text-blue-800',
  facility_admin: 'bg-teal-100 text-teal-800',
  nurse: 'bg-green-100 text-green-800',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  agency_admin: 'Agency Admin',
  facility_admin: 'Facility Admin',
  nurse: 'Nurse',
}

type AccountAction = 'suspend' | 'activate' | 'reset_password'

export default function AdminDashboardClient({ accounts, connections, demoSessions, activeDemoCount }: Props) {
  const [tab, setTab] = useState<'accounts' | 'connections' | 'demo'>('accounts')
  const [demoSessions2, setDemoSessions2] = useState<DemoSessionRow[]>(demoSessions)
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [accountState, setAccountState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(accounts.map(a => [a.id, a.is_active]))
  )
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({})
  const [connSearch, setConnSearch] = useState('')

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (roleFilter && a.role !== roleFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.entity_name?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [accounts, search, roleFilter])

  const filteredConnections = useMemo(() => {
    if (!connSearch) return connections
    const q = connSearch.toLowerCase()
    return connections.filter(c =>
      c.agencyName.toLowerCase().includes(q) ||
      c.facilityName.toLowerCase().includes(q)
    )
  }, [connections, connSearch])

  async function handleAccountAction(accountId: string, action: AccountAction) {
    setActionStatus(s => ({ ...s, [accountId]: action === 'reset_password' ? 'sending...' : 'updating...' }))
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionStatus(s => ({ ...s, [accountId]: data.error ?? 'Error' }))
        return
      }
      if (action === 'suspend') {
        setAccountState(s => ({ ...s, [accountId]: false }))
      } else if (action === 'activate') {
        setAccountState(s => ({ ...s, [accountId]: true }))
      }
      setActionStatus(s => ({ ...s, [accountId]: action === 'reset_password' ? 'Email sent' : 'Done' }))
      setTimeout(() => setActionStatus(s => { const n = { ...s }; delete n[accountId]; return n }), 2500)
    } catch {
      setActionStatus(s => ({ ...s, [accountId]: 'Error' }))
    }
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  async function handleCleanup(force = false) {
    setCleanupLoading(true)
    setCleanupStatus(null)
    try {
      const res = await fetch(`/api/demo/cleanup${force ? '?force=true' : ''}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setCleanupStatus('Error: ' + (data.error ?? 'Unknown'))
      } else {
        setCleanupStatus(`Cleaned ${data.cleaned} session${data.cleaned !== 1 ? 's' : ''}.`)
        if (force) {
          setDemoSessions2([])
        } else {
          const now = new Date().toISOString()
          setDemoSessions2(s => s.filter(sess => sess.expires_at > now))
        }
      }
    } catch {
      setCleanupStatus('Error: request failed')
    }
    setCleanupLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['accounts', 'connections', 'demo'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'accounts' ? 'Accounts'
              : t === 'connections' ? 'Agency–Facility Connections'
              : (
                <span className="flex items-center gap-1.5">
                  Demo Sessions
                  {activeDemoCount > 0 && (
                    <span className="bg-teal-100 text-teal-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {activeDemoCount}
                    </span>
                  )}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Accounts tab */}
      {tab === 'accounts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search name, email, entity..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="agency_admin">Agency Admin</option>
              <option value="facility_admin">Facility Admin</option>
              <option value="nurse">Nurse</option>
            </select>
            <span className="text-xs text-gray-400">{filteredAccounts.length} accounts</span>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs text-gray-500 font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Email</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Role</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Entity</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Joined</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right text-xs text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No accounts found.</td>
                  </tr>
                ) : filteredAccounts.map(account => {
                  const isActive = accountState[account.id] ?? account.is_active
                  const status = actionStatus[account.id]
                  return (
                    <tr key={account.id} className={`hover:bg-gray-50 ${!isActive ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3 font-medium text-gray-800">{account.full_name}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{account.email}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[account.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABEL[account.role] ?? account.role}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{account.entity_name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatDate(account.created_at)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {status ? (
                          <span className="text-xs text-gray-500">{status}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleAccountAction(account.id, 'reset_password')}
                              className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                            >
                              Reset PW
                            </button>
                            {isActive ? (
                              <button
                                onClick={() => handleAccountAction(account.id, 'suspend')}
                                className="text-xs px-2.5 py-1 bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-700"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAccountAction(account.id, 'activate')}
                                className="text-xs px-2.5 py-1 bg-green-50 border border-green-200 rounded hover:bg-green-100 text-green-700"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connections tab */}
      {tab === 'connections' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search agency or facility..."
              value={connSearch}
              onChange={e => setConnSearch(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="text-xs text-gray-400">{filteredConnections.length} connections</span>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs text-gray-500 font-medium">Agency</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Facility</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredConnections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No connections found.</td>
                  </tr>
                ) : filteredConnections.map((conn, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{conn.agencyName}</td>
                    <td className="px-3 py-3 text-gray-700">{conn.facilityName}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        conn.status === 'active' ? 'bg-green-100 text-green-700' :
                        conn.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {conn.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {conn.connectedAt ? new Date(conn.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demo Sessions tab */}
      {tab === 'demo' && (
        <div className="space-y-4">
          {/* Summary + actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Demo Session Management</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activeDemoCount} active · {demoSessions2.length} total shown
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCleanup(false)}
                  disabled={cleanupLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors"
                >
                  {cleanupLoading ? 'Cleaning...' : 'Clean Up Expired'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete ALL demo sessions including active ones? This cannot be undone.')) handleCleanup(true)
                  }}
                  disabled={cleanupLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Clean All Demo Sessions
                </button>
              </div>
            </div>
            {cleanupStatus && (
              <p className="text-xs font-medium text-teal-700 bg-teal-50 rounded-lg px-3 py-2">{cleanupStatus}</p>
            )}
          </div>

          {/* Session list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-5 py-2.5 text-left text-xs text-gray-500 font-medium">Session ID</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Created</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Expires</th>
                    <th className="px-3 py-2.5 text-left text-xs text-gray-500 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {demoSessions2.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No demo sessions.</td>
                    </tr>
                  ) : demoSessions2.map(sess => {
                    const expired = new Date(sess.expires_at) < new Date()
                    return (
                      <tr key={sess.id} className={expired ? 'opacity-50' : ''}>
                        <td className="px-5 py-3 font-mono text-xs text-gray-500">{sess.id.slice(0, 8)}…</td>
                        <td className="px-3 py-3 text-xs text-gray-600">{formatDate(sess.created_at)}</td>
                        <td className="px-3 py-3 text-xs text-gray-600">
                          {new Date(sess.expires_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${expired ? 'bg-gray-100 text-gray-500' : 'bg-teal-100 text-teal-700'}`}>
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
