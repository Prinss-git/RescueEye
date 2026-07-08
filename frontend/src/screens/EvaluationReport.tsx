import { useState, useEffect } from 'react'

interface ModelMetrics {
  map50?:              number
  map50_95?:           number
  precision?:          number
  recall?:             number
  f1?:                 number
  accuracy_top1?:      number
  accuracy_top5?:      number
  avg_inference_ms?:   number
  weights?:            string
  per_class_accuracy?: Record<string, number>
}

interface DrillMetrics {
  incidentCount:  number
  messageCount:   number
  teamActions:    number
  detectionCount: number
  avgResponseMs:  number
}

interface LatencyAssertion {
  victim_avg_ms:  number
  damage_avg_ms:  number
  combined_ms:    number
  threshold_ms:   number
  passed:         boolean
}

interface EvalReport {
  type:                    string
  sessionId?:              string
  startedAt?:              string
  stoppedAt?:              string
  durationMs?:             number
  active?:                 boolean
  victim_detection?:       ModelMetrics
  damage_classification?:  ModelMetrics
  latency_assertion?:      LatencyAssertion
  metrics?:                DrillMetrics
  message?:                string
}

function MetricRow({ label, value, pass }: { label: string; value: string; pass?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4 text-xs text-slate-500">{label}</td>
      <td className={`py-2 font-mono text-xs font-semibold ${
        pass === true ? 'text-green-700' : pass === false ? 'text-red-600' : 'text-slate-800'
      }`}>
        {value}
        {pass === true  && <span className="ml-2 text-green-700">✓</span>}
        {pass === false && <span className="ml-2 text-red-600">✗</span>}
      </td>
    </tr>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <h2 className="panel-header">{title}</h2>
      <table className="w-full [&_td]:px-5">{children}</table>
      <div className="pb-2" />
    </div>
  )
}

export default function EvaluationReport() {
  const [report, setReport]   = useState<EvalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/server/evaluation/report')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: EvalReport = await res.json()
        setReport(data)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-slate-400 animate-pulse">Loading evaluation report...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-alert">{error}</p>
      </div>
    )
  }

  if (!report || report.type === 'empty') {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-slate-400">{report?.message ?? 'No report available.'}</p>
      </div>
    )
  }

  const v  = report.victim_detection
  const d  = report.damage_classification
  const la = report.latency_assertion
  const dr = report.metrics

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Evaluation Report</h1>
          <p className="text-sm text-slate-400 mt-1">
            {report.type === 'drill_session' ? 'Drill Session' : 'AI Model Evaluation'}
            {report.sessionId && ` · ${report.sessionId}`}
            {report.startedAt && ` · ${new Date(report.startedAt).toLocaleString()}`}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary text-xs"
        >
          Export PDF
        </button>
      </div>

      {/* Drill session metrics */}
      {dr && (
        <Section title="Drill Session Metrics">
          <tbody>
            <MetricRow label="Incidents Generated"  value={String(dr.incidentCount)} />
            <MetricRow label="Messages Sent"        value={String(dr.messageCount)} />
            <MetricRow label="Team Actions"         value={String(dr.teamActions)} />
            <MetricRow label="AI Detections"        value={String(dr.detectionCount)} />
            <MetricRow label="Avg Response Time"    value={dr.avgResponseMs ? `${dr.avgResponseMs} ms` : '—'} />
            {report.durationMs && (
              <MetricRow label="Session Duration" value={`${Math.round(report.durationMs / 1000)}s`} />
            )}
          </tbody>
        </Section>
      )}

      {/* Victim detection */}
      {v && Object.keys(v).length > 0 && (
        <Section title="Victim Detection — YOLOv8">
          <tbody>
            <MetricRow label="mAP@0.5"            value={v.map50           != null ? v.map50.toFixed(4)           : '—'} pass={v.map50 != null ? v.map50 >= 0.70 : undefined} />
            <MetricRow label="mAP@0.5:0.95"       value={v.map50_95        != null ? v.map50_95.toFixed(4)        : '—'} />
            <MetricRow label="Precision"          value={v.precision       != null ? v.precision.toFixed(4)       : '—'} />
            <MetricRow label="Recall"             value={v.recall          != null ? v.recall.toFixed(4)          : '—'} />
            <MetricRow label="F1"                 value={v.f1              != null ? v.f1.toFixed(4)              : '—'} />
            <MetricRow label="Avg Inference"      value={v.avg_inference_ms != null ? `${v.avg_inference_ms} ms`  : '—'} />
            <MetricRow label="Weights"            value={v.weights ?? '—'} />
          </tbody>
        </Section>
      )}

      {/* Damage classification */}
      {d && Object.keys(d).length > 0 && (
        <Section title="Damage Classification — YOLOv8-CLS">
          <tbody>
            <MetricRow label="Top-1 Accuracy"     value={d.accuracy_top1   != null ? d.accuracy_top1.toFixed(4)  : '—'} pass={d.accuracy_top1 != null ? d.accuracy_top1 >= 0.75 : undefined} />
            <MetricRow label="Top-5 Accuracy"     value={d.accuracy_top5   != null ? d.accuracy_top5.toFixed(4)  : '—'} />
            <MetricRow label="Avg Inference"      value={d.avg_inference_ms != null ? `${d.avg_inference_ms} ms` : '—'} />
            <MetricRow label="Weights"            value={d.weights ?? '—'} />
          </tbody>
        </Section>
      )}

      {/* Per-class accuracy */}
      {d?.per_class_accuracy && Object.keys(d.per_class_accuracy).length > 0 && (
        <Section title="Damage — Per-Class Accuracy">
          <tbody>
            {Object.entries(d.per_class_accuracy).map(([cls, acc]) => (
              <MetricRow key={cls} label={cls} value={(acc as number).toFixed(4)} pass={(acc as number) >= 0.75} />
            ))}
          </tbody>
        </Section>
      )}

      {/* Latency assertion */}
      {la && (
        <Section title="Latency Assertion — Objective 6">
          <tbody>
            <MetricRow label="Victim Detection Avg"       value={`${la.victim_avg_ms} ms`} />
            <MetricRow label="Damage Classification Avg"  value={`${la.damage_avg_ms} ms`} />
            <MetricRow label="Combined"                   value={`${la.combined_ms} ms`} />
            <MetricRow label="Threshold"                  value={`${la.threshold_ms} ms`} />
            <MetricRow label="Result"                     value={la.passed ? 'Pass' : 'Fail'} pass={la.passed} />
          </tbody>
        </Section>
      )}

      <p className="text-xs text-slate-300 text-center pb-4">
        RescueEye — University of Cebu Banilad Campus · Generated {new Date().toLocaleString()}
      </p>
    </div>
  )
}
