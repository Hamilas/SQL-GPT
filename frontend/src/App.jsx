import { useState } from 'react'
import Query from './components/Query.jsx'
import History from './components/History.jsx'
import About from './components/About.jsx'
import Sidebar from './components/Sidebar.jsx'

const DBIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="16" cy="8" rx="11" ry="3.5" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5"/>
    <rect x="5" y="8" width="22" height="14" fill="#1e293b"/>
    <ellipse cx="16" cy="22" rx="11" ry="3.5" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="5" y1="8" x2="5" y2="22" stroke="#f59e0b" strokeWidth="1.5"/>
    <line x1="27" y1="8" x2="27" y2="22" stroke="#f59e0b" strokeWidth="1.5"/>
    <ellipse cx="16" cy="8" rx="11" ry="3.5" fill="none" stroke="#f59e0b" strokeWidth="1.5"/>
  </svg>
)

const tabs = [
  { id: 'query', label: 'Query', icon: '⌘' },
  { id: 'history', label: 'History', icon: '◷' },
  { id: 'about', label: 'About', icon: 'ⓘ' },
]

export default function App() {
  const [active, setActive] = useState('query')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div style={{ background: '#0a0f1a', minHeight: '100vh', color: '#f1f5f9', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(51,65,85,0.4)',
      }}>
        <div style={{ height: 2, background: '#3b82f6' }} />
        <div style={{ maxWidth: '100%', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 32, height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DBIcon />
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
              <span style={{ color: '#f1f5f9' }}>SQL</span>
              <span style={{ color: '#f59e0b' }}>-GPT</span>
            </span>
          </div>

          <nav style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActive(t.id)} style={{
                background: active === t.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active === t.id ? '#60a5fa' : '#94a3b8',
                border: active === t.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                borderRadius: 8, padding: '6px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              }}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: '#475569', background: 'rgba(51,65,85,0.4)', padding: '3px 8px', borderRadius: 4 }}>
              LangChain · DuckDB · TPC-H
            </span>
          </div>
        </div>
      </header>

      {/* body: sidebar + content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 62px)' }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />

        <main style={{ flex: 1, padding: '32px 32px', minWidth: 0 }}>
          {active === 'query' && <Query />}
          {active === 'history' && <History />}
          {active === 'about' && <About />}
        </main>
      </div>
    </div>
  )
}
