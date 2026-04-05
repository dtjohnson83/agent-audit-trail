'use client'
import { useState, useEffect } from 'react'
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

const DASHBOARD_PASSWORD = 'Ryanisastar17!';

function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === DASHBOARD_PASSWORD) {
      sessionStorage.setItem('aa_dash_auth', '1');
      onLogin();
    } else {
      setError(true);
      setPw('');
    }
  };

  return (
    <div style={{ background: '#0c0c0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <form onSubmit={handle} style={{ textAlign: 'center', maxWidth: 340, width: '100%' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c0c0e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: '#ececee', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 6 }}>Agent Audit Trail</h1>
        <p style={{ fontSize: 13, color: '#5c5c66', marginBottom: 24, fontFamily: "'DM Sans', sans-serif" }}>Enter your password to access the dashboard.</p>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 8,
            border: error ? '1px solid #c4463a' : '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.03)', color: '#ececee', fontSize: 14,
            outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
            marginBottom: 12,
          }}
        />
        {error && <p style={{ fontSize: 12, color: '#c4463a', marginBottom: 12, fontFamily: "'DM Sans', sans-serif" }}>Incorrect password.</p>}
        <button type="submit" style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: '#d4a853', color: '#0c0c0e',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>Unlock</button>
      </form>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #2e2e36; }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (mounted) {
      const ok = sessionStorage.getItem('aa_dash_auth') === '1';
      setAuthed(ok);
    }
  }, [mounted]);

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

  if (!mounted) return null;
  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ background: t.bg, minHeight: '100vh', maxWidth: 1200, margin: '0 auto', fontFamily: 'Geist, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        select option { background: ${t.surfaceSolid}; }
        @media (min-width: 768px) {
          .dash-layout { padding: 0 24px; }
          .dash-card { margin-bottom: 12px; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 0' }}>
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'rgba(255,255,255,0.03)', color: t.textMid,
          border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none',
        }}>← Home</a>
      </div>

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
