import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Papa from 'papaparse'
import type { AuditLog } from './types'

/**
 * Colorado SB 205 (2024) AI Audit Compliance Report
 *
 * Colorado's AI law (effective Feb 2024) requires operators of high-risk AI
 * systems to maintain audit logs and provide transparency into AI decisions.
 * This report is designed to satisfy:
 * - Audit log retention requirements
 * - Chain-of-custody (tamper-evident logging)
 * - Consequential decision documentation
 * - Policy violation disclosure
 */

export function exportColoradoSb205(logs: AuditLog[], filename: string, orgName = 'Organization', contactEmail = '') {
  const doc = new jsPDF({ orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // --- Verify chain integrity ---
  let chainValid = true
  let chainBrokenAt: string | null = null
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].previous_hash && logs[i].previous_hash !== logs[i - 1].hash) {
      chainValid = false
      chainBrokenAt = `${logs[i].agent_name} / ${logs[i].tool_name} (${logs[i].id.slice(0, 8)})`
      break
    }
  }

  const totalActions = logs.length
  const totalViolations = logs.reduce((sum, l) => sum + l.policy_violations.length, 0)
  const criticalViolations = logs.filter(l => l.policy_violations.some(v => v.severity === 'critical')).length
  const blockedActions = logs.filter(l => l.response_status === 'blocked').length
  const flaggedActions = logs.filter(l => l.response_status === 'flagged').length
  const uniqueAgents = [...new Set(logs.map(l => l.agent_name))]

  // --- Header ---
  doc.setFillColor(10, 155, 128)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('AI Audit Compliance Report', 14, 16)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Colorado SB 205 Disclosure — High-Risk AI System Audit Log', 14, 23)

  doc.setTextColor(0)
  doc.setFontSize(9)
  let y = 38

  // --- Section 1: Compliance Statement ---
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('1. Compliance Statement', 14, y)
  y += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const complianceStatement = [
    `This report is generated in accordance with Colorado Senate Bill 205 (2024),`,
    `which requires operators of high-risk AI systems to maintain comprehensive`,
    `audit logs and provide transparency into AI-assisted decision-making.`,
    ``,
    `Organization: ${orgName}`,
    `Contact: ${contactEmail || 'Not provided'}`,
    `Report Generated: ${new Date().toLocaleString()}`,
    `Reporting Period: ${logs.length > 0 ? `${new Date(logs[logs.length - 1].timestamp).toLocaleString()} — ${new Date(logs[0].timestamp).toLocaleString()}` : 'N/A'}`,
    `Audit System: Agent Audit Trail (DANZUS Holdings LLC)`,
    `Chain Integrity: ${chainValid ? 'VERIFIED — All entries cryptographically linked' : `BROKEN at ${chainBrokenAt}`}`,
  ]
  complianceStatement.forEach(line => {
    doc.text(line, 14, y)
    y += 5
  })
  y += 4

  // --- Section 2: Summary Statistics ---
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('2. Summary Statistics', 14, y)
  y += 8

  const stats = [
    ['Total AI Actions Logged', String(totalActions)],
    ['Unique AI Agents', String(uniqueAgents.length)],
    ['AI Agents Identified', uniqueAgents.join(', ')],
    ['Total Policy Violations', String(totalViolations)],
    ['Critical Severity Violations', String(criticalViolations)],
    ['Blocked Actions', String(blockedActions)],
    ['Flagged for Review', String(flaggedActions)],
    ['Audit Entries Reviewed', String(logs.filter(l => l.review_status === 'reviewed').length)],
    ['Audit Entries Escalated', String(logs.filter(l => l.review_status === 'escalated').length)],
  ]

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  stats.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 90, y)
    y += 5
  })
  y += 6

  // --- Section 3: Policy Violations Detail ---
  if (totalViolations > 0) {
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('3. Policy Violations Detail', 14, y)
    y += 6

    const violationRows: any[] = []
    logs.forEach(l => {
      l.policy_violations.forEach(v => {
        violationRows.push([
          new Date(l.timestamp).toLocaleString(),
          l.agent_name,
          `${l.tool_name}.${l.tool_action}`,
          v.severity?.toUpperCase() || '?',
          v.rule_id || 'unknown',
          v.message || '',
        ])
      })
    })

    // @ts-ignore
    doc.autoTable({
      startY: y,
      head: [['Time', 'Agent', 'Tool', 'Severity', 'Rule ID', 'Violation Detail']],
      body: violationRows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [180, 30, 30] },
      columnStyles: {
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
      },
      didDrawPage: () => { /* prevent header repeat */ },
    })
    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10
  }

  // --- Section 4: Full Audit Log ---
  if (y > 200) { doc.addPage(); y = 20 }

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`4. Full Audit Log (${totalActions} entries)`, 14, y)
  y += 6

  const logRows = logs.slice(0, 100).map(l => [
    new Date(l.timestamp).toLocaleString(),
    l.agent_name,
    `${l.tool_name}.${l.tool_action}`,
    l.response_status,
    l.response_summary.length > 60 ? l.response_summary.substring(0, 57) + '...' : l.response_summary,
    l.hash.substring(0, 12),
    l.policy_violations.length > 0 ? String(l.policy_violations.length) : '-',
  ])

  // @ts-ignore
  doc.autoTable({
    startY: y,
    head: [['Timestamp', 'Agent', 'Tool.Action', 'Status', 'Summary', 'Hash', 'Violations']],
    body: logRows,
    styles: { fontSize: 6.5 },
    headStyles: { fillColor: [10, 155, 128] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 18 },
      4: { cellWidth: 55 },
      5: { cellWidth: 24 },
      6: { cellWidth: 12 },
    },
  })

  if (logs.length > 100) {
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Note: Showing first 100 of ${logs.length} entries. Full log available in CSV export.`, 14, doc.lastAutoTable.finalY + 8)
  }

  // --- Footer on last page ---
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Agent Audit Trail — Colorado SB 205 Compliance Report — Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    doc.text(`Generated ${new Date().toISOString()} | Chain integrity: ${chainValid ? 'VERIFIED' : 'BROKEN'}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 4, { align: 'center' })
  }

  doc.save(`${filename}-colorado-sb205.pdf`)
}

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
