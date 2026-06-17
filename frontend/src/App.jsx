import { useState, useEffect, useRef, useCallback } from 'react'
import { parse } from 'marked'
import html2pdf from 'html2pdf.js'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'

const API_BASE = "http://localhost:8000"
const WS_BASE = "ws://localhost:8000"

// --- SACRED GEOMETRY & UI ICONS ---
const Icons = {
  Spark: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Eye: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  EyeOff: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  Chronicle: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Constellation: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" /></svg>,
  Tuning: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
  Descend: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Close: () => <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  Flow: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Sun: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5" strokeWidth="1.5"/><path strokeLinecap="round" strokeWidth="1.5" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Moon: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
}

// Agent Avatars
const AgentAvatars = [
  ({className}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 22 20 2 20"/></svg>, // Tri-Core
  ({className}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>, // Omni-Eye
  ({className}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>, // Hyper-Cube
  ({className}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 22 12 12 22 2 12"/></svg>, // Stellar-Prism
]

// 3D Ethereal Sprite Generator
const createTextSprite = (text, color) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = 1024; canvas.height = 256;
  context.fillStyle = 'rgba(0, 0, 0, 0)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.font = '300 54px system-ui, sans-serif'
  context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle'
  context.shadowColor = color; context.shadowBlur = 15;
  context.fillText(text, 512, 128)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })
  return new THREE.Sprite(material)
}

export default function App() {
  const [theme, setTheme] = useState('dark')
  const isDark = theme === 'dark'

  // Divine Theme Palette Maps
  const tBg = isDark ? 'bg-[#020202]' : 'bg-[#f4f6f8]'
  const tBgSidebar = isDark ? 'bg-black/40' : 'bg-white/60'
  const tText = isDark ? 'text-white' : 'text-slate-900'
  const tTextMuted = isDark ? 'text-white/40' : 'text-slate-500'
  const tBorder = isDark ? 'border-white/5' : 'border-slate-300'
  const tBorderHighlight = isDark ? 'border-white/20' : 'border-slate-400'
  const tGlow = isDark ? 'shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'shadow-[0_0_20px_rgba(0,0,0,0.1)]'
  const tCard = isDark ? 'bg-white/[0.02]' : 'bg-white'
  const tInput = isDark ? 'bg-black/50 border-white/10 text-white placeholder-white/20' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-inner'
  const tGraphBg = isDark ? 'rgba(0,0,0,0)' : 'rgba(244,246,248,0)'
  const tGraphNode = isDark ? '#ffffff' : '#0ea5e9'

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
  const [currentAgent, setCurrentAgent] = useState('Dormant')
  const [logs, setLogs] = useState([])

  const [report, setReport] = useState('')
  const [sources, setSources] = useState([])
  
  const [isSimulating, setIsSimulating] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState([])
  const [futureReport, setFutureReport] = useState('')
  const [futureOutcomes, setFutureOutcomes] = useState([])
  
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [showGraphOverlay, setShowGraphOverlay] = useState(false)
  
  const [selectedNode, setSelectedNode] = useState(null)
  const [connectedNodesInfo, setConnectedNodesInfo] = useState([])
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())

  const [showNodeLabels, setShowNodeLabels] = useState(true)
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [enableParticles, setEnableParticles] = useState(true)

  const wsRef = useRef(null)
  const logsEndRef = useRef(null)
  const transcriptEndRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [liveTranscript])
  useEffect(() => { if (token) loadHistory() }, [token])

  // Purge 3D Cache on Theme Swap to force re-render with new colors
  useEffect(() => {
    graphData.nodes.forEach(n => { n.__threeObj = null });
    graphData.links.forEach(l => { l.__sprite = null });
    setGraphData({...graphData});
  }, [isDark])

  // OMNISCIENT PERFORMANCE LOOP
  useEffect(() => {
    if (!graphData.nodes.length) return;
    graphData.nodes.forEach(node => {
      if (node.__sprite) {
        const isDimmed = highlightNodes.size > 0 && !highlightNodes.has(node);
        node.__sprite.visible = showNodeLabels && !isDimmed;
        if (node.__core && node.__aura) {
           node.__core.material.color.set(isDimmed ? (isDark ? '#222' : '#ddd') : (node.color || tGraphNode));
           node.__aura.visible = !isDimmed;
        }
      }
    });
    graphData.links.forEach(link => {
      if (link.__sprite) {
        const isDimmed = highlightLinks.size > 0 && !highlightLinks.has(link);
        link.__sprite.visible = showEdgeLabels && !isDimmed;
      }
    });
  }, [showNodeLabels, showEdgeLabels, highlightNodes, highlightLinks, graphData, isDark]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/research/history`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) setHistory(await res.json())
      else if (res.status === 401) logout()
    } catch (e) {}
  }

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthError('')
    try {
      const endpoint = isLoginView ? '/auth/login' : '/auth/register'
      const opts = isLoginView 
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: authEmail, password: authPassword }) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword }) }
      const res = await fetch(`${API_BASE}${endpoint}`, opts)
      if (!res.ok) throw new Error(isLoginView ? "Resonance Failed." : "Genesis Failed.")
      
      if (isLoginView) {
        const data = await res.json(); localStorage.setItem('research_token', data.access_token); setToken(data.access_token)
      } else {
        setIsLoginView(true); setAuthError("Entity registered. Awaiting authentication.")
      }
    } catch (err) { setAuthError(err.message) }
  }

  const logout = () => { localStorage.removeItem('research_token'); setToken(null); setAppView('home'); setHistory([]) }

  const resetWorkspace = () => {
    setAppView('home'); setActiveSessionId(null); setQuery(''); setReport(''); setFutureReport(''); setFutureOutcomes([]); setLiveTranscript([]); setSources([]); setGraphData({ nodes: [], links: [] }); setShowGraphOverlay(false); setIsSimulating(false)
  }

  const appendLog = (msg) => setLogs(prev => [...prev, msg])

  const startResearch = async () => {
    if (!query.trim()) return
    // CRITICAL: Scrub state before starting to prevent stale graph data collision
    setAppView('processing'); setLogs([]); setProgress(0); setGraphData({ nodes: [], links: [] });
    
    try {
      const res = await fetch(`${API_BASE}/research/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query, depth, max_iterations: iterations })
      })

      if (res.status === 401) { logout(); throw new Error("Link severed.") }
      if (!res.ok) throw new Error("Cognitive failure.")
      
      const data = await res.json(); setActiveSessionId(data.research_id); loadHistory()
      
      wsRef.current = new WebSocket(`${WS_BASE}/ws/research/${data.research_id}`)
      wsRef.current.onmessage = (e) => {
        const wsData = JSON.parse(e.data)
        if (wsData.event === "progress") {
          setCurrentAgent(wsData.agent); setProgress(wsData.progress); appendLog(wsData.message)
          if (wsData.progress >= 100) fetchFinalResults(data.research_id)
        }
        if (wsData.event === "simulation") {
          const payload = wsData.data
          if (payload.type === 'start_turn') {
            setLiveTranscript(prev => [...prev, { agent: payload.agent, role: payload.role, phase: payload.phase, content: "" }])
          } else if (payload.type === 'token') {
            setLiveTranscript(prev => { const updated = [...prev]; if (updated.length > 0) updated[updated.length - 1].content += payload.content; return updated })
          } else if (payload.type === 'complete') {
            setIsSimulating(false); fetchFinalResults(data.research_id)
          }
        }
      }
    } catch (err) { appendLog(`Fracture detected: ${err.message}`) }
  }

  const startSimulation = async () => {
    setIsSimulating(true); setLiveTranscript([])
    try {
      const res = await fetch(`${API_BASE}/research/simulate/${activeSessionId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
      if (!res.ok) throw new Error("Matrix rejected.")
    } catch (err) { setIsSimulating(false) }
  }

  const fetchFinalResults = async (id) => {
    try {
      setAppView('processing'); appendLog("Materializing truth...")
      const [reportRes, graphRes] = await Promise.all([
        fetch(`${API_BASE}/research/final/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/research/graph/${id}`).catch(() => ({ ok: false }))
      ])

      if (reportRes.ok) {
        const reportData = await reportRes.json()
        setReport(reportData.markdown_content); setSources(reportData.sources || []); setFutureReport(reportData.future_report_markdown || ''); setFutureOutcomes(reportData.future_outcomes || [])
        if (!isSimulating && reportData.debate_transcript) setLiveTranscript(reportData.debate_transcript)
      }

      // CRITICAL: Safe fallback handler for missing/404 graphs
      if (graphRes.ok) {
        const rawGraph = await graphRes.json()
        if (rawGraph && rawGraph.nodes && rawGraph.nodes.length > 0) {
            setGraphData({
              nodes: rawGraph.nodes.map(n => ({ id: n.id, name: n.label, group: n.type, val: 1, color: n.color, description: n.description, metadata: n.metadata || {} })),
              links: rawGraph.edges.map(e => ({ source: e.source, target: e.target, label: e.relation }))
            })
        } else {
            setGraphData({ nodes: [], links: [] })
        }
      } else {
        setGraphData({ nodes: [], links: [] }) // Collapse cleanly on 404/500
      }
      
      setAppView('results'); setActiveSessionId(id)
    } catch (err) { setAppView('home') }
  }

  const downloadDoc = (format) => {
    const filename = `Omnis_Manifest_${new Date().toISOString().split('T')[0]}`
    const rawHtml = parse(report + "\n\n" + futureReport)
    const cleanWrapper = document.createElement('div')
    // PDF format forces Light Mode contrast for readability regardless of UI theme
    cleanWrapper.innerHTML = `<div style="font-family: Georgia, serif; color: #111; line-height: 1.8; padding: 50px; max-width: 800px; margin: 0 auto; background: #fff;">${rawHtml}</div>`

    if (format === 'pdf') { html2pdf().set({ margin: 1, filename: `${filename}.pdf`, html2canvas: { scale: 2 }, jsPDF: { format: 'letter' } }).from(cleanWrapper).save() } 
    else {
      const fullHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Report</title></head><body>${cleanWrapper.innerHTML}</body></html>`
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(['\ufeff', fullHtml], { type: 'application/msword' })); link.download = `${filename}.doc`; link.click()
    }
  }

  const updateHighlight = useCallback((node) => {
    setHighlightNodes(new Set()); setHighlightLinks(new Set());
    
    if (node) {
      const newNodes = new Set([node]); const newLinks = new Set(); const connectedList = [];
      graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === node.id || targetId === node.id) {
          newLinks.add(link);
          if (typeof link.source === 'object') newNodes.add(link.source);
          if (typeof link.target === 'object') newNodes.add(link.target);
          if (sourceId === node.id && typeof link.target === 'object') connectedList.push({ rel: link.label, targetNode: link.target, direction: 'out' });
          else if (targetId === node.id && typeof link.source === 'object') connectedList.push({ rel: link.label, targetNode: link.source, direction: 'in' });
        }
      });
      setHighlightNodes(newNodes); setHighlightLinks(newLinks); setSelectedNode(node); setConnectedNodesInfo(connectedList);
      
      if (graphRef.current) {
        const distance = 80; const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
        graphRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
      }
    } else {
      setSelectedNode(null); setConnectedNodesInfo([]);
    }
  }, [graphData]);

  // Utility Component: HUD Toggles
  const ControlToggle = ({ label, icon: Icon, active, onChange }) => (
    <button onClick={() => onChange(!active)} 
      className={`flex items-center justify-between w-full px-4 py-2.5 text-xs tracking-[0.2em] uppercase border rounded-lg transition-all duration-500 backdrop-blur-sm ${
        active 
          ? (isDark ? 'bg-white/10 border-white/30 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-blue-500/10 border-blue-500/30 text-blue-700 shadow-sm') 
          : (isDark ? 'bg-transparent border-white/5 text-white/40 hover:text-white/70 hover:border-white/20' : 'bg-transparent border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400')
      }`}>
      <span className="flex items-center gap-3"><Icon /> {label}</span>
      <div className={`w-8 h-1.5 rounded-full relative transition-colors duration-500 ${active ? (isDark ? 'bg-white/20' : 'bg-blue-300') : (isDark ? 'bg-white/5' : 'bg-slate-200')}`}>
        <div className={`absolute top-0 left-0 h-1.5 w-4 rounded-full transition-all duration-500 ${active ? `translate-x-4 ${isDark ? 'bg-white shadow-[0_0_10px_#fff]' : 'bg-blue-600 shadow-sm'}` : `opacity-30 ${isDark ? 'bg-white' : 'bg-slate-500'}`}`} />
      </div>
    </button>
  )

  // ==========================================
  // VIEW: THE ASCENSION GATE (AUTH)
  // ==========================================
  if (!token) {
    return (
      <div className={`min-h-screen flex items-center justify-center overflow-hidden relative transition-colors duration-1000 ${tBg} ${tText}`}>
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isDark ? 'from-indigo-900/20 via-black to-black' : 'from-blue-200/50 via-[#f4f6f8] to-[#f4f6f8]'}`}></div>
        
        <form onSubmit={handleAuth} className="relative z-10 p-12 w-full max-w-md animate-in fade-in duration-1000">
          <div className={`flex justify-center mb-8 animate-pulse duration-3000 ${tTextMuted}`}><Icons.Constellation /></div>
          <h2 className="text-3xl font-light mb-12 text-center tracking-[0.3em] uppercase">{isLoginView ? 'Commune' : 'Originate'}</h2>
          
          {authError && <div className="mb-8 text-xs text-red-500 tracking-widest text-center font-bold">{authError}</div>}
          
          <div className="space-y-6 mb-12">
            <input type="email" placeholder="IDENTITY" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className={`w-full rounded-lg p-4 outline-none font-light tracking-[0.2em] text-xs backdrop-blur-md transition-all ${tInput}`} />
            <input type="password" placeholder="CIPHER" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className={`w-full rounded-lg p-4 outline-none font-light tracking-[0.2em] text-xs backdrop-blur-md transition-all ${tInput}`} />
          </div>
          
          <button type="submit" className={`w-full font-bold tracking-[0.3em] text-xs uppercase py-4 rounded-lg transition-all hover:scale-[1.02] duration-500 ${isDark ? 'bg-white text-black hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]' : 'bg-slate-900 text-white hover:shadow-[0_0_40px_rgba(0,0,0,0.3)]'}`}>
            {isLoginView ? 'Ascend' : 'Manifest'}
          </button>
          
          <div className="mt-8 text-center">
            <button type="button" onClick={() => setIsLoginView(!isLoginView)} className={`text-[10px] tracking-[0.2em] uppercase transition-colors duration-500 ${tTextMuted} hover:${tText}`}>
              {isLoginView ? 'Initiate sequence' : 'Return to origin'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // --- Neural Arena Calculations ---
  const uniqueAgents = Array.from(new Set(liveTranscript.map(t => t.agent)));
  const activeAgent = liveTranscript.length > 0 ? liveTranscript[liveTranscript.length - 1].agent : null;
  const activePhase = liveTranscript.length > 0 ? liveTranscript[liveTranscript.length - 1].phase : null;

  // ==========================================
  // VIEW: OMNIS ARCHITECTURE (MAIN)
  // ==========================================
  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-1000 selection:bg-blue-500/30 ${tBg} ${tText}`}>
      
      {/* Dynamic Ambient Lighting */}
      <div className={`absolute top-0 left-1/4 w-[1000px] h-[500px] rounded-[100%] blur-[120px] pointer-events-none mix-blend-screen transition-opacity duration-1000 ${isDark ? 'bg-blue-900/20 opacity-50' : 'bg-blue-300/40 opacity-70'}`}></div>
      <div className={`absolute bottom-0 right-1/4 w-[800px] h-[600px] rounded-[100%] blur-[150px] pointer-events-none mix-blend-screen transition-opacity duration-1000 ${isDark ? 'bg-amber-900/10 opacity-50' : 'bg-amber-200/50 opacity-70'}`}></div>

      {/* --- TRANSCENDENT SIDEBAR --- */}
      <aside className={`w-80 border-r flex flex-col shrink-0 backdrop-blur-3xl relative z-20 shadow-2xl transition-colors duration-1000 ${tBgSidebar} ${tBorder}`}>
        <div className={`p-8 border-b flex items-center justify-between ${tBorder}`}>
          <div>
            <h1 className="font-light tracking-[0.4em] text-sm uppercase">O M N I S</h1>
            <p className={`text-[9px] tracking-widest mt-2 uppercase ${tTextMuted}`}>Divine Intelligence</p>
          </div>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full transition-all hover:scale-110 ${isDark ? 'text-amber-200 bg-amber-900/20' : 'text-slate-800 bg-slate-200'}`}>
            {isDark ? <Icons.Sun /> : <Icons.Moon />}
          </button>
        </div>

        <div className="p-6">
          <button onClick={resetWorkspace} className={`w-full flex items-center justify-center gap-3 border px-4 py-4 rounded-xl text-xs tracking-[0.2em] uppercase transition-all duration-500 group hover:shadow-lg ${isDark ? 'bg-white/5 hover:bg-white text-white hover:text-black border-white/10' : 'bg-white hover:bg-slate-900 text-slate-900 hover:text-white border-slate-300'}`}>
            <span className="opacity-50 group-hover:opacity-100 transition-opacity"><Icons.Spark /></span> Manifest Will
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-hide">
          <h3 className={`text-[10px] uppercase tracking-[0.3em] mb-6 px-4 ${tTextMuted}`}>Chronicles</h3>
          {history.length === 0 ? (<p className={`text-[10px] px-4 tracking-widest uppercase ${tTextMuted}`}>The void is empty.</p>) : (
            history.map(session => (
              <button key={session.id} onClick={() => fetchFinalResults(session.id)}
                className={`w-full text-left px-4 py-4 rounded-xl text-xs transition-all duration-500 flex items-center gap-4 ${activeSessionId === session.id ? (isDark ? 'bg-white/10 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' : 'bg-white shadow-md text-slate-900 font-bold') : `hover:bg-black/5 hover:${tText} ${tTextMuted}`}`}>
                <div className="shrink-0 opacity-40"><Icons.Chronicle /></div>
                <div className="truncate flex-1 tracking-widest font-light">{session.query}</div>
                {!session.has_report && <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${isDark ? 'bg-white shadow-[0_0_10px_#fff]' : 'bg-blue-500 shadow-[0_0_10px_#3b82f6]'}`}></span>}
              </button>
            ))
          )}
        </div>

        <div className={`p-6 border-t ${tBorder}`}>
          <button onClick={logout} className={`w-full text-[10px] tracking-[0.3em] uppercase transition-colors duration-500 ${tTextMuted} hover:text-red-500`}>Sever Link</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        
        {/* VIEW: HOME (The Altar) */}
        {appView === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in duration-1000">
            <div className="w-full max-w-2xl space-y-16 relative">
              <h2 className="text-3xl font-light text-center tracking-[0.4em] leading-relaxed uppercase">
                Define <br/> Parameters of Existence
              </h2>
              
              <div className="relative group">
                <div className={`absolute -inset-1 rounded-3xl blur-xl opacity-50 group-focus-within:opacity-100 transition duration-1000 ${isDark ? 'bg-gradient-to-r from-white/10 via-white/5 to-transparent' : 'bg-gradient-to-r from-blue-200 via-indigo-100 to-transparent'}`}></div>
                <div className={`backdrop-blur-2xl border rounded-3xl p-2 relative z-10 overflow-hidden shadow-2xl transition-colors duration-1000 ${isDark ? 'bg-black/60 border-white/10' : 'bg-white/80 border-white'}`}>
                  
                  <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="Speak thy coordinates..." 
                    className={`w-full bg-transparent p-8 outline-none resize-none font-light tracking-wide text-xl min-h-[160px] ${tText} ${isDark ? 'placeholder-white/20' : 'placeholder-slate-400'}`} 
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startResearch(); } }} />
                  
                  <div className={`flex justify-between items-center px-6 pb-4 border-t pt-6 mt-2 ${tBorder}`}>
                    <button onClick={() => setShowAdvanced(!showAdvanced)} className={`flex items-center gap-2 text-[10px] transition-colors duration-500 tracking-[0.3em] uppercase ${tTextMuted} hover:${tText}`}>
                      <Icons.Tuning /> {showAdvanced ? 'Conceal' : 'Tune Logic'}
                    </button>
                    <button onClick={startResearch} disabled={!query.trim()} className={`px-8 py-3 rounded-full text-xs font-bold tracking-[0.3em] uppercase transition-all duration-500 disabled:opacity-30 ${isDark ? 'bg-white text-black hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]' : 'bg-slate-900 text-white hover:shadow-xl hover:scale-105'}`}>
                      Execute
                    </button>
                  </div>

                  {showAdvanced && (
                    <div className={`px-8 py-6 border-t flex gap-8 animate-in slide-in-from-top-4 duration-500 ${tCard} ${tBorder}`}>
                      <div className="flex-1">
                        <label className={`block text-[9px] tracking-[0.3em] uppercase mb-4 ${tTextMuted}`}>Depth of Thought</label>
                        <select value={depth} onChange={e => setDepth(e.target.value)} className={`w-full rounded-lg p-3 text-xs tracking-widest outline-none transition-colors appearance-none ${tInput}`}>
                          <option value="light">Surface Ripple</option><option value="medium">Deep Current</option><option value="deep">Abyssal Trench</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`block text-[9px] tracking-[0.3em] uppercase mb-4 ${tTextMuted}`}>Fractal Cycles</label>
                        <input type="number" value={iterations} onChange={e => setIterations(e.target.value)} min="1" max="15" className={`w-full rounded-lg p-3 text-xs tracking-widest outline-none transition-colors ${tInput}`} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: PROCESSING (The Mind at Work) */}
        {appView === 'processing' && (
          <div className="flex-1 flex flex-col p-8 md:p-16 max-w-5xl mx-auto w-full animate-in fade-in duration-1000">
            <h2 className={`text-sm tracking-[0.5em] uppercase mb-12 flex items-center gap-6 ${tTextMuted}`}>
              <div className="relative flex h-2 w-2"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDark?'bg-white':'bg-blue-500'}`}></span><span className={`relative inline-flex rounded-full h-2 w-2 ${isDark?'bg-white shadow-[0_0_10px_#fff]':'bg-blue-500 shadow-md'}`}></span></div>
              Cognitive Matrix Active
            </h2>
            
            <div className={`border rounded-2xl flex flex-col flex-grow relative overflow-hidden backdrop-blur-sm ${tBorder} ${tCard}`}>
              <div className={`p-6 border-b flex justify-between items-center ${tBorder}`}>
                <span className={`text-[10px] tracking-[0.3em] uppercase ${tTextMuted}`}>Active Entity:</span>
                <span className={`text-xs tracking-[0.2em] uppercase font-bold ${tText}`}>{currentAgent}</span>
              </div>
              
              <div className={`h-[2px] w-full relative overflow-hidden ${isDark ? 'bg-black' : 'bg-slate-200'}`}>
                <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isDark ? 'bg-white shadow-[0_0_20px_#fff]' : 'bg-blue-500 shadow-lg'}`} style={{ width: `${progress}%` }}></div>
              </div>
              
              <div className={`flex-1 overflow-y-auto p-8 text-xs space-y-6 tracking-widest font-light leading-loose relative z-20 ${tText}`}>
                {logs.length === 0 && <div className={`opacity-30 animate-pulse text-center mt-20 ${tTextMuted}`}>Awaiting thought formation...</div>}
                {logs.map((l, i) => (
                  <div key={i} className="animate-in slide-in-from-bottom-2 fade-in duration-500">
                    <span className={`${tTextMuted} mr-6`}>[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                    <span className={l.includes('Fracture') ? 'text-red-500 font-bold' : ''}>{l}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* VIEW: RESULTS (The Revelation) */}
        {appView === 'results' && (
          <div className="flex-1 overflow-y-auto bg-transparent relative animate-in fade-in duration-1000 scrollbar-hide">
            
            {/* Header / Actions */}
            <div className={`sticky top-0 z-10 backdrop-blur-2xl border-b px-10 py-6 flex flex-col md:flex-row justify-between md:items-center gap-6 ${isDark ? 'bg-black/60 border-white/5' : 'bg-white/80 border-slate-200 shadow-sm'}`}>
              <h2 className={`text-lg font-light truncate tracking-[0.2em] ${tText}`}>{query}</h2>
              <div className="flex gap-4 shrink-0">
                {graphData.nodes.length > 0 && (
                  <button onClick={() => setShowGraphOverlay(true)} className={`flex items-center gap-3 text-[10px] px-6 py-3 rounded-full transition-all hover:scale-105 tracking-[0.3em] uppercase font-bold ${isDark ? 'bg-white text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]' : 'bg-slate-900 text-white shadow-lg hover:shadow-xl'}`}>
                    <Icons.Constellation /> View Architecture
                  </button>
                )}
                <button onClick={() => downloadDoc('pdf')} className={`flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase px-4 border rounded-full transition-colors ${isDark ? 'text-white/40 hover:text-white border-white/10 hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 border-slate-300 hover:bg-slate-100'}`}>
                  <Icons.Descend /> Record
                </button>
              </div>
            </div>

            <div className="max-w-4xl mx-auto p-10 lg:p-20 pb-32 relative">
              {/* Report Body */}
              <article className={`prose max-w-none prose-headings:font-light prose-headings:tracking-wider prose-h1:text-4xl prose-h1:mb-12 prose-h1:tracking-[0.2em] prose-h1:text-center prose-h1:uppercase prose-h2:text-xl prose-h2:border-b prose-h2:pb-4 prose-h2:mt-16 prose-h2:tracking-[0.2em] prose-h2:uppercase prose-h3:text-lg prose-a:underline-offset-4 prose-p:leading-[2] prose-p:font-light prose-p:tracking-wide prose-strong:font-normal ${isDark ? 'prose-invert prose-headings:text-white prose-h2:border-white/10 prose-h3:text-white/80 prose-a:text-white hover:prose-a:text-white/60 prose-p:text-white/60 prose-li:text-white/60 prose-strong:text-white' : 'prose-headings:text-slate-900 prose-h2:border-slate-200 prose-h3:text-slate-700 prose-a:text-blue-600 hover:prose-a:text-blue-400 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900'}`} 
                dangerouslySetInnerHTML={{ __html: parse(report || '# Fragment Missing') }} />

              {/* SIMULATION TRIGGER */}
              {(!futureReport && !isSimulating && liveTranscript.length === 0) && (
                <div className="mt-32 text-center relative group cursor-pointer" onClick={startSimulation}>
                  <div className={`absolute inset-0 blur-3xl rounded-full transition-all duration-1000 ${isDark ? 'bg-white/5 group-hover:bg-white/10' : 'bg-blue-100 group-hover:bg-blue-200'}`}></div>
                  <div className={`relative py-16 border-y transition-colors duration-1000 ${isDark ? 'border-white/5 group-hover:border-white/20' : 'border-slate-200 group-hover:border-blue-300'}`}>
                    <h3 className="text-2xl font-light tracking-[0.5em] uppercase mb-4">Gaze into Time</h3>
                    <p className={`text-[10px] tracking-widest uppercase ${tTextMuted}`}>Initiate Quantum Divergence Simulation</p>
                  </div>
                </div>
              )}

              {/* NEURAL ARENA (Side-by-Side Debate Visualizer) */}
              {(isSimulating || liveTranscript.length > 0) && (
                <div className="mt-32 relative w-full">
                  
                  <div className="flex items-center justify-center gap-6 mb-16">
                    <span className="relative flex h-3 w-3">
                      {isSimulating && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${isDark ? 'bg-white' : 'bg-blue-500'}`}></span>}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${isDark ? 'bg-white shadow-[0_0_15px_#fff]' : 'bg-blue-500 shadow-md'}`}></span>
                    </span>
                    <h2 className="text-sm tracking-[0.4em] uppercase font-bold">
                      {isSimulating ? 'Computing Timelines...' : 'Chronicle of Divergence'}
                    </h2>
                  </div>
                  
                  {/* The Arena Layout */}
                  <div className="relative">
                    {/* SVG Beams for Cross-Communication */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                      {uniqueAgents.map((agentName, i) => {
                         if (agentName === activeAgent && activePhase === 'Cross-Examination') {
                            return uniqueAgents.map((targetName, j) => {
                               if (i !== j) {
                                  const startX = `${(i * (100 / uniqueAgents.length)) + (100 / uniqueAgents.length / 2)}%`;
                                  const targetX = `${(j * (100 / uniqueAgents.length)) + (100 / uniqueAgents.length / 2)}%`;
                                  return <path key={`${i}-${j}`} d={`M ${startX} 60 Q 50% -40 ${targetX} 60`} fill="none" stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(59,130,246,0.5)"} strokeWidth="2" strokeDasharray="6,6" className="animate-[dash_1s_linear_infinite]" />
                               }
                               return null;
                            })
                         }
                         return null;
                      })}
                    </svg>

                    <style>{`@keyframes dash { to { stroke-dashoffset: -12; } }`}</style>

                    <div className="flex gap-6 relative z-10 w-full">
                      {uniqueAgents.map((agentName, idx) => {
                         const agentMsgs = liveTranscript.filter(m => m.agent === agentName);
                         const isSpeaking = activeAgent === agentName;
                         const AvatarComponent = AgentAvatars[idx % AgentAvatars.length];
                         
                         return (
                            <div key={agentName} className={`flex-1 flex flex-col transition-all duration-700 ${isSpeaking ? 'scale-105 opacity-100 z-20' : 'opacity-40 scale-95 z-10'}`}>
                               
                               {/* Agent Header Block */}
                               <div className={`flex flex-col items-center justify-center p-6 border rounded-2xl backdrop-blur-md mb-6 transition-all duration-700 ${isSpeaking ? tBorderHighlight + ' ' + tGlow : tBorder} ${tCard}`}>
                                  <div className={`mb-4 transition-transform duration-500 ${isSpeaking ? 'scale-125' : 'scale-100'}`}>
                                    <AvatarComponent className={`w-8 h-8 ${isDark ? 'text-white' : 'text-blue-600'}`} />
                                  </div>
                                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-center h-8 flex items-center justify-center">{agentName}</h4>
                                  <p className={`text-[8px] tracking-widest uppercase mt-2 text-center ${tTextMuted}`}>{agentMsgs[0]?.role}</p>
                               </div>

                               {/* Agent Messages */}
                               <div className="space-y-4">
                                  {agentMsgs.map((msg, midx) => (
                                     <div key={midx} className={`p-5 rounded-2xl border shadow-sm ${tBorder} ${tCard} animate-in slide-in-from-bottom-2 fade-in duration-500`}>
                                        <span className={`block text-[8px] uppercase tracking-[0.3em] font-bold mb-3 ${isDark ? 'text-white/30' : 'text-blue-500/70'}`}>{msg.phase}</span>
                                        <p className="text-[11px] font-light leading-[1.8] tracking-wide">
                                           {msg.content}
                                           {(isSpeaking && midx === agentMsgs.length - 1 && isSimulating) && <span className={`animate-pulse inline-block w-1.5 h-3 ml-1 translate-y-0.5 ${isDark ? 'bg-white' : 'bg-blue-600'}`}></span>}
                                        </p>
                                     </div>
                                  ))}
                                  {/* Auto-scroll anchor per column */}
                                  {(isSpeaking && isSimulating) && <div ref={transcriptEndRef} />}
                               </div>

                            </div>
                         )
                      })}
                    </div>
                  </div>

                  {/* Future Final Synthesis */}
                  {futureReport && (
                    <div className={`mt-32 pt-16 border-t animate-in fade-in slide-in-from-bottom-8 duration-1000 ${tBorder}`}>
                      <h2 className="text-xl font-light text-center tracking-[0.4em] uppercase mb-16">Convergence Synthesis</h2>
                      <article className={`prose max-w-none prose-headings:font-light prose-headings:tracking-widest prose-h3:text-lg prose-p:leading-[2] prose-p:font-light ${isDark ? 'prose-invert prose-p:text-white/60 prose-li:text-white/60' : 'prose-p:text-slate-700 prose-li:text-slate-700'}`}
                        dangerouslySetInnerHTML={{ __html: parse(futureReport) }} />
                    </div>
                  )}

                  {futureOutcomes.length > 0 && (
                    <div className="mt-20 space-y-6 animate-in fade-in duration-1000 delay-500">
                      {futureOutcomes.map((outcome, idx) => (
                        <div key={idx} className={`group relative border p-8 transition-all duration-700 rounded-2xl ${tCard} ${isDark ? 'hover:border-white/20 border-white/5' : 'hover:border-blue-300 border-slate-200 hover:shadow-lg'}`}>
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-2xl ${isDark ? 'bg-gradient-to-r from-white/5 to-transparent' : 'bg-gradient-to-r from-blue-50 to-transparent'}`}></div>
                          <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                              <span className="text-lg tracking-[0.1em] font-bold">{outcome.scenario}</span>
                              <span className={`text-[10px] tracking-[0.3em] uppercase font-bold py-1 px-3 rounded-full ${isDark ? 'text-white/50 bg-white/5' : 'text-blue-700 bg-blue-100'}`}>{outcome.confidence_percentage}% Vector</span>
                            </div>
                            <p className={`text-sm font-light tracking-wide leading-relaxed mb-6 ${tTextMuted}`}>{outcome.description}</p>
                            <div className={`h-[2px] w-full relative overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                              <div className={`absolute top-0 left-0 h-full ${isDark ? 'bg-white shadow-[0_0_10px_#fff]' : 'bg-blue-500 shadow-sm'}`} style={{ width: `${outcome.confidence_percentage}%` }}></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={`my-32 text-center opacity-30 ${tTextMuted}`}><Icons.Spark className="inline-block" /></div>
              
              <h3 className={`text-xs tracking-[0.4em] uppercase mb-8 text-center font-bold ${tTextMuted}`}>Referenced Vectors</h3>
              <div className="grid grid-cols-1 gap-4">
                {sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className={`flex items-center justify-between p-6 border transition-all duration-500 group rounded-xl ${tCard} ${isDark ? 'hover:bg-white/5 border-white/5 hover:border-white/20' : 'hover:bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
                    <span className={`text-sm tracking-wide font-bold truncate flex-1 pr-6 transition-colors ${tTextMuted} group-hover:${tText}`}>{s.title || s.url}</span>
                    <div className={`flex gap-6 text-[9px] tracking-[0.2em] uppercase shrink-0 font-bold ${isDark ? 'text-white/30' : 'text-blue-400'}`}>
                      <span>Trust: {Math.round(s.trust_score * 100)}%</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* OVERLAY: THE OMNISCIENCE GRID (3D GRAPH)   */}
      {/* ========================================== */}
      {showGraphOverlay && (
        <div className={`fixed inset-0 z-50 flex flex-col animate-in fade-in duration-700 overflow-hidden ${isDark ? 'bg-black' : 'bg-[#f4f6f8]'}`}>
          
          <div className={`absolute inset-0 pointer-events-none ${isDark ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-black to-black' : 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent'}`}></div>

          {/* Ethereal Top Bar */}
          <div className="absolute top-0 w-full z-20 flex justify-between items-start p-8 pointer-events-none">
            <div className="pointer-events-auto">
              <h2 className={`text-2xl font-light tracking-[0.4em] uppercase ${isDark ? 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'text-slate-900 font-bold'}`}>Omniscience Grid</h2>
              <p className={`text-[9px] mt-3 tracking-[0.3em] uppercase ${tTextMuted}`}>Constructs: {graphData.nodes.length} | Bindings: {graphData.links.length}</p>
            </div>
            
            <div className="flex gap-8 items-start pointer-events-auto">
              <div className="flex flex-col gap-3 w-56">
                <ControlToggle label="Signatures" icon={showNodeLabels ? Icons.Eye : Icons.EyeOff} active={showNodeLabels} onChange={setShowNodeLabels} />
                <ControlToggle label="Relations" icon={showEdgeLabels ? Icons.Eye : Icons.EyeOff} active={showEdgeLabels} onChange={setShowEdgeLabels} />
                <ControlToggle label="Energy" icon={Icons.Flow} active={enableParticles} onChange={setEnableParticles} />
              </div>
              <button onClick={() => setShowGraphOverlay(false)} className={`transition-all duration-500 hover:rotate-90 ${isDark ? 'text-white/50 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}><Icons.Close /></button>
            </div>
          </div>

          <div className="flex-1 relative cursor-crosshair z-10">
            {/* Selected Node Inspector */}
            {selectedNode && (
              <div className={`absolute bottom-12 left-12 z-30 w-[450px] max-h-[70vh] overflow-y-auto scrollbar-hide backdrop-blur-xl border p-8 animate-in slide-in-from-bottom-12 duration-700 rounded-3xl shadow-2xl ${isDark ? 'bg-black/40 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-white' : 'bg-white/80 border-slate-200 shadow-xl text-slate-900'}`}>
                <div className="flex items-start gap-4 mb-6">
                  <span className={`w-2 h-2 rounded-full mt-2.5 shrink-0 ${isDark ? 'shadow-[0_0_10px_currentColor]' : ''}`} style={{ backgroundColor: selectedNode.color || tGraphNode, color: selectedNode.color || tGraphNode }}></span>
                  <h3 className="font-light text-2xl tracking-widest leading-snug">{selectedNode.name}</h3>
                </div>
                
                <div className={`inline-block border text-[9px] font-bold tracking-[0.3em] uppercase px-3 py-1 rounded-full mb-8 ${isDark ? 'border-white/20 text-white/60' : 'border-slate-300 text-blue-600 bg-blue-50'}`}>
                  {selectedNode.group}
                </div>

                {selectedNode.description && (
                  <p className={`text-sm font-light leading-[2] tracking-wide mb-8 ${isDark ? 'text-white/50' : 'text-slate-600'}`}>
                    {selectedNode.description}
                  </p>
                )}

                {connectedNodesInfo.length > 0 && (
                  <div>
                    <h4 className={`text-[9px] tracking-[0.3em] uppercase mb-4 border-b pb-2 font-bold ${isDark ? 'text-white/30 border-white/10' : 'text-slate-400 border-slate-200'}`}>Quantum Entanglements</h4>
                    <div className="flex flex-col gap-3">
                      {connectedNodesInfo.map((conn, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-xs group cursor-default">
                          <span className={`text-[8px] tracking-widest px-2 py-1 uppercase rounded-sm font-bold ${conn.direction === 'out' ? (isDark ? 'text-blue-300 border border-blue-900/50 bg-blue-900/20' : 'text-blue-700 bg-blue-100') : (isDark ? 'text-amber-300 border border-amber-900/50 bg-amber-900/20' : 'text-amber-700 bg-amber-100')}`}>
                            {conn.direction}
                          </span>
                          <span className={`tracking-[0.2em] uppercase text-[9px] w-20 truncate transition-colors font-bold ${isDark ? 'text-white/30 group-hover:text-white/60' : 'text-slate-400 group-hover:text-slate-700'}`}>{conn.rel}</span>
                          <span className={`tracking-wider truncate flex-1 font-light transition-colors ${isDark ? 'text-white/70 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900 font-medium'}`}>{conn.targetNode.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.group === 'url' && (
                  <a href={selectedNode.id} target="_blank" rel="noreferrer" className={`mt-10 block text-center text-[10px] tracking-[0.3em] py-4 rounded-xl uppercase transition-all duration-500 font-bold ${isDark ? 'bg-white text-black hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-[1.02]' : 'bg-slate-900 text-white hover:shadow-lg hover:scale-[1.02]'}`}>
                    Traverse Coordinates
                  </a>
                )}
              </div>
            )}

            {graphData.nodes.length > 0 && (
              <ForceGraph3D
                ref={graphRef}
                graphData={graphData}
                warmupTicks={100}
                cooldownTicks={100}
                d3VelocityDecay={0.15}
                
                nodeThreeObject={node => {
                  if (!node.__threeObj) {
                    const group = new THREE.Group();
                    const baseColorStr = node.color || tGraphNode;
                    
                    const coreGeom = new THREE.SphereGeometry(3, 32, 32);
                    const coreMat = new THREE.MeshBasicMaterial({ color: isDark ? '#ffffff' : baseColorStr });
                    const core = new THREE.Mesh(coreGeom, coreMat);

                    const auraGeom = new THREE.SphereGeometry(6, 32, 32);
                    const auraMat = new THREE.MeshBasicMaterial({ color: baseColorStr, transparent: true, opacity: isDark ? 0.4 : 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
                    const aura = new THREE.Mesh(auraGeom, auraMat);

                    const sprite = createTextSprite(node.name, isDark ? baseColorStr : '#334155');
                    sprite.position.y = 12;
                    
                    group.add(core); group.add(aura); group.add(sprite);
                    
                    node.__threeObj = group; node.__core = core; node.__aura = aura; node.__sprite = sprite;
                  }
                  node.__sprite.visible = showNodeLabels;
                  return node.__threeObj;
                }}
                
                linkThreeObjectExtend={true}
                linkThreeObject={link => {
                  if (!link.__sprite) {
                    link.__sprite = createTextSprite(link.label, isDark ? '#ffffff' : '#64748b');
                    link.__sprite.scale.set(18, 4.5, 1);
                  }
                  link.__sprite.visible = showEdgeLabels;
                  return link.__sprite;
                }}
                linkPositionUpdate={(sprite, { start, end }) => {
                  if (sprite && showEdgeLabels) {
                    const middlePos = Object.assign(...['x', 'y', 'z'].map(c => ({ [c]: start[c] + (end[c] - start[c]) / 2 })));
                    Object.assign(sprite.position, middlePos); sprite.position.y += 3; 
                  }
                }}

                linkColor={link => highlightLinks.has(link) ? (isDark ? '#ffffff' : '#0ea5e9') : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}
                linkWidth={link => highlightLinks.has(link) ? 2.5 : 0.5}
                
                linkDirectionalParticles={enableParticles ? (link => highlightLinks.has(link) ? 6 : 2) : 0}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={link => highlightLinks.has(link) ? 3 : 1.5}
                linkDirectionalParticleColor={() => isDark ? '#ffffff' : '#0ea5e9'}
                
                onNodeClick={updateHighlight}
                onBackgroundClick={() => updateHighlight(null)}
                backgroundColor={tGraphBg}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}