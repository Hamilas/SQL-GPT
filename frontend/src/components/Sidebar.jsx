import { useState, useEffect } from 'react'

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: 6, padding: '7px 10px', color: '#f1f5f9', fontSize: 12, outline: 'none',
}

export default function Sidebar({ collapsed, onToggle }) {
  const [dbType, setDbType] = useState('duckdb')
  const [dbPath, setDbPath] = useState('/app/data/sql_agent_demo.db')
  const [availableFiles, setAvailableFiles] = useState([])
  const [activePg, setActivePg] = useState([])
  const [gatewayIp, setGatewayIp] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [pgHost, setPgHost] = useState('')
  const [pgPort, setPgPort] = useState('5432')
  const [pgDb, setPgDb] = useState('postgres')
  const [pgUser, setPgUser] = useState('postgres')
  const [pgPass, setPgPass] = useState('')
  const [status, setStatus] = useState(null)   // null | 'ok' | 'error'
  const [statusMsg, setStatusMsg] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [liveConfig, setLiveConfig] = useState(null)

  useEffect(() => {
    fetch('/api/v1/config').then(r => r.json()).then(d => {
      setLiveConfig(d)
      if (d.db_path) setDbPath(d.db_path)
    }).catch(() => {})
  }, [])

  async function scan() {
    setScanning(true)
    setStatus(null)
    try {
      const r = await fetch('/api/v1/db/available')
      const d = await r.json()
      setAvailableFiles(d.duckdb_files || [])
      setActivePg(d.postgres_ports || [])
      setGatewayIp(d.docker_gateway || null)
      if (d.postgres_ports?.length > 0) {
        setPgHost(d.postgres_ports[0].host)
        setPgPort(String(d.postgres_ports[0].port))
      } else if (d.docker_gateway) {
        setPgHost(d.docker_gateway)
      }
    } catch (e) {
      setStatus('error'); setStatusMsg('Scan failed: ' + e.message)
    } finally {
      setScanning(false)
    }
  }

  async function connect() {
    setConnecting(true)
    setStatus(null)
    try {
      const body = dbType === 'postgres'
        ? { db_type: 'postgres', pg_host: pgHost, pg_port: parseInt(pgPort), pg_database: pgDb, pg_user: pgUser, pg_password: pgPass }
        : { db_path: dbPath, db_type: 'duckdb' }

      const res = await fetch('/api/v1/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error'); setStatusMsg(data.detail || 'Connection failed')
      } else {
        setStatus('ok'); setStatusMsg('Connected')
        setLiveConfig(data.config)
      }
    } catch (e) {
      setStatus('error'); setStatusMsg(e.message)
    } finally {
      setConnecting(false)
    }
  }

  const W = collapsed ? 48 : 270

  return (
    <aside style={{
      width: W, minWidth: W, flexShrink: 0,
      background: 'rgba(10,15,26,0.95)', borderRight: '1px solid rgba(51,65,85,0.4)',
      display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease',
      overflow: 'hidden', position: 'sticky', top: 62, height: 'calc(100vh - 62px)',
    }}>
      {/* toggle */}
      <button onClick={onToggle} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '12px',
        display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end',
        color: '#475569', fontSize: 16, borderBottom: '1px solid rgba(51,65,85,0.3)',
        flexShrink: 0,
      }}>
        {collapsed ? '▶' : '◀'}
      </button>

      {!collapsed && (
        <div style={{ padding: '14px', overflowY: 'auto', flex: 1 }}>

          {/* active badge */}
          {liveConfig && (
            <div style={{
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 14,
            }}>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: 12 }}>● Connected</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 1 }}>{liveConfig.llm_label}</div>
              <div style={{ color: '#475569', fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>
                {liveConfig.db_path?.split('/').pop() || liveConfig.db_path}
              </div>
            </div>
          )}

          {/* section title */}
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', borderBottom: '1px solid rgba(51,65,85,0.4)', paddingBottom: 8, marginBottom: 12 }}>
            Database
          </p>

          <Field label="Type">
            <select value={dbType} onChange={e => { setDbType(e.target.value); setStatus(null) }} style={inputStyle}>
              <option value="duckdb">DuckDB (file)</option>
              <option value="postgres">PostgreSQL (host:port)</option>
            </select>
          </Field>

          {/* ── DuckDB ── */}
          {dbType === 'duckdb' && (
            <>
              <Field label="File Path">
                <input value={dbPath} onChange={e => { setDbPath(e.target.value); setStatus(null) }}
                  placeholder="/app/data/my.db" style={inputStyle} />
              </Field>

              <button onClick={scan} disabled={scanning} style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid rgba(51,65,85,0.5)', background: 'transparent',
                color: scanning ? '#475569' : '#64748b', fontSize: 11,
                cursor: scanning ? 'not-allowed' : 'pointer', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', animation: scanning ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                {scanning ? 'Scanning…' : 'Scan for .db files'}
              </button>

              {availableFiles.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Found {availableFiles.length} file{availableFiles.length !== 1 ? 's' : ''}
                  </p>
                  {availableFiles.map(f => (
                    <button key={f} onClick={() => { setDbPath(f); setStatus(null) }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                      marginBottom: 3, borderRadius: 6,
                      border: `1px solid ${dbPath === f ? 'rgba(59,130,246,0.4)' : 'rgba(51,65,85,0.3)'}`,
                      background: dbPath === f ? 'rgba(59,130,246,0.12)' : 'rgba(15,23,42,0.5)',
                      color: dbPath === f ? '#60a5fa' : '#94a3b8',
                      fontSize: 12, cursor: 'pointer', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={f}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                      {f.split('/').pop()}
                    </button>
                  ))}
                </div>
              )}

              {availableFiles.length === 0 && !scanning && (
                <p style={{ fontSize: 11, color: '#334155', marginBottom: 8 }}>
                  Click scan or type a path manually.
                </p>
              )}
            </>
          )}

          {/* ── PostgreSQL ── */}
          {dbType === 'postgres' && (
            <>
              <button onClick={scan} disabled={scanning} style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                border: '1px solid rgba(51,65,85,0.5)', background: 'transparent',
                color: scanning ? '#475569' : '#64748b', fontSize: 11,
                cursor: scanning ? 'not-allowed' : 'pointer', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <span style={{ display: 'inline-block', animation: scanning ? 'spin 1s linear infinite' : 'none' }}>⟳</span>
                {scanning ? 'Scanning network…' : 'Scan for PostgreSQL'}
              </button>

              {gatewayIp && (
                <p style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>
                  Docker host: <code style={{ color: '#f59e0b' }}>{gatewayIp}</code>
                </p>
              )}

              {activePg.length > 0 ? (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 10, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    ● {activePg.length} active port{activePg.length !== 1 ? 's' : ''} found
                  </p>
                  {activePg.map((pg, i) => (
                    <button key={i} onClick={() => { setPgHost(pg.host); setPgPort(String(pg.port)); setStatus(null) }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                      marginBottom: 3, borderRadius: 6, border: '1px solid rgba(52,211,153,0.35)',
                      background: pgHost === pg.host && pgPort === String(pg.port)
                        ? 'rgba(52,211,153,0.12)' : 'rgba(15,23,42,0.5)',
                      color: '#34d399', fontSize: 12, cursor: 'pointer',
                    }}>
                      ● {pg.host}:{pg.port}
                    </button>
                  ))}
                </div>
              ) : !scanning && (
                <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                  No PostgreSQL found. Fill in manually.
                </p>
              )}

              <Field label="Host">
                <input value={pgHost} onChange={e => { setPgHost(e.target.value); setStatus(null) }}
                  placeholder="172.20.0.1 or postgres" style={inputStyle} />
              </Field>
              <Field label="Port">
                <input value={pgPort} onChange={e => { setPgPort(e.target.value); setStatus(null) }} style={inputStyle} />
              </Field>
              <Field label="Database">
                <input value={pgDb} onChange={e => { setPgDb(e.target.value); setStatus(null) }} style={inputStyle} />
              </Field>
              <Field label="User">
                <input value={pgUser} onChange={e => { setPgUser(e.target.value); setStatus(null) }} style={inputStyle} />
              </Field>
              <Field label="Password">
                <input type="password" value={pgPass} onChange={e => { setPgPass(e.target.value); setStatus(null) }}
                  placeholder="optional" style={inputStyle} />
              </Field>
            </>
          )}

          {/* connect button */}
          <button onClick={connect} disabled={connecting} style={{
            width: '100%', padding: '9px', borderRadius: 7, border: 'none', marginTop: 4,
            background: connecting ? 'rgba(51,65,85,0.4)' : 'rgba(59,130,246,0.2)',
            color: connecting ? '#475569' : '#60a5fa',
            fontSize: 13, fontWeight: 700, cursor: connecting ? 'not-allowed' : 'pointer',
          }}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>

          {status && (
            <div style={{
              marginTop: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12,
              background: status === 'ok' ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
              color: status === 'ok' ? '#34d399' : '#f87171',
            }}>
              {status === 'ok' ? '✓' : '✗'} {statusMsg}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
