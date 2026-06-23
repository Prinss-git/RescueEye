import { useState, useRef, useEffect } from 'react'
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
  flood_damage:      '#00d4ff',
  fire_damage:       '#ff7700',
  structural_damage: '#f97316',
}
const DAMAGE_DISPLAY: Record<string, string> = {
  flood_damage:      'FLOOD DAMAGE',
  fire_damage:       'FIRE DAMAGE',
  structural_damage: 'STRUCTURAL DMG',
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ff3b3b',
  MODERATE: '#f59e0b',
  MINOR:    '#ffdc00',
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
  person:             '#ff3b3b',
  life_sign:          '#ffdc00',
  fire_damage:        '#ff7700',
  flood_damage:       '#00d4ff',
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
  const [clock, setClock]               = useState('')

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

  useEffect(() => { forceModeRef.current = forceMode }, [forceMode])

  // Clock
  useEffect(() => {
    function tick() { setClock(new Date().toLocaleTimeString('en-PH', { hour12: false })) }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

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
                ctx.fillStyle = '#0a0e1a'; ctx.fillText(label, lx + 4/scale, ly + 12/scale)
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
      if (!detectingRef.current) return
      const img    = imgRef.current
      const canvas = hiddenCanvas.current
      if (!img || !canvas || !img.naturalWidth) return
      try {
        canvas.width  = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
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
        if (!res.ok || !detectingRef.current) return
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
    feedStatus === 'ACTIVE'     ? '#22c55e' :
    feedStatus === 'CONNECTING' ? '#f59e0b' : '#ff3b3b'

  const latColor =
    inferenceMs == null ? '#ffffff44' :
    inferenceMs > 2000  ? '#ff3b3b'   :
    inferenceMs > 500   ? '#f59e0b'   : '#22c55e'

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#070b14' }}>

      {/* ── App header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
        style={{ background: '#0d1220', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.5" fill="#00d4ff"/>
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M3.5 3.5l2 2M10.5 10.5l2 2M10.5 3.5l-2 2M5.5 10.5l-2 2" stroke="#00d4ff44" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="font-mono font-bold text-sm tracking-widest" style={{ color: '#00d4ff' }}>RESCUEEYE</div>
              <div className="font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>PORTABLE SAR FIELD RESPONSE SYSTEM</div>
            </div>
          </div>
          <div className="w-px h-8 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div className="font-mono text-[10px] font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>OPERATION ODETTE · CASUALTY DETECTION</div>
            <div className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>CEBU PROVINCE, PHILIPPINES · DEPLOYABLE FIELD UNIT</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Feed pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs"
            style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${feedColor}44` }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: feedColor, boxShadow: feedStatus === 'ACTIVE' ? `0 0 6px ${feedColor}` : 'none',
                animation: feedStatus !== 'OFFLINE' ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ color: feedColor }} className="font-bold">{feedStatus}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }} className="uppercase">{streamSource}</span>
          </div>

          {/* Metrics strip */}
          <div className="flex items-center gap-3">
            <Metric label="ELAPSED" value={formatElapsed(elapsedSec)} />
            <Metric label="FRAMES"  value={String(totalFrames)} />
            <Metric label="CASUALTIES" value={String(detections.length)}
              valueColor={detections.length > 0 ? '#ff3b3b' : undefined} />
            {inferenceMs !== null && (
              <Metric label="AI LAT" value={`${Math.round(inferenceMs)}ms`} valueColor={latColor} />
            )}
          </div>

          <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="font-mono text-sm tabular-nums" style={{ color: 'rgba(255,255,255,0.6)' }}>{clock}</div>
        </div>
      </div>

      {/* ── Model status bar ────────────────────────────────────────────────── */}
      {modelsStatus && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-1.5"
          style={{ background: '#0a0f1c', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="font-mono text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>MODELS</span>
          <ModelChip label="CASUALTY DETECT" info={modelsStatus.victim_model}
            metric={modelsStatus.victim_model.map50 != null ? `mAP ${modelsStatus.victim_model.map50.toFixed(3)}` : undefined} />
          <ModelChip label="DAMAGE CLASS"    info={modelsStatus.damage_model}
            metric={modelsStatus.damage_model.accuracy != null ? `ACC ${modelsStatus.damage_model.accuracy.toFixed(3)}` : undefined} />
          <div className="ml-auto font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            YOLO11s · ONNX-DirectML · RTX 4050 · FIELD-DEPLOYABLE
          </div>
        </div>
      )}

      {/* ── 3-column body ───────────────────────────────────────────────────── */}
      <div className="flex-1 grid gap-2 p-2 min-h-0 overflow-hidden"
        style={{ gridTemplateColumns: '240px 1fr 280px' }}>

        {/* ── Left: controls ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">

          {/* Scan control */}
          <SideSection title="CASUALTY SCAN">
            <button
              onClick={() => setDetecting((d) => !d)}
              className="w-full font-mono font-bold text-xs py-2.5 rounded transition-all tracking-widest"
              style={detecting
                ? { background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.5)', color: '#ff3b3b' }
                : { background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.5)', color: '#00d4ff',
                    boxShadow: '0 0 12px rgba(0,212,255,0.15)' }}>
              {detecting ? '■  STOP SCAN' : '▶  BEGIN SCAN'}
            </button>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              <GhostBtn onClick={() => { setDetections([]); setInferenceMs(null); setTotalFrames(0) }}>
                CLEAR LOG
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
                EXPORT CSV
              </GhostBtn>
            </div>
          </SideSection>

          {/* Sensor mode */}
          <SideSection title="SENSOR MODE">
            <div className="grid grid-cols-3 gap-1 rounded overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', padding: '3px' }}>
              {(['auto', 'visual', 'thermal'] as const).map((m) => {
                const active = forceMode === m
                const accent = m === 'thermal' ? '#f59e0b' : m === 'visual' ? '#00d4ff' : '#ffffff'
                return (
                  <button key={m} onClick={() => setForceMode(m)}
                    className="py-1.5 rounded font-mono text-[10px] font-bold tracking-widest transition-all"
                    style={active
                      ? { background: `${accent}18`, color: accent, border: `1px solid ${accent}55` }
                      : { color: 'rgba(255,255,255,0.25)', border: '1px solid transparent' }}>
                    {m === 'auto' ? 'AUTO' : m === 'visual' ? 'VISUAL' : 'THERM'}
                  </button>
                )
              })}
            </div>
            {detecting && (
              <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded"
                style={{ background: detectMode === 'thermal' ? 'rgba(245,158,11,0.08)' : 'rgba(0,212,255,0.06)',
                  border: `1px solid ${detectMode === 'thermal' ? 'rgba(245,158,11,0.25)' : 'rgba(0,212,255,0.15)'}` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{
                  background: detectMode === 'thermal' ? '#f59e0b' : '#00d4ff',
                  animation: 'pulse 1.5s infinite',
                }} />
                <span className="font-mono text-[10px] font-bold tracking-wider"
                  style={{ color: detectMode === 'thermal' ? '#f59e0b' : '#00d4ff' }}>
                  {detectMode === 'thermal' ? 'THERMAL ACTIVE' : 'VISUAL ACTIVE'}
                </span>
              </div>
            )}
          </SideSection>

          {/* Platform telemetry */}
          <SideSection title="FIELD UNIT">
            <div className="space-y-0">
              {([
                ['UNIT ID',   'UAV-ALPHA-01', '#00d4ff'],
                ['ALTITUDE',  '120 m AGL',    '#00d4ff'],
                ['AIRSPEED',  '8.4 m/s',      '#00d4ff'],
                ['BATTERY',   '74 %',         '#22c55e'],
                ['SIGNAL',    'STRONG',       '#22c55e'],
                ['GPS LOCK',  '14 SATS',      '#22c55e'],
              ] as [string, string, string][]).map(([k, v, vc]) => (
                <div key={k} className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
                  <span className="font-mono text-[10px] font-bold" style={{ color: vc }}>{v}</span>
                </div>
              ))}
            </div>
          </SideSection>

          {/* Drone source */}
          <SideSection title="DRONE SOURCE">
            <div className="space-y-2">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {(['live', 'upload'] as const).map((m) => (
                  <button key={m} onClick={() => setSourceMode(m)}
                    className="py-1 rounded font-mono text-[10px] font-bold tracking-widest transition-all"
                    style={sourceMode === m
                      ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.4)' }
                      : { color: 'rgba(255,255,255,0.25)', border: '1px solid transparent' }}>
                    {m === 'live' ? '▶ LIVE' : '↑ UPLOAD'}
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
                      className="flex-1 font-mono text-[10px] px-2 py-1.5 rounded min-w-0"
                      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                    />
                    <button
                      onClick={() => sourceInput.trim() && applyDroneSource(sourceInput.trim())}
                      disabled={sourceSetting || !sourceInput.trim()}
                      className="font-mono text-[10px] font-bold px-2 py-1 rounded tracking-wider disabled:opacity-30 transition-all"
                      style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.4)', color: '#00d4ff' }}>
                      {sourceSetting ? '…' : 'SET'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-mono text-[9px] tracking-wider block"
                      style={{ color: 'rgba(255,255,255,0.25)' }}>DRONE BRAND</span>
                    <select
                      value={selectedDrone}
                      onChange={(e) => {
                        const brand = DRONE_BRANDS.find((b) => b.name === e.target.value)
                        setSelectedDrone(e.target.value)
                        if (brand !== undefined) setSourceInput(brand.url)
                      }}
                      className="w-full font-mono text-[10px] px-2 py-1.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.7)', outline: 'none' }}>
                      <option value="">— select brand —</option>
                      {DRONE_BRANDS.map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    {selectedDrone && (
                      <p className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
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
                          className="font-mono text-[10px] py-1 rounded px-2 text-center transition-all"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                            color: 'rgba(255,255,255,0.35)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
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
                    className="w-full font-mono text-[10px] font-bold py-3 rounded tracking-widest transition-all disabled:opacity-40"
                    style={{ background: 'rgba(0,212,255,0.08)', border: '2px dashed rgba(0,212,255,0.3)',
                      color: '#00d4ff' }}>
                    {uploadStatus === 'uploading' ? 'UPLOADING…' : '↑  SELECT VIDEO FILE'}
                  </button>
                  <input ref={fileInputRef} type="file"
                    accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.mkv,.ts,.webm,.m4v"
                    className="hidden" onChange={handleFileUpload} />
                  {uploadStatus === 'done' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <span className="text-[10px]" style={{ color: '#22c55e' }}>✓</span>
                      <span className="font-mono text-[9px] truncate" style={{ color: '#22c55e' }}>{uploadedName}</span>
                    </div>
                  )}
                  {uploadStatus === 'error' && (
                    <p className="font-mono text-[9px] text-center" style={{ color: '#ff3b3b' }}>
                      Upload failed — check file type
                    </p>
                  )}
                  <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Supported: MP4, MOV, AVI, MKV, TS, WebM · File uploads automatically, stream switches instantly
                  </p>
                </div>
              )}
            </div>
          </SideSection>

          {/* AI engine */}
          <SideSection title="AI ENGINE">
            <div className="space-y-0">
              {([
                ['MODEL',    modelsStatus?.victim_model.is_custom ? 'YOLO11s' : 'YOLOv8n'],
                ['BACKEND',  modelsStatus?.victim_model.is_custom ? 'ONNX-DirectML' : 'PyTorch'],
                ['VERSION',  modelsStatus?.victim_model.version ?? '—'],
                ['mAP@0.5',  modelsStatus?.victim_model.map50 != null ? modelsStatus.victim_model.map50.toFixed(3) : '—'],
                ['LATENCY',  inferenceMs != null ? `${Math.round(inferenceMs)} ms` : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-1.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
                  <span className="font-mono text-[10px] font-bold"
                    style={{ color: k === 'LATENCY' ? latColor : 'rgba(255,255,255,0.75)' }}>{v}</span>
                </div>
              ))}
            </div>
          </SideSection>
        </div>

        {/* ── Center: live feed ───────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 overflow-hidden rounded-lg"
          style={{ border: '1px solid rgba(0,212,255,0.2)', background: '#000',
            boxShadow: canvasFlash ? '0 0 0 2px #00d4ff, 0 0 20px rgba(0,212,255,0.35)' : '0 0 8px rgba(0,212,255,0.12)',
            transition: 'box-shadow 0.15s' }}>

          {/* Feed header */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2"
            style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(0,212,255,0.12)' }}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
                FEED-3 · AERIAL
              </span>
              {feedStatus === 'ACTIVE' && detecting && (
                <span className="flex items-center gap-1 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,59,59,0.15)', border: '1px solid rgba(255,59,59,0.4)', color: '#ff3b3b' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span> REC
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {brightness !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>LUX</span>
                  <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min((brightness / 255) * 100, 100)}%`,
                        background: brightness < 60 ? '#f59e0b' : '#22c55e' }} />
                  </div>
                  <span className="font-mono text-[9px] tabular-nums"
                    style={{ color: brightness < 60 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
                    {Math.round(brightness)}
                  </span>
                </div>
              )}
              <span className="font-mono text-[10px]" style={{ color: detecting ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                {detecting ? 'SCANNING' : 'STANDBY'}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.85)' }}>
                <div className="font-mono text-xs font-bold tracking-widest mb-1" style={{ color: '#ff3b3b' }}>
                  FEED SIGNAL LOST
                </div>
                <div className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  ATTEMPTING RECONNECT...
                </div>
              </div>
            )}

            {/* Night mode banner */}
            {detecting && detectMode === 'thermal' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded pointer-events-none"
                style={{ zIndex: 20, background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.45)', backdropFilter: 'blur(4px)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
                <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: '#f59e0b' }}>
                  NIGHT MODE · THERMAL
                </span>
              </div>
            )}

            {/* Damage classification badge */}
            {damageLabel && detecting && (
              <div className="absolute bottom-3 left-3 flex flex-col gap-1 px-3 py-2 rounded-lg"
                style={{
                  zIndex: 15,
                  background: 'rgba(7,11,20,0.92)',
                  border: `1px solid ${DAMAGE_COLOR[damageLabel.label] ?? '#ffffff44'}55`,
                  backdropFilter: 'blur(6px)',
                  maxWidth: '240px',
                }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                    style={{ background: DAMAGE_COLOR[damageLabel.label] ?? '#fff' }} />
                  <span className="font-mono text-[10px] font-bold tracking-wider"
                    style={{ color: DAMAGE_COLOR[damageLabel.label] ?? '#fff' }}>
                    {DAMAGE_DISPLAY[damageLabel.label] ?? damageLabel.label.toUpperCase()}
                  </span>
                  {damageLabel.severity && damageLabel.severity !== 'CLEAR' && (
                    <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: `${SEVERITY_COLOR[damageLabel.severity] ?? '#fff'}18`,
                        color: SEVERITY_COLOR[damageLabel.severity] ?? '#fff',
                        border: `1px solid ${SEVERITY_COLOR[damageLabel.severity] ?? '#fff'}33`,
                      }}>
                      {damageLabel.severity}
                    </span>
                  )}
                  <span className="font-mono text-[9px] ml-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {Math.round(damageLabel.confidence * 100)}%
                  </span>
                </div>
                {damageLabel.suggested_action && (
                  <p className="font-mono text-[9px] leading-relaxed pl-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {damageLabel.suggested_action}
                  </p>
                )}
              </div>
            )}

            {/* Corner grid overlay (decorative) */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
              {/* Top-left corner marks */}
              <div className="absolute top-3 left-3 flex flex-col" style={{ gap: '2px' }}>
                <div className="w-5 h-px" style={{ background: 'rgba(0,212,255,0.4)' }} />
                <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.4)' }} />
              </div>
              {/* Top-right corner marks */}
              <div className="absolute top-3 right-3 flex flex-col items-end" style={{ gap: '2px' }}>
                <div className="w-5 h-px" style={{ background: 'rgba(0,212,255,0.4)' }} />
                <div className="w-px h-5 self-end" style={{ background: 'rgba(0,212,255,0.4)' }} />
              </div>
              {/* Bottom-left */}
              <div className="absolute bottom-3 left-3 flex flex-col-reverse" style={{ gap: '2px' }}>
                <div className="w-5 h-px" style={{ background: 'rgba(0,212,255,0.4)' }} />
                <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.4)' }} />
              </div>
              {/* Bottom-right */}
              <div className="absolute bottom-3 right-3 flex flex-col-reverse items-end" style={{ gap: '2px' }}>
                <div className="w-5 h-px" style={{ background: 'rgba(0,212,255,0.4)' }} />
                <div className="w-px h-5 self-end" style={{ background: 'rgba(0,212,255,0.4)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: detection log + incidents ────────────────────────────── */}
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
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
    <div className="flex flex-col items-center" style={{ minWidth: '52px' }}>
      <span className="font-mono text-[8px] tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <span className="font-mono text-xs font-bold tabular-nums" style={{ color: valueColor ?? 'rgba(255,255,255,0.7)' }}>{value}</span>
    </div>
  )
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden flex-shrink-0"
      style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="px-3 py-2 font-mono text-[9px] font-bold tracking-widest"
        style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {title}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function GhostBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="font-mono text-[10px] font-bold tracking-widest py-1.5 rounded transition-all disabled:opacity-25"
      style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)',
        background: 'rgba(255,255,255,0.03)' }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)' }}>
      {children}
    </button>
  )
}

function ModelChip({ label, info, metric }: { label: string; info: ModelInfo; metric?: string }) {
  const ok = info.loaded && info.is_custom
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[9px]"
      style={{ background: ok ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ok ? '#22c55e' : '#f59e0b' }} />
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ color: ok ? '#22c55e' : '#f59e0b' }} className="font-bold">
        {info.is_custom ? 'CUSTOM' : 'PRETRAINED'}
      </span>
      {metric && <span style={{ color: 'rgba(255,255,255,0.3)' }}>· {metric}</span>}
    </div>
  )
}

/* ── Incident panel ─────────────────────────────────────────────────────────── */

const INCIDENT_ACCENT: Record<string, string> = {
  VICTIM_DETECTED: '#ff3b3b',
  FIRE:            '#ff7700',
  FLOOD:           '#00d4ff',
  STRUCTURAL:      '#f59e0b',
  UNKNOWN:         '#ffffff44',
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
    <div className="rounded-lg overflow-hidden flex flex-col" style={{
      maxHeight: '200px', background: '#0d1220', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          INCIDENT LOG
        </span>
        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={incidents.length > 0
            ? { background: 'rgba(255,59,59,0.15)', color: '#ff3b3b', border: '1px solid rgba(255,59,59,0.3)' }
            : { color: 'rgba(255,255,255,0.2)' }}>
          {incidents.length} ACTIVE
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {incidents.length === 0
          ? <p className="font-mono text-[10px] text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
              NO ACTIVE INCIDENTS
            </p>
          : [...incidents].reverse().map((inc) => {
              const accent = INCIDENT_ACCENT[inc.type] ?? '#ffffff44'
              return (
                <div key={inc.id} className="rounded p-2 flex flex-col gap-0.5"
                  style={{ background: 'rgba(0,0,0,0.25)', borderLeft: `2px solid ${accent}`,
                    border: `1px solid rgba(255,255,255,0.05)`, borderLeftColor: accent }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold tracking-wider" style={{ color: accent }}>
                      {inc.type.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-[9px] px-1 py-0.5 rounded font-bold"
                      style={inc.severity === 'HIGH' || inc.severity === 'CRITICAL'
                        ? { background: 'rgba(255,59,59,0.15)', color: '#ff3b3b' }
                        : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      {inc.severity}
                    </span>
                  </div>
                  <p className="font-mono text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {inc.description}
                  </p>
                </div>
              )
            })}
      </div>
    </div>
  )
}
