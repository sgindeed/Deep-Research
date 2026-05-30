import { useState, useEffect, useRef, useCallback } from 'react'
import { parse } from 'marked'
import html2pdf from 'html2pdf.js'
import ForceGraph3D from 'react-force-graph-3d'

const API_BASE = "http://localhost:8000"
const WS_BASE = "ws://localhost:8000"

// --- PREMIUM SVG ICONS ---
const Icons = {
  Plus: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  History: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Doc: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Network: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Settings: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('research_token'))
  const [isLoginView, setIsLoginView] = useState(true)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [appView, setAppView] = useState('home')
  const [history, setHistory] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  
  const [query, setQuery] = useState('')
  const [depth, setDepth] = useState('medium')
  const [iterations, setIterations] = useState(3)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [progress, setProgress] = useState(0)
  const [currentAgent, setCurrentAgent] = useState('Idle')
  const [logs, setLogs] = useState([])

  const [report, setReport] = useState('')
  const [sources, setSources] = useState([])
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [showGraphOverlay, setShowGraphOverlay] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())

  const wsRef = useRef(null)
  const logsEndRef = useRef(null)

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  useEffect(() => {
    if (token) loadHistory()
  }, [token])

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/research/history`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) setHistory(await res.json())
      else if (res.status === 401) logout()
    } catch (e) { console.error("Failed to load history", e) }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    try {
      const endpoint = isLoginView ? '/auth/login' : '/auth/register'
      const opts = isLoginView 
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: authEmail, password: authPassword }) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword }) }

      const res = await fetch(`${API_BASE}${endpoint}`, opts)
      if (!res.ok) throw new Error(isLoginView ? "Invalid credentials" : "Registration failed")
      
      if (isLoginView) {
        const data = await res.json()
        localStorage.setItem('research_token', data.access_token)
        setToken(data.access_token)
      } else {
        setIsLoginView(true)
        setAuthError("Account created! Please log in.")
      }
    } catch (err) { setAuthError(err.message) }
  }

  const logout = () => {
    localStorage.removeItem('research_token')
    setToken(null)
    setAppView('home')
    setHistory([])
  }

  const resetWorkspace = () => {
    setAppView('home')
    setActiveSessionId(null)
    setQuery('')
    setReport('')
    setSources([])
    setGraphData({ nodes: [], links: [] })
    setShowGraphOverlay(false)
  }

  const appendLog = (msg) => setLogs(prev => [...prev, `> ${msg}`])

  const startResearch = async () => {
    if (!query.trim()) return
    setAppView('processing')
    setLogs([])
    setProgress(0)
    
    try {
      const res = await fetch(`${API_BASE}/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query, depth, max_iterations: iterations })
      })

      if (res.status === 401) { logout(); throw new Error("Session expired.") }
      if (!res.ok) throw new Error("Backend error")
      
      const data = await res.json()
      setActiveSessionId(data.research_id)
      loadHistory()
      
      wsRef.current = new WebSocket(`${WS_BASE}/ws/research/${data.research_id}`)
      wsRef.current.onmessage = (e) => {
        const wsData = JSON.parse(e.data)
        if (wsData.event === "progress") {
          setCurrentAgent(wsData.agent)
          setProgress(wsData.progress)
          appendLog(`[${wsData.agent}] ${wsData.message}`)
          if (wsData.progress >= 100) {
            wsRef.current.close()
            fetchFinalResults(data.research_id)
          }
        }
      }
    } catch (err) { appendLog(`Error: ${err.message}`) }
  }

  const fetchFinalResults = async (id) => {
    try {
      setAppView('processing')
      appendLog("Downloading synthesized assets...")
      
      const [reportRes, graphRes] = await Promise.all([
        fetch(`${API_BASE}/research/final/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/research/graph/${id}`).catch(() => ({ ok: false }))
      ])

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        setReport(reportData.markdown_content)
        setSources(reportData.sources || [])
      }

      if (graphRes.ok) {
        const rawGraph = await graphRes.json()
        setGraphData({
          nodes: rawGraph.nodes.map(n => ({ id: n.id, name: n.label, group: n.type, val: 1, color: n.color, description: n.description, metadata: n.metadata || {} })),
          links: rawGraph.edges.map(e => ({ source: e.source, target: e.target, label: e.relation }))
        })
      } else {
        setGraphData({ nodes: [], links: [] })
      }

      setAppView('results')
      setActiveSessionId(id)
    } catch (err) {
      alert("Failed to load report data.")
      setAppView('home')
    }
  }

  const downloadDoc = (format) => {
    const filename = `Deep_Research_${new Date().toISOString().split('T')[0]}`
    const rawHtml = parse(report)
    const cleanWrapper = document.createElement('div')
    cleanWrapper.innerHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.7; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 32px; font-size: 28px;">Research Synthesis</h1>
        ${rawHtml}
      </div>`

    if (format === 'pdf') {
      html2pdf().set({
        margin: 0.75, filename: `${filename}.pdf`, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      }).from(cleanWrapper).save()
    } else {
      const fullHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Report</title></head><body>${cleanWrapper.innerHTML}</body></html>`
      const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `${filename}.doc`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
    }
  }

  const updateHighlight = useCallback((node) => {
    setHighlightNodes(new Set()); setHighlightLinks(new Set())
    if (node) {
      const newNodes = new Set([node]); const newLinks = new Set()
      graphData.links.forEach(link => {
        if (link.source.id === node.id || link.target.id === node.id) {
          newLinks.add(link); newNodes.add(link.source); newNodes.add(link.target)
        }
      })
      setHighlightNodes(newNodes); setHighlightLinks(newLinks); setSelectedNode(node)
    } else setSelectedNode(null)
  }, [graphData])

  // ==========================================
  // RENDER: AUTHENTICATION
  // ==========================================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#050814] flex items-center justify-center text-slate-200 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-[#050814] to-[#050814]">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none"></div>
        
        <form onSubmit={handleAuth} className="relative z-10 bg-[#0a0f1c]/80 backdrop-blur-2xl p-10 rounded-3xl border border-white/5 w-full max-w-md shadow-2xl shadow-cyan-900/10">
          <div className="flex justify-center mb-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"><Icons.Network /></div>
          <h2 className="text-3xl font-extrabold mb-8 text-center text-white tracking-tight">{isLoginView ? 'System Uplink' : 'Initialize Account'}</h2>
          
          {authError && <div className="mb-6 text-sm text-red-400 bg-red-500/10 p-4 rounded-xl border border-red-500/20">{authError}</div>}
          
          <div className="space-y-4 mb-8">
            <input type="email" placeholder="Enterprise Email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} 
              className="w-full bg-[#03050a] border border-white/5 rounded-xl p-4 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-slate-200 placeholder-slate-600 shadow-inner" />
            <input type="password" placeholder="Passphrase" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} 
              className="w-full bg-[#03050a] border border-white/5 rounded-xl p-4 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-slate-200 placeholder-slate-600 shadow-inner" />
          </div>
            
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-cyan-500/25">
            {isLoginView ? 'Establish Connection' : 'Generate Credentials'}
          </button>
          
          <div className="mt-6 text-center text-sm text-slate-500">
            {isLoginView ? "No clearance? " : "Existing clearance? "}
            <button type="button" onClick={() => setIsLoginView(!isLoginView)} className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors drop-shadow-sm">
              {isLoginView ? 'Request Access' : 'Authenticate'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ==========================================
  // RENDER: MAIN WORKSPACE
  // ==========================================
  return (
    <div className="flex h-screen bg-[#050814] text-slate-200 font-sans overflow-hidden selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none mix-blend-screen"></div>

      {/* --- SIDEBAR --- */}
      <aside className="w-72 bg-[#0a0f1c]/80 border-r border-white/5 flex flex-col shrink-0 backdrop-blur-2xl relative z-20">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 rounded-lg border border-white/5 shadow-inner"><Icons.Network /></div>
          <div>
            <h1 className="font-bold text-slate-100 tracking-wide text-sm">DeepResearch<span className="text-cyan-500">OS</span></h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">Autonomous Agent</p>
          </div>
        </div>

        <div className="p-5">
          <button onClick={resetWorkspace} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200 px-4 py-3 rounded-xl text-sm font-medium transition-all">
            <Icons.Plus /> New Investigation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-2">Session History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600 px-2 italic">No prior queries found.</p>
          ) : (
            history.map(session => (
              <button key={session.id} onClick={() => fetchFinalResults(session.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${activeSessionId === session.id ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'}`}>
                <div className="shrink-0 opacity-50"><Icons.History /></div>
                <div className="truncate flex-1">{session.query}</div>
                {!session.has_report && <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0 shadow-[0_0_5px_rgba(6,182,212,0.8)]"></span>}
              </button>
            ))
          )}
        </div>

        <div className="p-5 border-t border-white/5">
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-300 py-2 transition-colors">
            End Session
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 bg-gradient-to-br from-[#050814] to-[#020308]">
        
        {/* VIEW 1: HOME (New Search) */}
        {appView === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="w-full max-w-3xl space-y-10 relative">
              
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-600/20 rounded-full blur-[100px] pointer-events-none"></div>

              <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-500 text-center tracking-tight leading-tight">
                What do you want to<br/>explore today?
              </h2>
              
              <div className="bg-[#0f1526]/80 backdrop-blur-xl border border-white/10 focus-within:border-cyan-500/50 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all rounded-3xl p-2 shadow-2xl relative z-10">
                <textarea 
                  value={query} onChange={e => setQuery(e.target.value)} 
                  placeholder="Define a complex research parameter..." 
                  className="w-full bg-transparent p-5 outline-none resize-none text-slate-200 text-lg md:text-xl min-h-[140px] placeholder-slate-600"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startResearch(); } }}
                />
                
                <div className="flex justify-between items-center px-4 pb-2 border-t border-white/5 pt-4 mt-2">
                  <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition-colors font-semibold uppercase tracking-wider">
                    <Icons.Settings /> {showAdvanced ? 'Hide Specs' : 'Execution Specs'}
                  </button>
                  <button onClick={startResearch} disabled={!query.trim()} className="bg-gradient-to-r from-cyan-600 to-blue-600 disabled:opacity-50 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                    Initialize <Icons.Search />
                  </button>
                </div>

                {showAdvanced && (
                  <div className="px-5 py-5 bg-[#03050a]/80 rounded-2xl mt-3 flex gap-6 border border-white/5 shadow-inner animate-in slide-in-from-top-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Search Depth</label>
                      <select value={depth} onChange={e => setDepth(e.target.value)} className="w-full bg-[#0f1526] border border-white/10 rounded-lg p-2.5 text-sm text-slate-300 outline-none focus:border-cyan-500 transition-colors">
                        <option value="light">Surface Scan (Fast)</option>
                        <option value="medium">Deep Dive (Balanced)</option>
                        <option value="deep">Exhaustive Extraction (Slow)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Max Agent Cycles</label>
                      <input type="number" value={iterations} onChange={e => setIterations(e.target.value)} min="1" max="15" className="w-full bg-[#0f1526] border border-white/10 rounded-lg p-2.5 text-sm text-slate-300 outline-none focus:border-cyan-500 transition-colors" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: PROCESSING (Terminal) */}
        {appView === 'processing' && (
          <div className="flex-1 flex flex-col p-8 md:p-12 max-w-6xl mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-bold text-slate-100 mb-8 flex items-center gap-4">
              <div className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-cyan-50 shadow-[0_0_10px_rgba(6,182,212,1)]"></span>
              </div>
              Synthesizing Intelligence
            </h2>
            
            <div className="bg-[#0f1526]/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col flex-grow shadow-2xl overflow-hidden font-mono">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#0a0f1c]/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                </div>
                <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.15)]">{currentAgent}</span>
              </div>
              
              <div className="h-1 bg-[#03050a] w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]" style={{ width: `${progress}%` }}></div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-slate-400 space-y-3 leading-relaxed">
                {logs.length === 0 && <div className="opacity-40 animate-pulse">Initializing autonomous swarm protocol...</div>}
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-slate-600 shrink-0 select-none">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                    <span className={l.includes('Error') ? 'text-red-400' : 'text-slate-300'}>{l}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: RESULTS */}
        {appView === 'results' && (
          <div className="flex-1 overflow-y-auto bg-transparent relative animate-in fade-in duration-500">
            
            {/* Header Action Bar */}
            <div className="sticky top-0 z-10 bg-[#050814]/80 backdrop-blur-2xl border-b border-white/5 px-8 py-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-100 truncate">{query}</h2>
              </div>
              <div className="flex gap-3 shrink-0">
                {graphData.nodes.length > 0 && (
                  <button onClick={() => setShowGraphOverlay(true)} className="flex items-center gap-2 text-sm bg-[#0f1526] hover:bg-[#131b2f] text-cyan-300 border border-cyan-500/30 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-cyan-500/10 font-medium">
                    <Icons.Network /> Knowledge Graph
                  </button>
                )}
                <div className="flex bg-[#0f1526] border border-white/5 rounded-xl p-1 shadow-inner">
                  <button onClick={() => downloadDoc('pdf')} className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-colors"><Icons.Download /> PDF</button>
                  <button onClick={() => downloadDoc('docx')} className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-colors"><Icons.Download /> DOCX</button>
                </div>
              </div>
            </div>

            {/* Document Flow */}
            <div className="max-w-4xl mx-auto p-8 lg:p-16 pb-24">
              <article className="prose prose-invert max-w-none 
                prose-headings:font-bold prose-headings:text-slate-100 
                prose-h1:text-4xl prose-h1:mb-8 prose-h1:tracking-tight
                prose-h2:text-2xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-3 prose-h2:mt-12
                prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
                prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-[1.05rem]
                prose-li:text-slate-300 prose-strong:text-slate-200" 
                dangerouslySetInnerHTML={{ __html: parse(report || '# Report not generated') }} />
              
              <div className="my-16 flex items-center gap-4">
                <div className="h-px bg-white/10 flex-1"></div>
                <div className="text-slate-600 font-mono text-xs tracking-widest uppercase">End of Synthesis</div>
                <div className="h-px bg-white/10 flex-1"></div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-3"><Icons.Doc /> Verified Sources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block p-5 bg-[#0f1526]/50 hover:bg-[#131b2f] border border-white/5 hover:border-cyan-500/50 rounded-2xl transition-all group shadow-sm hover:shadow-cyan-500/10">
                    <h4 className="text-sm font-bold text-cyan-400 group-hover:text-cyan-300 mb-3 truncate leading-snug">{s.title || s.url}</h4>
                    <div className="flex gap-4 text-xs font-mono text-slate-500">
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>Trust: {Math.round(s.trust_score * 100)}%</span>
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_5px_rgba(139,92,246,0.8)]"></div>Bias: {s.bias_estimate || 'Low'}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- 3D GRAPH MODAL OVERLAY --- */}
      {showGraphOverlay && (
        <div className="fixed inset-0 z-50 bg-[#02040a]/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <div className="absolute top-0 w-full z-10 flex justify-between items-start p-8 bg-gradient-to-b from-[#02040a] to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <h2 className="text-2xl font-bold text-white tracking-tight">Semantic Knowledge Graph</h2>
              <p className="text-sm text-slate-400 mt-1">Interactive topology of discovered insights and contradictions.</p>
            </div>
            <button onClick={() => setShowGraphOverlay(false)} className="pointer-events-auto p-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-all hover:scale-105">
              <Icons.Close />
            </button>
          </div>

          <div className="flex-1 relative cursor-crosshair">
            {selectedNode && (
              <div className="absolute bottom-10 left-10 z-10 bg-[#0a0f1c]/90 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm backdrop-blur-2xl animate-in slide-in-from-bottom-8">
                <h3 className="font-bold text-lg text-white mb-3 leading-snug">{selectedNode.name}</h3>
                <div className="text-[10px] text-slate-400 mb-4 font-mono uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: selectedNode.color || '#9ca3af', color: selectedNode.color }}></span>
                    {selectedNode.group} 
                </div>
                {selectedNode.description && <p className="text-sm text-slate-300 italic mb-5 border-l-2 border-cyan-500 pl-3 leading-relaxed">{selectedNode.description}</p>}
                {selectedNode.group === 'url' && (
                  <a href={selectedNode.id} target="_blank" rel="noreferrer" className="block text-center text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2.5 rounded-xl transition-colors">
                    Access Source Document ↗
                  </a>
                )}
              </div>
            )}

            <ForceGraph3D
              graphData={graphData}
              nodeLabel="name"
              nodeColor={node => (highlightNodes.size > 0 && !highlightNodes.has(node)) ? 'rgba(255,255,255,0.05)' : (node.color || '#9ca3af')}
              nodeRelSize={6}
              linkColor={link => highlightLinks.has(link) ? '#fff' : 'rgba(255, 255, 255, 0.1)'}
              linkWidth={link => highlightLinks.has(link) ? 2 : 1}
              linkDirectionalParticles={link => highlightLinks.has(link) ? 4 : 1}
              linkDirectionalParticleSpeed={0.01}
              linkDirectionalParticleWidth={2}
              linkLabel={link => link.label}
              onNodeClick={updateHighlight}
              onBackgroundClick={() => updateHighlight(null)}
              backgroundColor="rgba(0,0,0,0)"
            />
          </div>
        </div>
      )}
    </div>
  )
}