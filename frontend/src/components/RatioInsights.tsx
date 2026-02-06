interface MetricRating {
  score: number | null
  label: string
  color: string
  explanation: string
}

interface InsightsData {
  metrics: Record<string, MetricRating>
  overallScore: number
  overallLabel: string
  overallSummary: string
}

interface Ratios {
  trailingPE: number | null
  forwardPE: number | null
  trailingPegRatio: number | null
  trailingEps: number | null
  forwardEps: number | null
  priceToBook: number | null
  debtToEquity: number | null
  beta: number | null
}

interface Financials {
  marketCap: number | null
  totalRevenue: number | null
  revenueGrowth: number | null
  profitMargins: number | null
  operatingMargins: number | null
  grossMargins: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
}

interface RatioInsightsProps {
  insights: InsightsData
  ratios: Ratios
  financials: Financials
}

const COLOR_MAP: Record<string, string> = {
  green: '#26a69a',
  'yellow-green': '#66bb6a',
  yellow: '#f0ad4e',
  orange: '#e67e22',
  red: '#ef5350',
  gray: '#8b949e',
}

function getColor(color: string): string {
  return COLOR_MAP[color] || COLOR_MAP.gray
}

function getOverallColor(score: number): string {
  if (score >= 75) return COLOR_MAP.green
  if (score >= 60) return COLOR_MAP['yellow-green']
  if (score >= 45) return COLOR_MAP.yellow
  if (score >= 30) return COLOR_MAP.orange
  return COLOR_MAP.red
}

function fmt(val: number | null, suffix = ''): string {
  if (val === null || val === undefined) return 'N/A'
  return `${val}${suffix}`
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return 'N/A'
  return `${(val * 100).toFixed(1)}%`
}

const VALUATION_METRICS: { key: string; label: string; rawKey: string; source: 'ratios' | 'financials'; pct?: boolean }[] = [
  { key: 'trailingPE', label: 'P/E (TTM)', rawKey: 'trailingPE', source: 'ratios' },
  { key: 'forwardPE', label: 'P/E (Fwd)', rawKey: 'forwardPE', source: 'ratios' },
  { key: 'pegRatio', label: 'PEG', rawKey: 'trailingPegRatio', source: 'ratios' },
  { key: 'priceToBook', label: 'P/B', rawKey: 'priceToBook', source: 'ratios' },
  { key: 'debtToEquity', label: 'D/E', rawKey: 'debtToEquity', source: 'ratios' },
  { key: 'beta', label: 'Beta', rawKey: 'beta', source: 'ratios' },
]

const PERFORMANCE_METRICS: { key: string; label: string; rawKey: string; source: 'ratios' | 'financials'; pct?: boolean }[] = [
  { key: 'profitMargins', label: 'Profit Margin', rawKey: 'profitMargins', source: 'financials', pct: true },
  { key: 'revenueGrowth', label: 'Rev Growth', rawKey: 'revenueGrowth', source: 'financials', pct: true },
  { key: 'returnOnEquity', label: 'ROE', rawKey: 'returnOnEquity', source: 'financials', pct: true },
  { key: 'returnOnAssets', label: 'ROA', rawKey: 'returnOnAssets', source: 'financials', pct: true },
]

function MetricRow({
  metricKey,
  label,
  rawValue,
  rating,
  isPct,
}: {
  metricKey: string
  label: string
  rawValue: number | null
  rating: MetricRating | undefined
  isPct?: boolean
}) {
  const score = rating?.score
  const color = rating ? getColor(rating.color) : COLOR_MAP.gray
  const displayVal = isPct ? fmtPct(rawValue) : fmt(rawValue)
  const gaugeWidth = score !== null && score !== undefined ? score * 10 : 0

  return (
    <div className="metric-row" key={metricKey}>
      <span className="metric-name">{label}</span>
      <span className="metric-raw-value">{displayVal}</span>
      <div className="mini-gauge-track">
        <div
          className="mini-gauge-fill"
          style={{ width: `${gaugeWidth}%`, backgroundColor: color }}
        />
      </div>
      <span className="rating-badge" style={{ borderColor: color, color }}>
        {rating?.label || 'N/A'}
      </span>
      {rating?.explanation && (
        <div className="metric-tooltip">{rating.explanation}</div>
      )}
    </div>
  )
}

export default function RatioInsights({ insights, ratios, financials }: RatioInsightsProps) {
  const overallColor = getOverallColor(insights.overallScore)
  // Semicircle rotation: 0 = left, 180 = right. Map 0-100 score to 0-180deg.
  const gaugeRotation = (insights.overallScore / 100) * 180

  const getRawValue = (source: 'ratios' | 'financials', rawKey: string): number | null => {
    const obj = source === 'ratios' ? ratios : financials
    return (obj as any)[rawKey] ?? null
  }

  return (
    <div className="ratio-insights">
      {/* Overall Health Gauge */}
      <div className="info-section">
        <div className="info-section-title">AI Financial Analysis</div>
        <div className="overall-gauge">
          <div className="gauge-semicircle">
            <div className="gauge-mask">
              <div
                className="gauge-fill"
                style={{
                  backgroundColor: overallColor,
                  transform: `rotate(${gaugeRotation}deg)`,
                }}
              />
            </div>
            <div className="gauge-center">
              <span className="gauge-score">{insights.overallScore}</span>
              <span className="gauge-max">/100</span>
            </div>
          </div>
          <div className="gauge-label" style={{ color: overallColor }}>
            {insights.overallLabel}
          </div>
        </div>
        <p className="overall-summary">{insights.overallSummary}</p>
      </div>

      {/* Valuation Metrics */}
      <div className="info-section">
        <div className="info-section-title">Valuation Metrics</div>
        {VALUATION_METRICS.map((m) => (
          <MetricRow
            key={m.key}
            metricKey={m.key}
            label={m.label}
            rawValue={getRawValue(m.source, m.rawKey)}
            rating={insights.metrics[m.key]}
            isPct={m.pct}
          />
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="info-section">
        <div className="info-section-title">Performance Metrics</div>
        {PERFORMANCE_METRICS.map((m) => (
          <MetricRow
            key={m.key}
            metricKey={m.key}
            label={m.label}
            rawValue={getRawValue(m.source, m.rawKey)}
            rating={insights.metrics[m.key]}
            isPct={m.pct}
          />
        ))}
      </div>

      <div className="powered-by">Powered by Claude</div>
    </div>
  )
}
