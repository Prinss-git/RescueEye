import { useState, useRef, useEffect } from 'react'
import { Play, Square, Upload, CircleCheck } from 'lucide-react'
import DetectionLog, { Detection } from '../components/DetectionLog'

const API          = '/api'
const STREAM_URL_3 = `${API}/stream/feed3`
const DETECT_URL   = `${API}/detect`
const STATUS_URL   = `${API}/stream/status`
const MODELS_URL   = `${API}/models/status`

const MAX_LOG_ENTRIES     = 50
const DETECT_INTERVAL_MS  = 400
const CLASSIFY_INTERVAL_MS = 2500
const STATUS_POLL_MS      = 3000
const MODEL_POLL_MS       = 10000
const BOX_FADE_MS         = 8000

const DAMAGE_COLOR: Record<string, string> = {
  flood_damage:      '#0e7490',
  fire_damage:       '#ea580c',
  structural_damage: '#f97316',
}
const DAMAGE_DISPLAY: Record<string, string> = {
  flood_damage:      'Flood Damage',
  fire_damage:       'Fire Damage',
  structural_damage: 'Structural Damage',
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  MODERATE: '#d97706',
  MINOR:    '#ca8a04',
}

const DRONE_BRANDS = [
  { name: 'DJI Mavic / Mini / Air', url: 'rtsp://192.168.1.1:554/live',      hint: 'WiFi AP mode' },
  { name: 'DJI via RC Pro',         url: 'rtsp://192.168.1.1:8554/live',     hint: 'RC Pro / Goggles 3' },
  { name: 'DJI Phantom 4',          url: 'rtsp://192.168.10.1:554/live',     hint: 'Phantom 4 series' },
  { name: 'Parrot Anafi / USA',     url: 'rtsp://192.168.42.1/live',         hint: 'Anafi default AP' },
  { name: 'Autel EVO II',           url: 'rtsp://192.168.1.1:8554/stream0',  hint: 'EVO II series' },
  { name: 'Skydio 2 / X10',        url: 'rtsp://192.168.1.1:8080/video',    hint: 'Skydio Beacon mode' },
  { name: 'FPV / PX4 Companion',   url: 'udp://@0.0.0.0:5600',             hint: 'MAVLink UDP stream' },
  { name: 'ONVIF IP Camera',        url: 'rtsp://192.168.1.100:554/stream1', hint: 'Generic ONVIF device' },
  { name: 'Custom / Manual',        url: '',                                  hint: 'Enter URL below manually' },
]

type FeedStatus = 'ACTIVE' | 'CONNECTING' | 'OFFLINE'

interface DetectResponse {
  detections: Array<{
    id:         string
    class:      string
    confidence: number
    track_id?:  number
    bbox:       { x: number; y: number; w: number; h: number }
    timestamp:  string
  }>
  inference_time_ms: number
  frame_id:          string
  model_version:     string
  annotated_frame?:  string
  mode?:             'visual' | 'thermal'
  brightness?:       number
}

interface ModelInfo {
  version:   string
  weights:   string
  loaded:    boolean
  is_custom: boolean
  map50?:    number
  accuracy?: number
}

interface ModelsStatus {
  victim_model: ModelInfo
  damage_model: ModelInfo
}

const CLASS_COLOR: Record<string, string> = {
  person:             '#dc2626',
  life_sign:          '#ca8a04',
  fire_damage:        '#ea580c',
  flood_damage:       '#0e7490',
  structural_damage:  '#f97316',
}

// Display label overrides shown on canvas
const CANVAS_LABEL: Record<string, string> = {
  person:    'CASUALTY',
  life_sign: 'CASUALTY·THERMAL',
}

export default function Dashboard() {
  const [feedStatus, setFeedStatus]     = useState<FeedStatus>('CONNECTING')
  const [detections, setDetections]     = useState<Detection[]>([])
  const [inferenceMs, setInferenceMs]   = useState<number | null>(null)
  const [detecting, setDetecting]       = useState(false)
  const [elapsedSec, setElapsedSec]     = useState(0)
  const [streamSource, setStreamSource] = useState('—')
  const [totalFrames, setTotalFrames]   = useState(0)
  const [modelsStatus, setModelsStatus] = useState<ModelsStatus | null>(null)
  const [canvasFlash, setCanvasFlash]   = useState(false)
  const [detectMode, setDetectMode]     = useState<'visual' | 'thermal'>('visual')
  const [forceMode, setForceMode]       = useState<'auto' | 'visual' | 'thermal'>('auto')
  const [brightness, setBrightness]     = useState<number | null>(null)
  const [latestFrame, setLatestFrame]   = useState<string | null>(null)

  const [damageLabel,   setDamageLabel]   = useState<{ label: string; confidence: number; severity?: string; suggested_action?: string } | null>(null)
  const [selectedDrone, setSelectedDrone] = useState('')
  const [sourceInput,   setSourceInput]   = useState('')
  const [sourceSetting, setSourceSetting] = useState(false)
  const [sourceMode,    setSourceMode]    = useState<'live' | 'upload'>('live')
  const [uploadStatus,  setUploadStatus]  = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadedName,  setUploadedName]  = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imgRef            = useRef<HTMLImageElement>(null)
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const hiddenCanvas      = useRef<HTMLCanvasElement>(null)
  const classifyCanvas    = useRef<HTMLCanvasElement>(null)
  const forceModeRef      = useRef<'auto' | 'visual' | 'thermal'>('auto')
  const detectingRef      = useRef(false)
  const lastDamageLabelRef = useRef<string | null>(null)

  type RawDet = DetectResponse['detections'][0]
  type TrackedDet = RawDet & { vx: number; vy: number }
  type OverlayState = { dets: TrackedDet[]; imgW: number; imgH: number; ts: number } | null
  const overlayRef      = useRef<OverlayState>(null)
  type TrackEntry = { bbox: RawDet['bbox']; ts: number }
  const trackHistoryRef = useRef<Map<number, TrackEntry>>(new Map())
  const detectRunning   = useRef(false)   // prevents overlapping detect requests

  useEffect(() => { forceModeRef.current = forceMode }, [forceMode])

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Model status poller
  useEffect(() => {
    async function poll() {
      try { const r = await fetch(MODELS_URL); if (r.ok) setModelsStatus(await r.json()) } catch {}
    }
    poll(); const t = setInterval(poll, MODEL_POLL_MS); return () => clearInterval(t)
  }, [])

  // Stream status poller
  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch(STATUS_URL)
        if (!r.ok) throw new Error()
        const d = await r.json()
        setFeedStatus(d.active ? 'ACTIVE' : 'OFFLINE')
        setStreamSource(d.source ?? '—')
      } catch { setFeedStatus('OFFLINE') }
    }
    poll(); const t = setInterval(poll, STATUS_POLL_MS); return () => clearInterval(t)
  }, [])

  // rAF canvas overlay
  useEffect(() => {
    let rafId: number
    function loop() {
      const canvas = canvasRef.current
      const img    = imgRef.current
      if (canvas && img) {
        const W = img.clientWidth  || 640
        const H = img.clientHeight || 480
        if (canvas.width !== W)  canvas.width  = W
        if (canvas.height !== H) canvas.height = H
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, W, H)
          const state = overlayRef.current
          if (state && state.dets.length > 0) {
            const age   = Date.now() - state.ts
            const alpha = Math.max(0, 1 - age / BOX_FADE_MS)
            if (alpha <= 0) { overlayRef.current = null }
            else {
              const scale   = Math.min(W / state.imgW, H / state.imgH)
              const offsetX = (W - state.imgW * scale) / 2
              const offsetY = (H - state.imgH * scale) / 2
              ctx.save()
              ctx.globalAlpha = alpha
              ctx.translate(offsetX, offsetY)
              ctx.scale(scale, scale)
              for (const d of state.dets) {
                const maxV  = state.imgW * 0.15 / 1000
                const vx    = Math.abs(d.vx) > maxV ? 0 : d.vx
                const vy    = Math.abs(d.vy) > maxV ? 0 : d.vy
                const drift = Math.min(age, 800)
                const x = Math.max(0, Math.min(state.imgW - d.bbox.w, d.bbox.x + vx * drift))
                const y = Math.max(0, Math.min(state.imgH - d.bbox.h, d.bbox.y + vy * drift))
                const { w, h } = d.bbox
                const color = CLASS_COLOR[d.class] ?? '#ffffff'
                const conf  = Math.round(d.confidence * 100)
                const label = `${CANVAS_LABEL[d.class] ?? d.class.toUpperCase()} ${conf}%`
                ctx.strokeStyle = color
                ctx.lineWidth   = 2 / scale
                ctx.strokeRect(x, y, w, h)
                const cs = 10 / scale
                ctx.lineWidth = 3 / scale
                ;[[x,y,cs,0,0,cs],[x+w,y,-cs,0,0,cs],[x,y+h,cs,0,0,-cs],[x+w,y+h,-cs,0,0,-cs]].forEach(([ox,oy,dx1,dy1,dx2,dy2]) => {
                  ctx.beginPath(); ctx.moveTo(ox+dx1,oy+dy1); ctx.lineTo(ox,oy); ctx.lineTo(ox+dx2,oy+dy2); ctx.stroke()
                })
                ctx.font = `bold ${11/scale}px "JetBrains Mono", monospace`
                const tw = ctx.measureText(label).width
                const lx = x; const ly = y > 18/scale ? y - 18/scale : y + h + 2/scale
                ctx.fillStyle = color
                ctx.beginPath(); ctx.roundRect(lx, ly, tw + 8/scale, 16/scale, 3/scale); ctx.fill()
                ctx.fillStyle = '#ffffff'; ctx.fillText(label, lx + 4/scale, ly + 12/scale)
              }
              ctx.restore()
            }
          }
        }
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Detection polling loop
  useEffect(() => {
    detectingRef.current = detecting
    if (!detecting) return

    async function runDetect() {
      if (!detectingRef.current || detectRunning.current) return
      detectRunning.current = true
      const img    = imgRef.current
      const canvas = hiddenCanvas.current
      if (!img || !canvas || !img.naturalWidth) { detectRunning.current = false; return }
      try {
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) { detectRunning.current = false; return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const b64 = canvas.toDataURL('image/jpeg', 0.85)

        const res = await fetch(DETECT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame:      b64,
            force_mode: forceModeRef.current === 'auto' ? null : forceModeRef.current,
          }),
        })
        if (!res.ok || !detectingRef.current) { detectRunning.current = false; return }
        const data: DetectResponse = await res.json()

        const now = Date.now()
        const tracked: TrackedDet[] = data.detections.map((d) => {
          const tid  = d.track_id ?? -1
          const prev = trackHistoryRef.current.get(tid)
          let vx = 0, vy = 0
          if (prev && tid >= 0) {
            const dt = now - prev.ts
            if (dt > 0) {
              vx = (d.bbox.x + d.bbox.w / 2 - (prev.bbox.x + prev.bbox.w / 2)) / dt
              vy = (d.bbox.y + d.bbox.h / 2 - (prev.bbox.y + prev.bbox.h / 2)) / dt
            }
          }
          trackHistoryRef.current.set(tid, { bbox: d.bbox, ts: now })
          return { ...d, vx, vy }
        })
        // Only update overlay when we have detections — preserves last known position between frames
        if (tracked.length > 0) {
          overlayRef.current = { dets: tracked, imgW: img.naturalWidth, imgH: img.naturalHeight, ts: now }
        }

        setInferenceMs(data.inference_time_ms)
        setTotalFrames((n) => n + 1)
        if (data.mode)               setDetectMode(data.mode)
        if (data.brightness != null) setBrightness(data.brightness)

        if (data.detections.length > 0) {
          if (data.annotated_frame) setLatestFrame(data.annotated_frame)
          setCanvasFlash(true); setTimeout(() => setCanvasFlash(false), 300)
          const entries: Detection[] = data.detections.map((d) => ({
            id:         d.id,
            class:      d.class,
            confidence: d.confidence,
            bbox:       [d.bbox.x, d.bbox.y, d.bbox.w, d.bbox.h] as [number,number,number,number],
            timestamp:  new Date(d.timestamp).toLocaleTimeString('en-PH', { hour12: false }),
            feed:       'FEED 3',
          }))
          setDetections((prev) => {
            const next = prev.concat(entries)
            return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next
          })
        }
      } catch { /* API offline */ }
      finally { detectRunning.current = false }
    }

    const t = setInterval(runDetect, DETECT_INTERVAL_MS)
    runDetect()
    return () => { clearInterval(t); detectingRef.current = false }
  }, [detecting])

  // Damage classification loop — runs every 2.5s while scanning
  useEffect(() => {
    if (!detecting) { setDamageLabel(null); lastDamageLabelRef.current = null; return }

    async function runClassify() {
      const img    = imgRef.current
      const canvas = classifyCanvas.current
      if (!img || !canvas || !img.naturalWidth) return
      try {
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const b64 = canvas.toDataURL('image/jpeg', 0.80)
        const res = await fetch(`${API}/classify`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: b64 }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.label && data.label !== 'no_damage' && data.confidence > 0.40) {
          setDamageLabel({ label: data.label, confidence: data.confidence, severity: data.severity, suggested_action: data.suggested_action })
          if (data.label !== lastDamageLabelRef.current) {
            lastDamageLabelRef.current = data.label
            const dmgEntry: Detection = {
              id:         `dmg-${Date.now()}`,
              class:      data.label,
              confidence: data.confidence,
              bbox:       [0, 0, 0, 0],
              timestamp:  new Date().toLocaleTimeString('en-PH', { hour12: false }),
              feed:       'FEED 3',
            }
            setDetections((prev) => {
              const next = prev.concat(dmgEntry)
              return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next
            })
          }
        } else {
          setDamageLabel(null)
          lastDamageLabelRef.current = null
        }
      } catch { /* classify offline */ }
    }

    const t = setInterval(runClassify, CLASSIFY_INTERVAL_MS)
    runClassify()
    return () => clearInterval(t)
  }, [detecting])

  async function applyDroneSource(source: string) {
    setSourceSetting(true)
    try {
      await fetch(`${API}/stream/source`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
    } catch { /* non-fatal */ }
    setSourceSetting(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')
    setUploadedName(file.name)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API}/stream/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      setUploadStatus('done')
    } catch {
      setUploadStatus('error')
    }
    // reset file input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const feedColor =
    feedStatus === 'ACTIVE'     ? '#16a34a' :
    feedStatus === 'CONNECTING' ? '#d97706' : '#dc2626'

  const latColor =
    inferenceMs == null ? '#94a3b8' :
    inferenceMs > 2000  ? '#dc2626' :
    inferenceMs > 500   ? '#d97706' : '#16a34a'

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg">

      {/* ── Operation header ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-surface border-b border-slate-200">
        <div>
          <div className="text-sm font-semibold text-slate-800">Operation Odette · Casualty Detection</div>
          <div className="text-xs text-slate-400">Cebu Province, Philippines · Deployable Field Unit</div>
        </div>

        <div className="flex items-center gap-4">
          {/* Feed pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border" style={{ borderColor: feedColor + '55' }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: feedColor, animation: feedStatus !== 'OFFLINE' ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ color: feedColor }} className="font-semibold">{feedStatus}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{streamSource}</span>
          </div>

          {/* Metrics strip */}
          <div className="flex items-center gap-3">
            <Metric label="Elapsed" value={formatElapsed(elapsedSec)} />
            <Metric label="Frames"  value={String(totalFrames)} />
            <Metric label="Casualties" value={String(detections.length)}
              valueColor={detections.length > 0 ? '#dc2626' : undefined} />
            {inferenceMs !== null && (
              <Metric label="AI Latency" value={`${Math.round(inferenceMs)}ms`} valueColor={latColor} />
            )}
          </div>
        </div>
      </div>

      {/* ── Model status bar ────────────────────────────────────────────────── */}
      {modelsStatus && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5 bg-slate-50 border-b border-slate-200">
          <span className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Models</span>
          <ModelChip label="Casualty Detect" info={modelsStatus.victim_model}
            metric={modelsStatus.victim_model.map50 != null ? `mAP ${modelsStatus.victim_model.map50.toFixed(3)}` : undefined} />
          <ModelChip label="Damage Class"    info={modelsStatus.damage_model}
            metric={modelsStatus.damage_model.accuracy != null ? `Acc ${modelsStatus.damage_model.accuracy.toFixed(3)}` : undefined} />
          <div className="ml-auto text-[10px] text-slate-400">
            YOLO11s · ONNX-DirectML · RTX 4050 · Field-Deployable
          </div>
        </div>
      )}

      {/* ── 3-column body ───────────────────────────────────────────────────── */}
      <div className="flex-1 grid gap-3 p-3 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: '260px 1fr 300px' }}>

        {/* ── Left: controls ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5">

          {/* Scan control */}
          <SideSection title="Casualty Scan">
            <button
              onClick={() => setDetecting((d) => !d)}
              className="w-full font-medium text-sm py-2.5 rounded-md transition-all flex items-center justify-center gap-2"
              style={detecting
                ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }
                : { background: '#0e7490', border: '1px solid #0e7490', color: '#ffffff' }}>
              {detecting ? <><Square size={14} /> Stop Scan</> : <><Play size={14} /> Begin Scan</>}
            </button>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <GhostBtn onClick={() => { setDetections([]); setInferenceMs(null); setTotalFrames(0) }}>
                Clear Log
              </GhostBtn>
              <GhostBtn
                disabled={detections.length === 0}
                onClick={() => {
                  if (detections.length === 0) return
                  const rows = [
                    ['ID','Class','Confidence','BBox X','BBox Y','BBox W','BBox H','Timestamp'],
                    ...detections.map((d) => [d.id, d.class, (d.confidence*100).toFixed(1)+'%', d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3], d.timestamp]),
                  ]
                  const csv = rows.map((r) => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url
                  a.download = `rescueeye_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`
                  a.click(); URL.revokeObjectURL(url)
                }}>
                Export CSV
              </GhostBtn>
            </div>
          </SideSection>

          {/* Sensor mode */}
          <SideSection title="Sensor Mode">
            <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-50 border border-slate-200 p-1">
              {(['auto', 'visual', 'thermal'] as const).map((m) => {
                const active = forceMode === m
                const accent = m === 'thermal' ? '#d97706' : m === 'visual' ? '#0e7490' : '#334155'
                return (
                  <button key={m} onClick={() => setForceMode(m)}
                    className="py-1.5 rounded text-xs font-medium transition-all"
                    style={active
                      ? { background: '#ffffff', color: accent, border: `1px solid ${accent}55`, boxShadow: '0 1px 2px rgba(15,23,42,0.08)' }
                      : { color: '#94a3b8', border: '1px solid transparent' }}>
                    {m === 'auto' ? 'Auto' : m === 'visual' ? 'Visual' : 'Therm'}
                  </button>
                )
              })}
            </div>
            {detecting && (
              <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-md"
                style={{ background: detectMode === 'thermal' ? '#fffbeb' : '#ecfeff',
                  border: `1px solid ${detectMode === 'thermal' ? '#fde68a' : '#a5f3fc'}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{
                  background: detectMode === 'thermal' ? '#d97706' : '#0e7490',
                  animation: 'pulse 1.5s infinite',
                }} />
                <span className="text-xs font-medium"
                  style={{ color: detectMode === 'thermal' ? '#b45309' : '#0e7490' }}>
                  {detectMode === 'thermal' ? 'Thermal Active' : 'Visual Active'}
                </span>
              </div>
            )}
          </SideSection>

          {/* Platform telemetry */}
          <SideSection title="Field Unit">
            <div className="space-y-0">
              {([
                ['Unit ID',   'UAV-ALPHA-01', '#0e7490'],
                ['Altitude',  '120 m AGL',    '#0e7490'],
                ['Airspeed',  '8.4 m/s',      '#0e7490'],
                ['Battery',   '74 %',         '#16a34a'],
                ['Signal',    'Strong',       '#16a34a'],
                ['GPS Lock',  '14 sats',      '#16a34a'],
              ] as [string, string, string][]).map(([k, v, vc]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className="text-xs font-mono font-medium" style={{ color: vc }}>{v}</span>
                </div>
              ))}
            </div>
          </SideSection>

          {/* Drone source */}
          <SideSection title="Drone Source">
            <div className="space-y-2">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-slate-50 border border-slate-200">
                {(['live', 'upload'] as const).map((m) => (
                  <button key={m} onClick={() => setSourceMode(m)}
                    className="py-1 rounded text-xs font-medium transition-all flex items-center justify-center gap-1"
                    style={sourceMode === m
                      ? { background: '#ffffff', color: '#0e7490', border: '1px solid #a5f3fc', boxShadow: '0 1px 2px rgba(15,23,42,0.08)' }
                      : { color: '#94a3b8', border: '1px solid transparent' }}>
                    {m === 'live' ? <><Play size={11} /> Live</> : <><Upload size={11} /> Upload</>}
                  </button>
                ))}
              </div>

              {sourceMode === 'live' ? (
                <>
                  <div className="flex gap-1">
                    <input
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && sourceInput.trim()) applyDroneSource(sourceInput.trim()) }}
                      placeholder="rtsp://192.168.1.1/live"
                      spellCheck={false}
                      className="input-field flex-1 text-xs py-1.5 min-w-0"
                    />
                    <button
                      onClick={() => sourceInput.trim() && applyDroneSource(sourceInput.trim())}
                      disabled={sourceSetting || !sourceInput.trim()}
                      className="text-xs font-medium px-2 py-1 rounded-md disabled:opacity-30 transition-all"
                      style={{ background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490' }}>
                      {sourceSetting ? '…' : 'Set'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400 block">Drone Brand</span>
                    <select
                      value={selectedDrone}
                      onChange={(e) => {
                        const brand = DRONE_BRANDS.find((b) => b.name === e.target.value)
                        setSelectedDrone(e.target.value)
                        if (brand !== undefined) setSourceInput(brand.url)
                      }}
                      className="input-field text-xs py-1.5">
                      <option value="">— select brand —</option>
                      {DRONE_BRANDS.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    {selectedDrone && (
                      <p className="text-[11px] text-slate-400">
                        {DRONE_BRANDS.find((b) => b.name === selectedDrone)?.hint}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1 pt-0.5">
                      {[
                        { label: 'Demo video', url: 'd:/RescueEye/api/data/demo_feed8_trim.mp4' },
                        { label: 'Synthetic',  url: '' },
                      ].map(({ label, url }) => (
                        <button key={label}
                          onClick={() => { setSourceInput(url); setSelectedDrone(''); applyDroneSource(url) }}
                          className="text-xs py-1 rounded-md px-2 text-center transition-all border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === 'uploading'}
                    className="w-full text-xs font-medium py-3 rounded-md transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: '#ecfeff', border: '2px dashed #a5f3fc', color: '#0e7490' }}>
                    <Upload size={14} /> {uploadStatus === 'uploading' ? 'Uploading…' : 'Select Video File'}
                  </button>
                  <input ref={fileInputRef} type="file"
                    accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.ts,.webm,.m4v"
                    className="hidden" onChange={handleFileUpload} />
                  {uploadStatus === 'done' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 border border-green-200">
                      <CircleCheck size={12} className="text-green-600" />
                      <span className="text-[11px] truncate text-green-700">{uploadedName}</span>
                    </div>
                  )}
                  {uploadStatus === 'error' && (
                    <p className="text-[11px] text-center text-alert">
                      Upload failed — check file type
                    </p>
                  )}
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Supported: MP4, MOV, AVI, MKV, TS, WebM · File uploads automatically, stream switches instantly
                  </p>
                </div>
              )}
            </div>
          </SideSection>

          {/* AI engine */}
          <SideSection title="AI Engine">
            <div className="space-y-0">
              {([
                ['Model',    modelsStatus?.victim_model.is_custom ? 'YOLO11s' : 'YOLOv8n'],
                ['Backend',  modelsStatus?.victim_model.is_custom ? 'ONNX-DirectML' : 'PyTorch'],
                ['Version',  modelsStatus?.victim_model.version ?? '—'],
                ['mAP@0.5',  modelsStatus?.victim_model.map50 != null ? modelsStatus.victim_model.map50.toFixed(3) : '—'],
                ['Latency',  inferenceMs != null ? `${Math.round(inferenceMs)} ms` : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-xs text-slate-500">{k}</span>
                  <span className="text-xs font-mono font-medium"
                    style={{ color: k === 'Latency' ? latColor : '#1e293b' }}>{v}</span>
                </div>
              ))}
            </div>
          </SideSection>
        </div>

        {/* ── Center: live feed ───────────────────────────────────────────── */}
        <div className={`flex flex-col min-h-0 overflow-hidden rounded-lg bg-black shadow-card transition-shadow ${
          canvasFlash ? 'ring-2 ring-accent border-accent' : 'border border-slate-200'
        }`}>

          {/* Feed header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-black/70 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/70">
                Feed 3 · Aerial
              </span>
              {feedStatus === 'ACTIVE' && detecting && (
                <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span> REC
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {brightness !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40">Lux</span>
                  <div className="w-16 h-1 rounded-full overflow-hidden bg-white/15">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min((brightness / 255) * 100, 100)}%`,
                        background: brightness < 60 ? '#f59e0b' : '#22c55e' }} />
                  </div>
                  <span className="text-[10px] tabular-nums"
                    style={{ color: brightness < 60 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                    {Math.round(brightness)}
                  </span>
                </div>
              )}
              <span className="text-[10px]" style={{ color: detecting ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                {detecting ? 'Scanning' : 'Standby'}
              </span>
            </div>
          </div>

          {/* Video */}
          <div className="flex-1 min-h-0 relative">
            <img ref={imgRef} src={STREAM_URL_3} alt="aerial feed" crossOrigin="anonymous"
              className="w-full h-full object-contain"
              onLoad={() => setFeedStatus('ACTIVE')}
              onError={() => { setFeedStatus('OFFLINE'); setTimeout(() => setFeedStatus('CONNECTING'), 2000) }}
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {feedStatus === 'OFFLINE' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85">
                <div className="text-xs font-semibold mb-1 text-red-400">
                  Feed Signal Lost
                </div>
                <div className="text-[10px] text-white/40">
                  Attempting reconnect...
                </div>
              </div>
            )}

            {/* Night mode banner */}
            {detecting && detectMode === 'thermal' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded pointer-events-none"
                style={{ zIndex: 20, background: 'rgba(217,119,6,0.2)',
                  border: '1px solid rgba(217,119,6,0.5)', backdropFilter: 'blur(4px)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
                <span className="text-[10px] font-medium text-amber-300">
                  Night Mode · Thermal
                </span>
              </div>
            )}

            {/* Damage classification badge */}
            {damageLabel && detecting && (
              <div className="absolute bottom-3 left-3 flex flex-col gap-1 px-3 py-2 rounded-lg"
                style={{
                  zIndex: 15,
                  background: 'rgba(15,23,42,0.88)',
                  border: `1px solid ${DAMAGE_COLOR[damageLabel.label] ?? '#ffffff44'}66`,
                  backdropFilter: 'blur(6px)',
                  maxWidth: '240px',
                }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                    style={{ background: DAMAGE_COLOR[damageLabel.label] ?? '#fff' }} />
                  <span className="text-[11px] font-medium"
                    style={{ color: DAMAGE_COLOR[damageLabel.label] ?? '#fff' }}>
                    {DAMAGE_DISPLAY[damageLabel.label] ?? damageLabel.label}
                  </span>
                  {damageLabel.severity && damageLabel.severity !== 'CLEAR' && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: `${SEVERITY_COLOR[damageLabel.severity] ?? '#fff'}22`,
                        color: SEVERITY_COLOR[damageLabel.severity] ?? '#fff',
                        border: `1px solid ${SEVERITY_COLOR[damageLabel.severity] ?? '#fff'}44`,
                      }}>
                      {damageLabel.severity}
                    </span>
                  )}
                  <span className="text-[10px] ml-auto text-white/50">
                    {Math.round(damageLabel.confidence * 100)}%
                  </span>
                </div>
                {damageLabel.suggested_action && (
                  <p className="text-[10px] leading-relaxed pl-4 text-white/50">
                    {damageLabel.suggested_action}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: detection log + incidents ────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <DetectionLog detections={detections} latestFrame={latestFrame}
              onClear={() => { setDetections([]); setTotalFrames(0); setLatestFrame(null) }} />
          </div>
          <div className="flex-shrink-0"><IncidentPanel /></div>
        </div>

      </div>

      <canvas ref={hiddenCanvas}   className="hidden" />
      <canvas ref={classifyCanvas} className="hidden" />
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function Metric({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: '56px' }}>
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-xs font-mono font-semibold tabular-nums" style={{ color: valueColor ?? '#334155' }}>{value}</span>
    </div>
  )
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel flex-shrink-0">
      <div className="panel-header">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function GhostBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} className="btn-ghost text-xs py-1.5 disabled:opacity-30">
      {children}
    </button>
  )
}

function ModelChip({ label, info, metric }: { label: string; info: ModelInfo; metric?: string }) {
  const ok = info.loaded && info.is_custom
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px]"
      style={{ background: ok ? '#f0fdf4' : '#fffbeb', border: `1px solid ${ok ? '#bbf7d0' : '#fde68a'}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#16a34a' : '#d97706' }} />
      <span className="text-slate-500">{label}</span>
      <span style={{ color: ok ? '#16a34a' : '#d97706' }} className="font-semibold">
        {info.is_custom ? 'Custom' : 'Pretrained'}
      </span>
      {metric && <span className="text-slate-400">· {metric}</span>}
    </div>
  )
}

/* ── Incident panel ─────────────────────────────────────────────────────────── */

const INCIDENT_ACCENT: Record<string, string> = {
  VICTIM_DETECTED: '#dc2626',
  FIRE:            '#ea580c',
  FLOOD:           '#0e7490',
  STRUCTURAL:      '#d97706',
  UNKNOWN:         '#94a3b8',
}

function IncidentPanel() {
  const [incidents, setIncidents] = useState<Array<{
    id: string; type: string; severity: string; description: string; createdAt: string; status: string
  }>>([])

  useEffect(() => {
    async function poll() {
      try { const r = await fetch('/server/incidents'); if (r.ok) setIncidents(await r.json()) } catch {}
    }
    poll(); const t = setInterval(poll, 5000); return () => clearInterval(t)
  }, [])

  return (
    <div className="panel flex flex-col" style={{ maxHeight: '200px' }}>
      <div className="panel-header flex items-center justify-between">
        <span>Incident Log</span>
        <span className="badge"
          style={incidents.length > 0
            ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
            : { color: '#94a3b8', borderColor: 'transparent' }}>
          {incidents.length} Active
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {incidents.length === 0
          ? <p className="text-xs text-center py-4 text-slate-400">
              No active incidents
            </p>
          : [...incidents].reverse().map((inc) => {
              const accent = INCIDENT_ACCENT[inc.type] ?? '#94a3b8'
              return (
                <div key={inc.id} className="rounded-md p-2 flex flex-col gap-0.5 bg-slate-50 border border-slate-200"
                  style={{ borderLeft: `3px solid ${accent}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: accent }}>
                      {inc.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] px-1 py-0.5 rounded font-medium"
                      style={inc.severity === 'HIGH' || inc.severity === 'CRITICAL'
                        ? { background: '#fef2f2', color: '#dc2626' }
                        : { background: '#fffbeb', color: '#d97706' }}>
                      {inc.severity}
                    </span>
                  </div>
                  <p className="text-[11px] truncate text-slate-500">
                    {inc.description}
                  </p>
                </div>
              )
            })}
      </div>
    </div>
  )
}
