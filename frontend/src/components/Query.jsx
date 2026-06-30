import { useState, useRef } from 'react'

const CHIPS = [
  'Top 5 customers by revenue',
  'Which suppliers have the most delayed shipments?',
  'Average order value by region',
  'Parts with highest discount rates',
  'Monthly order volume trend',
]

function sqlHighlight(sql) {
  if (!sql) return ''
  // Single-pass tokenizer: each character of the source is matched at most
  // once, so later token types can never re-match text inside HTML that an
  // earlier replacement already inserted (e.g. digits in "font-weight:600").
  const escaped = sql.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const token = /(--.*$)|('.*?')|\b(\d+(?:\.\d+)?)\b|\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|JOIN|LEFT|RIGHT|INNER|ON|AS|LIMIT|WITH|UNION|DISTINCT|AND|OR|NOT|IN|LIKE|IS|NULL|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|BY|DESC|ASC|CREATE|TABLE|INSERT|UPDATE|DELETE|ROUND|CAST)\b/gim
  return escaped.replace(token, (m, comment, str, num, kw) => {
    if (comment) return `<span style="color:#64748b;font-style:italic">${comment}</span>`
    if (str) return `<span style="color:#34d399">${str}</span>`
    if (num) return `<span style="color:#f59e0b">${num}</span>`
    if (kw) return `<span style="color:#60a5fa;font-weight:600">${kw.toUpperCase()}</span>`
    return m
  })
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)',
      border: '1px solid rgba(51,65,85,0.4)',
      borderRadius: 12,
      padding: '20px 24px',
      ...style,
    }}>{children}</div>
  )
}

function ResultTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c} style={{
                textAlign: 'left', padding: '8px 12px',
                color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
                borderBottom: '1px solid rgba(51,65,85,0.5)',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'transparent' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '8px 12px', color: '#e2e8f0',
                  borderBottom: '1px solid rgba(51,65,85,0.2)',
                }}>{cell !== null && cell !== undefined ? String(cell) : '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Query() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const lastQuestion = useRef('')

  async function exportPdf() {
    if (!result || !result.success) return
    setExporting(true)
    try {
      const res = await fetch('/api/v1/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: lastQuestion.current,
          sql: result.sql || '',
          columns: result.columns,
          rows: result.rows,
          latency_s: result.latency_s,
          is_simulation: result.is_simulation,
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sql_gpt_result.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('PDF export failed: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  async function runQuery(q) {
    const text = (q || question).trim()
    if (!text) return
    lastQuestion.current = text
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Query failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChip(chip) {
    setQuestion(chip)
    runQuery(chip)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* input card */}
      <Card>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Natural Language Query
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runQuery()}
            placeholder="Ask anything about the supply chain database…"
            style={{
              flex: 1, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)',
              borderRadius: 8, padding: '10px 16px', color: '#f1f5f9', fontSize: 15,
              outline: 'none',
            }}
          />
          <button
            onClick={() => runQuery()}
            disabled={loading || !question.trim()}
            style={{
              background: loading ? 'rgba(59,130,246,0.3)' : '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
              fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, minWidth: 90,
            }}
          >
            {loading ? (
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite' }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                <path d="M8 2 A6 6 0 0 1 14 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : '▶ Run'}
          </button>
        </div>

        {/* chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {CHIPS.map(chip => (
            <button key={chip} onClick={() => handleChip(chip)} style={{
              background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: 20, padding: '4px 12px', color: '#94a3b8', fontSize: 12,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.target.style.color = '#f59e0b'; e.target.style.borderColor = 'rgba(245,158,11,0.4)' }}
              onMouseLeave={e => { e.target.style.color = '#94a3b8'; e.target.style.borderColor = 'rgba(51,65,85,0.5)' }}
            >{chip}</button>
          ))}
        </div>
      </Card>

      {/* error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#fca5a5', fontSize: 14 }}>
          ✗ {error}
        </div>
      )}

      {/* result */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* meta row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Rows', value: result.row_count },
              { label: 'Latency', value: `${result.latency_s}s` },
              { label: 'Mode', value: result.is_simulation ? 'What-If' : 'Live' },
              { label: 'Status', value: result.success ? '✓ Success' : '✗ Error' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.4)',
                borderRadius: 8, padding: '8px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* SQL */}
          {result.sql && (
            <Card>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Generated SQL
              </p>
              <pre style={{
                fontFamily: "'Fira Code', 'Cascadia Code', monospace", fontSize: 13,
                lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: '#e2e8f0',
              }}
                dangerouslySetInnerHTML={{ __html: sqlHighlight(result.sql) }}
              />
            </Card>
          )}

          {/* data table */}
          {result.success && result.columns && result.columns.length > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, margin: 0 }}>
                  Results — {result.row_count} row{result.row_count !== 1 ? 's' : ''}
                  {result.is_simulation && (
                    <span style={{ marginLeft: 8, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>
                      What-If Simulation
                    </span>
                  )}
                </p>
                <button onClick={exportPdf} disabled={exporting} style={{
                  background: exporting ? 'rgba(51,65,85,0.4)' : 'rgba(239,68,68,0.15)',
                  color: exporting ? '#475569' : '#fca5a5',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {exporting ? '…' : '↓'} Export PDF
                </button>
              </div>
              <ResultTable columns={result.columns} rows={result.rows} />
            </Card>
          )}

          {!result.success && result.error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#fca5a5', fontSize: 14 }}>
              {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
