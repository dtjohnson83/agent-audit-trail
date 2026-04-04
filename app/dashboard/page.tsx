'use client'
import { useState } from 'react'
import { themes } from '@/lib/theme'
import Header from '@/components/Header'
import StatsBar from '@/components/StatsBar'
import AgentFilter from '@/components/AgentFilter'
import DateRangeFilter from '@/components/DateRangeFilter'
import TabNav from '@/components/TabNav'
import ExportButton from '@/components/ExportButton'
import Timeline from '@/components/Timeline'
import AgentsList from '@/components/AgentsList'
import PoliciesList from '@/components/PoliciesList'
import PolicyEditor from '@/components/PolicyEditor'
import ReviewModal from '@/components/ReviewModal'
import ToolBar from '@/components/ToolBar'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import { useAgents } from '@/hooks/useAgents'
import { usePolicies } from '@/hooks/usePolicies'
import type { AuditLog, PolicyRule } from '@/lib/types'

export default function DashboardPage() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState<'timeline' | 'agents' | 'policies'>('timeline')
  const [agentFilter, setAgentFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: null as Date | null, end: null as Date | null })
  const [reviewLog, setReviewLog] = useState<AuditLog | null>(null)
  const [editPolicy, setEditPolicy] = useState<PolicyRule | undefined>(undefined)

  const t = themes[mode]
  const { logs, loading: logsLoading, refetch: refetchLogs } = useAuditLogs(agentFilter, dateRange)
  const { agents, loading: agentsLoading, refetch: refetchAgents } = useAgents()
  const { policies, refetch: refetchPolicies, togglePolicy, updateEnforcement, savePolicy } = usePolicies()

  return (
    <div style={{ background: t.bg, minHeight: '100vh', maxWidth: 480, margin: '0 auto', fontFamily: 'Geist, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        select option { background: ${t.surfaceSolid}; }
      `}</style>

      <Header theme={t} mode={mode} onToggleTheme={() => setMode(m => m === 'dark' ? 'light' : 'dark')} />

      <StatsBar theme={t} logs={logs} policies={policies} />

      <AgentFilter
        theme={t}
        selected={agentFilter}
        onChange={setAgentFilter}
        agents={agents}
      />

      <DateRangeFilter theme={t} onChange={setDateRange} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8 }}>
        <TabNav theme={t} active={tab} onChange={setTab} />
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          {tab === 'policies' && (
            <button
              onClick={() => setEditPolicy(undefined)}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: t.accentBg, border: `1px solid ${t.accentBorder}`,
                color: t.accent, cursor: 'pointer',
              }}
            >+ New</button>
          )}
          {tab === 'timeline' && (
            <ExportButton theme={t} logs={logs} />
          )}
        </div>
      </div>

      {tab === 'timeline' && (
        <Timeline theme={t} logs={logs} loading={logsLoading} onReview={setReviewLog} />
      )}
      {tab === 'agents' && (
        <AgentsList theme={t} agents={agents} />
      )}
      {tab === 'policies' && (
        <PoliciesList
          theme={t}
          policies={policies}
          onToggle={togglePolicy}
          onSetEnforcement={updateEnforcement}
          onEdit={(p) => setEditPolicy(p)}
        />
      )}

      <ToolBar theme={t} logs={logs} />

      {reviewLog && (
        <ReviewModal
          theme={t}
          log={reviewLog}
          onClose={() => setReviewLog(null)}
          onSaved={refetchLogs}
        />
      )}

      {editPolicy !== undefined && (
        <PolicyEditor
          theme={t}
          onClose={() => setEditPolicy(undefined)}
          onSaved={refetchPolicies}
          existing={editPolicy}
        />
      )}
    </div>
  )
}
