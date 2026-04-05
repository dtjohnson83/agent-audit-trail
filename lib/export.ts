import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Papa from 'papaparse'
import type { AuditLog } from './types'

export function exportCsv(logs: AuditLog[], filename: string) {
  const rows = logs.map(l => ({
    timestamp: l.timestamp,
    agent: l.agent_name,
    tool: l.tool_name,
    action: l.tool_action,
    status: l.response_status,
    summary: l.response_summary,
    duration_ms: l.execution_duration_ms,
    violations: l.policy_violations.map(v => {
      // Handle both string and object violation formats
      if (typeof v === 'string') return v;
      return `[${(v.severity || '?').toUpperCase()}] ${v.rule_name || v.rule_id || 'Unknown'}: ${v.details || ''}`;
    }).join(' | '),
    hash: l.hash,
    review_status: l.review_status,
  }))

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportPdf(logs: AuditLog[], filename: string) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Verify chain integrity
  let chainValid = true
  let chainBrokenAt: string | null = null
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].previous_hash && logs[i].previous_hash !== logs[i - 1].hash) {
      chainValid = false
      chainBrokenAt = `${logs[i].agent_name} ${logs[i].tool_name} (${logs[i].id.slice(0, 8)})`
      break
    }
  }

  doc.setFontSize(18)
  doc.setTextColor(15, 15, 18)
  doc.text('Agent Audit Trail Report', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
  doc.text(`Total entries: ${logs.length}`, 14, 34)

  const violations = logs.filter(l => l.policy_violations.length > 0)
  doc.text(`Policy violations: ${violations.length}`, 14, 40)

  doc.setFontSize(12)
  if (chainValid) {
    doc.setTextColor(0, 200, 160)
    doc.text('Chain Integrity: VERIFIED', 14, 50)
  } else {
    doc.setTextColor(220, 38, 38)
    doc.text(`Chain Integrity: BROKEN at ${chainBrokenAt}`, 14, 50)
  }

  const tableData = logs.map(l => [
    new Date(l.timestamp).toLocaleString(),
    l.agent_name,
    `${l.tool_name}.${l.tool_action}`,
    l.response_status,
    l.response_summary.substring(0, 50),
    `${l.execution_duration_ms}ms`,
    l.policy_violations.length > 0
      ? (typeof l.policy_violations[0] === 'string'
          ? l.policy_violations[0].substring(0, 30)
          : `${l.policy_violations[0].severity}: ${l.policy_violations[0].rule_name}`.substring(0, 30))
      : '-',
    l.hash.substring(0, 10),
  ])

  // @ts-ignore
  doc.autoTable({
    startY: 56,
    head: [['Time', 'Agent', 'Tool', 'Status', 'Summary', 'Duration', 'Violations', 'Hash']],
    body: tableData,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [10, 155, 128] },
  })

  doc.save(`${filename}.pdf`)
}
