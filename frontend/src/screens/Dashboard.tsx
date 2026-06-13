import { useState, useRef, useEffect, useCallback } from 'react'
import DetectionLog, { Detection } from '../components/DetectionLog'

const API = '/api'
const STREAM_URL_3  = `${API}/stream/feed3`
const DETECT_URL    = `${API}/detect`
const STATUS_URL    = `${API}/stream/status`
const MODELS_URL    = `${API}/models/status`

const MAX_LOG_ENTRIES    = 30

const STATUS_POLL_MS     = 3000
const MODEL_POLL_MS      = 10000

type FeedStatus = 'ACTIVE' | 'CONNECTING' | 'OFFLINE'

interface DetectResponse {
  detections: Array<{
    id:         string
    class:      string
    confidence: number
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
  version:  string
  weights:  string
  loaded:   boolean
  is_custom: boolean
  map50?:   number
  accuracy?: number
}

interface ModelsStatus {
  victim_model: ModelInfo
  damage_model: ModelInfo
}

const CLASS_COLOR: Record<string, string> = {
  person:             '#ff3b3b',
  fire_damage:        '#ff7700',
  flood_damage:       '#00d4ff',
  structural_damage:  '#f97316',
}

export default function Dashboard() {
  const [feedStatus, setFeedStatus]       = useState<FeedStatus>('CONNECTING')
  const [detections, setDetections]       = useState<Detection[]>([])
  const [inferenceMs, setInferenceMs]     = useState<number | null>(null)
  const [detecting, setDetecting]         = useState(false)
  const [elapsedSec, setElapsedSec]       = useState(0)
  const [streamSource, setStreamSource]   = useState('—')
  const [totalFrames, setTotalFrames]     = useState(0)
  const [modelsStatus, setModelsStatus]   = useState<ModelsStatus | null>(null)
  const [canvasFlash, setCanvasFlash]     = useState(false)
  const [detectMode, setDetectMode]       = useState<'visual' | 'thermal'>('visual')
  const [forceMode, setForceMode]         = useState<'auto' | 'visual' | 'thermal'>('auto')
  const [brightness, setBrightness]       = useState<number | null>(null)
  const [latestFrame, setLatestFrame]     = useState<string | null>(null)

  const imgRef           = useRef<HTMLImageElement>(null)
  const imgRef2          = useRef<HTMLImageElement>(null)
  const imgRef3          = useRef<HTMLImageElement>(null)
  const imgRef4          = useRef<HTMLImageElement>(null)
  const overlayCanvasRef  = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef2 = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef3 = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef4 = useRef<HTMLCanvasElement>(null)
  const forceModeRef     = useRef<'auto' | 'visual' | 'thermal'>('auto')

  // Keep forceModeRef in sync with state so runDetection closure always reads latest
  useEffect(() => { forceModeRef.current = forceMode }, [forceMode])

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Model status poller ────────────────────────────────────────────────────
  useEffect(() => {
    async function pollModels() {
      try {
        const r = await fetch(MODELS_URL)
        if (r.ok) setModelsStatus(await r.json())
      } catch { /* API not running */ }
    }
    pollModels()
    const t = setInterval(pollModels, MODEL_POLL_MS)
    return () => clearInterval(t)
  }, [])

  // ── Stream status poller ───────────────────────────────────────────────────
  useEffect(() => {
    async function pollStatus() {
      try {
        const r = await fetch(STATUS_URL)
        if (!r.ok) throw new Error('non-ok')
        const data = await r.json()
        setFeedStatus(data.active ? 'ACTIVE' : 'OFFLINE')
        setStreamSource(data.source ?? '—')
      } catch {
        setFeedStatus('OFFLINE')
      }
    }
    pollStatus()
    const t = setInterval(pollStatus, STATUS_POLL_MS)
    return () => clearInterval(t)
  }, [])

  // ── Per-feed refs lookup ───────────────────────────────────────────────────
  const feedImgRefs     = [imgRef,     imgRef2,     imgRef3,     imgRef4]
  const feedCanvasRefs  = [overlayCanvasRef, overlayCanvasRef2, overlayCanvasRef3, overlayCanvasRef4]
  const feedLabels      = ['FEED 1', 'FEED 2', 'FEED 3', 'FEED 4']

  // ── Bounding box renderer (per feed) ──────────────────────────────────────
  const drawOverlayOnFeed = useCallback((
    dets: DetectResponse['detections'],
    imgW: number,
    imgH: number,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    imgElRef:  React.RefObject<HTMLImageElement>,
  ) => {
    const canvas = canvasRef.current
    const img    = imgElRef.current
    if (!canvas || !img) return
    const displayW = img.clientWidth  || imgW
    const displayH = img.clientHeight || imgH
    const scale    = Math.min(displayW / imgW, displayH / imgH)
    const offsetX  = (displayW - imgW * scale) / 2
    const offsetY  = (displayH - imgH * scale) / 2
    if (canvas.width !== displayW)  canvas.width  = displayW
    if (canvas.height !== displayH) canvas.height = displayH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, displayW, displayH)
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)
    for (const d of dets) {
      const { x, y, w, h } = d.bbox
      const color = CLASS_COLOR[d.class] ?? '#ffffff'
      const conf  = Math.round(d.confidence * 100)
      const label = `${d.class.toUpperCase()} ${conf}%`
      ctx.strokeStyle = color
      ctx.lineWidth   = 2
      ctx.strokeRect(x, y, w, h)
      const cs = 10
      ctx.lineWidth = 3
      ;[[x,y,cs,0,0,cs],[x+w,y,-cs,0,0,cs],[x,y+h,cs,0,0,-cs],[x+w,y+h,-cs,0,0,-cs]].forEach(([ox,oy,dx1,dy1,dx2,dy2]) => {
        ctx.beginPath(); ctx.moveTo(ox+dx1,oy+dy1); ctx.lineTo(ox,oy); ctx.lineTo(ox+dx2,oy+dy2); ctx.stroke()
      })
      ctx.font = 'bold 11px "JetBrains Mono", monospace'
      const tw = ctx.measureText(label).width
      const lx = x; const ly = y > 18 ? y - 18 : y + h + 2
      ctx.fillStyle = color
      ctx.beginPath(); ctx.roundRect(lx, ly, tw + 8, 16, 3); ctx.fill()
      ctx.fillStyle = '#0a0e1a'; ctx.fillText(label, lx + 4, ly + 12)
    }
    ctx.restore()
  }, [])

  // ── Per-feed detection ─────────────────────────────────────────────────────
  // ── Detection loop — one feed at a time, in-flight guard prevents pile-up ────
  useEffect(() => {
    if (!detecting) return
    let cancelled = false
    const inFlight = [false, false, false, false]


    async function runFeed(idx: number) {
      if (inFlight[idx] || cancelled) return
      const img = feedImgRefs[idx].current
      if (!img || !img.naturalWidth) return

      const hidden = document.createElement('canvas')
      hidden.width  = img.naturalWidth  || 640
      hidden.height = img.naturalHeight || 480
      const hctx = hidden.getContext('2d')
      if (!hctx) return

      hctx.drawImage(img, 0, 0, hidden.width, hidden.height)
      const b64 = hidden.toDataURL('image/jpeg', 0.7)

      inFlight[idx] = true
      try {
        const res = await fetch(DETECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: b64, force_mode: forceModeRef.current === 'auto' ? null : forceModeRef.current }),
        })
        if (!res.ok || cancelled) return
        const data: DetectResponse = await res.json()

        drawOverlayOnFeed(data.detections, hidden.width, hidden.height,
          feedCanvasRefs[idx] as React.RefObject<HTMLCanvasElement>,
          feedImgRefs[idx]    as React.RefObject<HTMLImageElement>)

        setInferenceMs(data.inference_time_ms)
        setTotalFrames((n) => n + 1)
        if (idx === 0) {
          if (data.mode)               setDetectMode(data.mode)
          if (data.brightness != null) setBrightness(data.brightness)
        }
        if (data.detections.length > 0) {
          if (data.annotated_frame) setLatestFrame(data.annotated_frame)
          if (idx === 0) { setCanvasFlash(true); setTimeout(() => setCanvasFlash(false), 300) }
          const newEntries: Detection[] = data.detections.map((d) => ({
            id:         d.id,
            class:      d.class,
            confidence: d.confidence,
            bbox:       [d.bbox.x, d.bbox.y, d.bbox.w, d.bbox.h] as [number,number,number,number],
            timestamp:  new Date(d.timestamp).toLocaleTimeString('en-PH', { hour12: false }),
            feed:       feedLabels[idx],
          }))
          setDetections((prev) => {
            const next = prev.concat(newEntries)
            return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next
          })
        }
      } catch { /* ignore */ } finally {
        inFlight[idx] = false
      }
    }

    // Cycle through feeds every 800ms — skips a feed if its request is still in-flight
    const t = setInterval(() => {
      if (cancelled) return
      runFeed(2)  // feed3 only
    }, 800)

    return () => { cancelled = true; clearInterval(t) }
  }, [detecting, drawOverlayOnFeed])

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60)
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  const statusDot =
    feedStatus === 'ACTIVE'     ? 'bg-green-400 animate-pulse' :
    feedStatus === 'CONNECTING' ? 'bg-yellow-400 animate-pulse' :
                                  'bg-alert'
  const statusText =
    feedStatus === 'ACTIVE'     ? 'text-green-400' :
    feedStatus === 'CONNECTING' ? 'text-yellow-400' :
                                  'text-alert'

  return (
    <div className="h-full flex flex-col p-2 gap-2 overflow-hidden">

      {/* ── Top status bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 panel px-3 py-1.5 flex-shrink-0 flex-wrap text-[11px]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span className={`font-mono text-xs font-bold ${statusText}`}>
            DRONE FEED · {feedStatus}
          </span>
        </div>
        <span className="text-white/20 font-mono text-xs">|</span>
        <span className="font-mono text-xs text-white/60">
          SOURCE: <span className="text-cyan uppercase">{streamSource}</span>
        </span>
        <span className="text-white/20 font-mono text-xs">|</span>
        <span className="font-mono text-xs text-white/60">
          INCIDENT: <span className="text-cyan">TY-ODETTE-001</span>
        </span>
        <span className="text-white/20 font-mono text-xs">|</span>
        <span className="font-mono text-xs text-white/60">
          ELAPSED: <span className="text-white">{formatElapsed(elapsedSec)}</span>
        </span>
        <span className="text-white/20 font-mono text-xs">|</span>
        <span className="font-mono text-xs">
          <span className="text-white/60">DETECTIONS: </span>
          <span className={`font-bold ${detections.length > 0 ? 'text-alert' : 'text-white/40'}`}>
            {detections.length}
          </span>
        </span>
        {inferenceMs !== null && (
          <>
            <span className="text-white/20 font-mono text-xs">|</span>
            <span className={`font-mono text-xs font-bold ${
              inferenceMs > 2000 ? 'text-alert' : inferenceMs > 1000 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              AI: {Math.round(inferenceMs)}ms
            </span>
          </>
        )}
        <span className="text-white/20 font-mono text-xs">|</span>
        <span className="font-mono text-xs text-white/40">FRAMES: {totalFrames}</span>

        {modelsStatus && (
          <div className="ml-auto flex items-center gap-2">
            <ModelPill
              label="VICTIM"
              info={modelsStatus.victim_model}
              metric={modelsStatus.victim_model.map50 != null
                ? `mAP ${modelsStatus.victim_model.map50.toFixed(2)}`
                : undefined}
            />
            <ModelPill
              label="DAMAGE"
              info={modelsStatus.damage_model}
              metric={modelsStatus.damage_model.accuracy != null
                ? `ACC ${modelsStatus.damage_model.accuracy.toFixed(2)}`
                : undefined}
            />
          </div>
        )}
        <div className={`font-mono text-xs text-white/30 ${modelsStatus ? '' : 'ml-auto'}`}>
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ── 3-column main layout ────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[220px_1fr_260px] gap-2 min-h-0 overflow-hidden">

        {/* Left: feed source info */}
        <div className="panel flex flex-col min-h-0">
          <div className="panel-header">Drone Feed Source</div>
          <div className="p-2 flex flex-col gap-2 overflow-y-auto flex-1">
            {/* Buttons first — always visible */}
            <div className="space-y-2">
              <button
                onClick={() => setDetecting((d) => !d)}
                className={detecting ? 'btn-ghost w-full text-xs' : 'btn-primary w-full text-xs'}
              >
                {detecting ? '⏹ STOP DETECTION' : '▶ START DETECTION'}
              </button>
              <button
                onClick={() => { setDetections([]); setInferenceMs(null); setTotalFrames(0) }}
                className="btn-ghost w-full text-xs"
              >
                ↺ CLEAR LOG
              </button>
              <button
                onClick={() => {
                  if (detections.length === 0) return
                  const rows = [
                    ['ID', 'Class', 'Confidence', 'BBox X', 'BBox Y', 'BBox W', 'BBox H', 'Timestamp'],
                    ...detections.map((d) => [
                      d.id, d.class, (d.confidence * 100).toFixed(1) + '%',
                      d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3], d.timestamp,
                    ]),
                  ]
                  const csv  = rows.map((r) => r.join(',')).join('\n')
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href     = url
                  a.download = `rescueeye_detections_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={detections.length === 0}
                className="btn-ghost w-full text-xs disabled:opacity-30"
              >
                ↓ EXPORT CSV
              </button>

              {/* Sensor mode toggle */}
              <div className="bg-panel-light rounded p-2 space-y-1">
                <p className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Sensor Mode</p>
                <div className="flex gap-1">
                  {(['auto', 'visual', 'thermal'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setForceMode(m)}
                      className={`flex-1 text-[10px] font-mono font-bold py-1 rounded transition-all ${
                        forceMode === m
                          ? m === 'thermal'
                            ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/50'
                            : m === 'visual'
                            ? 'bg-cyan/20 text-cyan border border-cyan/50'
                            : 'bg-white/10 text-white border border-white/20'
                          : 'text-white/30 hover:text-white/60'
                      }`}
                    >
                      {m === 'auto' ? 'AUTO' : m === 'visual' ? '👁' : '🌡'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-panel-light rounded p-3 space-y-2">
              {[
                ['DRONE ID',  'UAV-ALPHA-01'],
                ['ALTITUDE',  '120 m AGL'],
                ['SPEED',     '8.4 m/s'],
                ['BATTERY',   '74%'],
                ['SIGNAL',    'STRONG'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="font-mono text-xs text-white/50">{k}</span>
                  <span className={`font-mono text-xs ${
                    k === 'BATTERY' || k === 'SIGNAL' ? 'text-green-400' : 'text-cyan'
                  }`}>{v}</span>
                </div>
              ))}
            </div>

            <div className="bg-panel-light rounded p-3 space-y-1">
              <p className="font-mono text-xs text-white/50 mb-1">AI MODEL</p>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-white/50">ENGINE</span>
                <span className="font-mono text-xs text-cyan">
                  {modelsStatus?.victim_model.is_custom ? 'YOLO11s · ONNX' : 'YOLO11s · pretrained'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs text-white/50">VERSION</span>
                <span className="font-mono text-xs text-cyan">
                  {modelsStatus?.victim_model.version ?? '—'}
                </span>
              </div>
              {modelsStatus?.victim_model.map50 != null && (
                <div className="flex justify-between">
                  <span className="font-mono text-xs text-white/50">mAP@0.5</span>
                  <span className="font-mono text-xs text-green-400">
                    {modelsStatus.victim_model.map50.toFixed(3)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-mono text-xs text-white/50">LATENCY</span>
                <span className={`font-mono text-xs font-bold ${
                  inferenceMs == null  ? 'text-white/30'   :
                  inferenceMs > 2000   ? 'text-alert'      :
                  inferenceMs > 1000   ? 'text-yellow-400' :
                                         'text-green-400'
                }`}>
                  {inferenceMs != null ? `${Math.round(inferenceMs)} ms` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Feed 3 — single active feed */}
        <div className="min-h-0 overflow-hidden">

          <div className="panel flex flex-col h-full min-h-0 overflow-hidden">
            <div className="panel-header flex justify-between items-center flex-shrink-0 !py-1 !text-[10px]">
              <span>FEED 3 · AERIAL</span>
              <span className="text-cyan/50 normal-case font-normal">{detecting ? 'RUNNING' : 'ACTIVE'}</span>
            </div>
            <div
              className="flex-1 min-h-0 relative bg-black rounded-b overflow-hidden"
              style={canvasFlash ? { boxShadow: '0 0 0 2px #00d4ff, 0 0 12px rgba(0,212,255,0.4)' } : undefined}
            >
              <img ref={imgRef3} src={STREAM_URL_3} alt="feed 3" className="w-full h-full object-contain"
                onLoad={() => setFeedStatus('ACTIVE')}
                onError={() => { const i = imgRef3.current; if (i) setTimeout(() => { i.src = `${STREAM_URL_3}?r=${Date.now()}` }, 2000) }}
              />
              <canvas ref={overlayCanvasRef3} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div className="absolute top-1.5 left-1.5 font-mono text-[9px] pointer-events-none flex items-center gap-1">
                {detecting ? <span className="text-alert animate-pulse">● REC</span> : <span className="text-cyan/60">● ACTIVE</span>}
                {detecting && (
                  <span className={`px-1 rounded text-[8px] font-bold ${detectMode === 'thermal' ? 'bg-yellow-400/20 text-yellow-300' : 'bg-cyan/10 text-cyan/70'}`}>
                    {detectMode === 'thermal' ? '🌡' : '👁'}
                  </span>
                )}
              </div>
              {brightness !== null && (
                <div className="absolute bottom-1.5 right-1.5 font-mono text-[9px] pointer-events-none flex items-center gap-1">
                  <div className="w-10 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${brightness < 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min((brightness / 255) * 100, 100)}%` }} />
                  </div>
                  <span className={brightness < 60 ? 'text-yellow-300' : 'text-white/40'}>{Math.round(brightness)}</span>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 font-mono text-[9px] text-white/25 pointer-events-none">CAM-3</div>
            </div>
          </div>

        </div>

        {/* Right: detection log + incident panel */}
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <DetectionLog
              detections={detections}
              latestFrame={latestFrame}
              onClear={() => { setDetections([]); setTotalFrames(0); setLatestFrame(null) }}
            />
          </div>
          <div className="flex-shrink-0">
            <IncidentPanel />
          </div>
        </div>
      </div>


    </div>
  )
}

const INCIDENT_COLORS: Record<string, string> = {
  VICTIM_DETECTED: 'text-alert',
  FIRE:            'text-orange-400',
  FLOOD:           'text-cyan',
  STRUCTURAL:      'text-yellow-400',
  UNKNOWN:         'text-white/40',
}

function IncidentPanel() {
  const [incidents, setIncidents] = useState<Array<{
    id: string; type: string; severity: string; description: string; createdAt: string; status: string
  }>>([])

  useEffect(() => {
    async function poll() {
      try {
        const r = await fetch('/server/incidents')
        if (r.ok) setIncidents(await r.json())
      } catch { /* node server offline */ }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="panel flex flex-col overflow-hidden" style={{ maxHeight: '180px' }}>
      <div className="panel-header flex items-center justify-between">
        <span>Incidents</span>
        <span className={`font-mono text-xs font-bold ${incidents.length > 0 ? 'text-alert' : 'text-white/30'}`}>
          {incidents.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {incidents.length === 0 ? (
          <p className="text-white/30 text-xs font-mono text-center mt-4">— no incidents —</p>
        ) : (
          [...incidents].reverse().map((inc) => (
            <div key={inc.id} className="bg-panel-light border border-white/5 rounded p-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`font-mono text-xs font-bold uppercase ${INCIDENT_COLORS[inc.type] ?? 'text-white'}`}>
                  {inc.type.replace('_', ' ')}
                </span>
                <span className={`font-mono text-[10px] px-1 rounded ${
                  inc.severity === 'HIGH' || inc.severity === 'CRITICAL'
                    ? 'bg-alert/20 text-alert' : 'bg-yellow-400/10 text-yellow-400'
                }`}>{inc.severity}</span>
              </div>
              <p className="font-mono text-[10px] text-white/50 truncate">{inc.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ModelPill({ label, info, metric }: {
  label:  string
  info:   ModelInfo
  metric?: string
}) {
  if (!info.loaded) {
    return (
      <span className="font-mono text-xs px-2 py-0.5 rounded border border-white/10 text-white/20">
        {label}: OFFLINE
      </span>
    )
  }
  const isCustom = info.is_custom
  const version  = info.version === 'custom_v1'      ? 'custom_v1' :
                   info.version === 'pretrained_coco' ? 'COCO'      : info.version
  return (
    <span
      className={`font-mono text-xs px-2 py-0.5 rounded border flex items-center gap-1 ${
        isCustom
          ? 'bg-green-500/10 border-green-500/40 text-green-300'
          : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300'
      }`}
      title={`Weights: ${info.weights}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isCustom ? 'bg-green-400' : 'bg-yellow-400'}`} />
      {label}: {version}
      {metric && <span className="text-white/50 ml-1">| {metric}</span>}
    </span>
  )
}
