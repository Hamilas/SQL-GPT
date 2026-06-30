import { useState, useEffect } from 'react'

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)',
      border: '1px solid rgba(51,65,85,0.4)',
      borderRadius: 12, padding: '20px 24px',
      ...style,
    }}>{children}</div>
  )
}

function sqlHighlight(sql) {
  if (!sql) return ''
  const keywords = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|INNER|ON|AS|LIMIT|WITH|UNION|DISTINCT|AND|OR|NOT|IN|LIKE|IS|NULL|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|BY|DESC|ASC|ROUND|CAST)\b/gi
  return sql
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(keywords, m => `<span style="color:#60a5fa;font-weight:600">${m.toUpperCase()}</span>`)
    .replace(/('.*?')/g, '<span style="color:#34d399">$1</span>')
    .replace(/\b(\d+(\.\d+)?)\b/g, '<span style="color:#f59e0b">$1</span>')
}

export default function History() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch('/api/v1/metrics')
      .then(r => r.json())
      .then(d => { setMetrics(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', color: '#475569', padding: 60, fontSize: 15 }}>
      Loading history…
    </div>
  )

  if (error) return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#fca5a5' }}>
      {error}
    </div>
  )

  const summary = metrics?.summary || {}
  const recent = metrics?.recent_queries || []
  const breakdown = metrics?.latency_breakdown || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Queries', value: summary.total_queries ?? 0 },
          { label: 'Success Rate', value: summary.success_rate != null ? `${summary.success_rate}%` : '—' },
          { label: 'Avg Latency', value: summary.avg_latency != null ? `${summary.avg_latency.toFixed(2)}s` : '—' },
          { label: 'Self-Healed', value: summary.self_healing_recoveries ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.4)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* latency breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <Card>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Latency Breakdown
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(breakdown).map(([stage, ms]) => {
              const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? (ms / total) * 100 : 0
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#cbd5e1', textTransform: 'capitalize' }}>{stage.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 13, color: '#94a3b8' }}>{typeof ms === 'number' ? `${ms.toFixed(3)}s` : ms}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(51,65,85,0.5)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* recent queries */}
      <Card>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Recent Queries ({recent.length})
        </p>
        {recent.length === 0 ? (
          <p style={{ color: '#475569', fontSize: 14 }}>No queries yet. Run some queries in the Query tab.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.map((q, i) => (
              <div key={i} style={{
                background: 'rgba(10,15,26,0.5)', borderRadius: 8,
                border: '1px solid rgba(51,65,85,0.3)',
                overflow: 'hidden',
              }}>
                <div
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: q.success ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
                    color: q.success ? '#34d399' : '#f87171',
                  }}>{q.success ? '✓' : '✗'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.question || '—'}
                  </span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{q.total_latency != null ? `${q.total_latency.toFixed(2)}s` : ''}</span>
                  <span style={{ color: '#475569', fontSize: 12 }}>{expanded === i ? '▲' : '▼'}</span>
                </div>
                {expanded === i && q.generated_sql && (
                  <div style={{ borderTop: '1px solid rgba(51,65,85,0.3)', padding: '12px 16px' }}>
                    <pre style={{
                      fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: 12,
                      lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e2e8f0',
                    }}
                      dangerouslySetInnerHTML={{ __html: sqlHighlight(q.generated_sql) }}
                    />
                    {q.rows_returned != null && (
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                        {q.rows_returned} row{q.rows_returned !== 1 ? 's' : ''} returned
                        {q.is_simulation ? ' · What-If simulation' : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
