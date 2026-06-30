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

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
      {children}
    </p>
  )
}

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/health', desc: 'Service health check — returns app name, LLM, DB status' },
  { method: 'POST', path: '/api/v1/query', desc: 'Run a natural language query — returns SQL + results' },
  { method: 'GET', path: '/api/v1/schema', desc: 'Full schema for all 8 TPC-H tables' },
  { method: 'GET', path: '/api/v1/metrics', desc: 'Runtime stats — latency breakdown, recent query log' },
]

const TECH = [
  ['LangChain 0.2', 'Orchestration'],
  ['LangGraph', 'Agent graph'],
  ['DuckDB 1.4', 'SQL engine'],
  ['ChromaDB', 'Vector store'],
  ['all-MiniLM-L6-v2', 'Embeddings'],
  ['BM25', 'Keyword retrieval'],
  ['FastAPI', 'REST API'],
  ['React 18 + Vite', 'Frontend'],
  ['TPC-H SF=0.1', 'Dataset'],
]

export default function About() {
  const [health, setHealth] = useState(null)
  const [schema, setSchema] = useState(null)
  const [schemaOpen, setSchemaOpen] = useState(null)

  useEffect(() => {
    fetch('/api/v1/health').then(r => r.json()).then(setHealth).catch(() => {})
    fetch('/api/v1/schema').then(r => r.json()).then(setSchema).catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* health */}
      <Card>
        <SectionTitle>System Status</SectionTitle>
        {health ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[
              { label: 'Status', value: health.status === 'healthy' ? '● Healthy' : '○ Unhealthy', color: health.status === 'healthy' ? '#34d399' : '#f87171' },
              { label: 'App', value: health.app_name },
              { label: 'Version', value: health.app_version },
              { label: 'LLM', value: health.llm },
              { label: 'Database', value: health.db_ready ? '✓ Ready' : '✗ Missing', color: health.db_ready ? '#34d399' : '#f87171' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ minWidth: 120 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: color || '#f1f5f9', marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#475569', fontSize: 14 }}>Connecting to API…</p>
        )}
      </Card>

      {/* description */}
      <Card>
        <SectionTitle>About SQL-GPT</SectionTitle>
        <p style={{ color: '#cbd5e1', lineHeight: 1.7, marginBottom: 12 }}>
          SQL-GPT translates natural language questions into SQL queries against a supply chain database
          (TPC-H benchmark, scale factor 0.1). It uses hybrid retrieval (ChromaDB semantic search + BM25 keyword
          matching) to find the most relevant schema context, then passes it to an LLM for SQL generation.
        </p>
        <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: 14 }}>
          A 3-attempt self-healing loop retries on syntax errors. A safety validator (sqlparse + blocklist)
          blocks destructive statements. What-If CTE simulation rewrites queries with different parameters to
          model supply chain scenarios.
        </p>
      </Card>

      {/* tech stack */}
      <Card>
        <SectionTitle>Technology Stack</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {TECH.map(([tech, role]) => (
            <div key={tech} style={{
              background: 'rgba(51,65,85,0.25)', borderRadius: 8, padding: '8px 12px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{tech}</span>
              <span style={{ fontSize: 11, color: '#64748b' }}>{role}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* schema explorer */}
      {schema && (
        <Card>
          <SectionTitle>Database Schema — TPC-H Supply Chain ({Object.keys(schema.tables).length} tables)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(schema.tables).map(([table, info]) => (
              <div key={table} style={{ border: '1px solid rgba(51,65,85,0.3)', borderRadius: 8, overflow: 'hidden' }}>
                <div
                  onClick={() => setSchemaOpen(schemaOpen === table ? null : table)}
                  style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10,15,26,0.4)' }}
                >
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', fontSize: 14 }}>{table}</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 10 }}>{info.description}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>{info.columns.length} cols</span>
                    <span style={{ color: '#475569', fontSize: 12 }}>{schemaOpen === table ? '▲' : '▼'}</span>
                  </div>
                </div>
                {schemaOpen === table && (
                  <div style={{ padding: '8px 14px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {info.columns.map(col => (
                        <span key={col.name} style={{
                          background: 'rgba(51,65,85,0.3)', borderRadius: 4, padding: '3px 8px',
                          fontSize: 12, fontFamily: 'monospace',
                          color: '#e2e8f0',
                        }}>
                          <span style={{ color: '#94a3b8' }}>{col.name}</span>
                          <span style={{ color: '#475569' }}> {col.type}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* API endpoints */}
      <Card>
        <SectionTitle>API Endpoints</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ENDPOINTS.map(ep => (
            <div key={ep.path} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(51,65,85,0.2)' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                background: ep.method === 'GET' ? 'rgba(52,211,153,0.15)' : 'rgba(59,130,246,0.15)',
                color: ep.method === 'GET' ? '#34d399' : '#60a5fa',
              }}>{ep.method}</span>
              <code style={{ fontSize: 13, color: '#f59e0b', fontFamily: 'monospace', minWidth: 160 }}>{ep.path}</code>
              <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* author */}
      <Card>
        <SectionTitle>Author</SectionTitle>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Rayen Lassoued</p>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>AI/ML Engineer · Bonn, Germany</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="https://github.com/Hamilas" target="_blank" rel="noreferrer" style={{
              background: 'rgba(51,65,85,0.4)', border: '1px solid rgba(51,65,85,0.5)',
              borderRadius: 8, padding: '6px 14px', color: '#e2e8f0', fontSize: 13,
              textDecoration: 'none', fontWeight: 500,
            }}>GitHub</a>
            <a href="https://www.linkedin.com/in/lassoued-rayen/" target="_blank" rel="noreferrer" style={{
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 8, padding: '6px 14px', color: '#60a5fa', fontSize: 13,
              textDecoration: 'none', fontWeight: 500,
            }}>LinkedIn</a>
          </div>
        </div>
      </Card>
    </div>
  )
}
