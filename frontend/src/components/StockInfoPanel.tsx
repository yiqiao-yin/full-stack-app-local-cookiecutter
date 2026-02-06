import { useState } from 'react'
import RatioInsights from './RatioInsights'

interface StockInfo {
  profile: {
    longName: string
    symbol: string
    sector: string
    industry: string
    website: string | null
    fullTimeEmployees: number | null
    longBusinessSummary: string
  }
  price: {
    currentPrice: number | null
    previousClose: number | null
    dayHigh: number | null
    dayLow: number | null
    fiftyTwoWeekHigh: number | null
    fiftyTwoWeekLow: number | null
  }
  ratios: {
    trailingPE: number | null
    forwardPE: number | null
    trailingPegRatio: number | null
    trailingEps: number | null
    forwardEps: number | null
    priceToBook: number | null
    debtToEquity: number | null
    beta: number | null
  }
  financials: {
    marketCap: number | null
    totalRevenue: number | null
    revenueGrowth: number | null
    profitMargins: number | null
    operatingMargins: number | null
    grossMargins: number | null
    returnOnEquity: number | null
    returnOnAssets: number | null
  }
  dividends: {
    dividendRate: number | null
    dividendYield: number | null
    payoutRatio: number | null
  }
}

interface StockInfoPanelProps {
  info: StockInfo
  insights?: any
  insightsLoading?: boolean
}

function fmt(val: number | null, suffix = ''): string {
  if (val === null || val === undefined) return 'N/A'
  return `${val}${suffix}`
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return 'N/A'
  return `${(val * 100).toFixed(1)}%`
}

function fmtLarge(val: number | null): string {
  if (val === null || val === undefined) return 'N/A'
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
  return `$${val.toLocaleString()}`
}

export default function StockInfoPanel({ info, insights, insightsLoading }: StockInfoPanelProps) {
  const [aboutOpen, setAboutOpen] = useState(false)
  const { profile, price, ratios, financials, dividends } = info

  const changeVal = price.currentPrice && price.previousClose
    ? price.currentPrice - price.previousClose
    : null
  const changePct = changeVal && price.previousClose
    ? (changeVal / price.previousClose) * 100
    : null
  const isUp = changeVal !== null && changeVal >= 0

  // 52-week range bar
  const rangePosition = price.currentPrice && price.fiftyTwoWeekLow && price.fiftyTwoWeekHigh
    ? ((price.currentPrice - price.fiftyTwoWeekLow) / (price.fiftyTwoWeekHigh - price.fiftyTwoWeekLow)) * 100
    : null

  return (
    <div className="info-panel">
      {/* Header */}
      <div className="info-header">
        <div className="info-name">{profile.longName}</div>
        <div className="info-symbol">{profile.symbol}</div>
        {price.currentPrice && (
          <div className="info-price-row">
            <span className="info-current-price">${price.currentPrice.toFixed(2)}</span>
            {changeVal !== null && changePct !== null && (
              <span className={`info-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '+' : ''}{changeVal.toFixed(2)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* About */}
      <div className="info-section">
        <div className="info-section-title clickable" onClick={() => setAboutOpen(!aboutOpen)}>
          About {aboutOpen ? '▾' : '▸'}
        </div>
        <p className={`info-summary ${aboutOpen ? 'open' : ''}`}>
          {profile.longBusinessSummary}
        </p>
      </div>

      {/* Profile */}
      <div className="info-section">
        <div className="info-section-title">Profile</div>
        <div className="info-grid">
          <div className="info-label">Sector</div><div className="info-value">{profile.sector}</div>
          <div className="info-label">Industry</div><div className="info-value">{profile.industry}</div>
          {profile.fullTimeEmployees && (
            <><div className="info-label">Employees</div><div className="info-value">{profile.fullTimeEmployees.toLocaleString()}</div></>
          )}
          {profile.website && (
            <><div className="info-label">Website</div><div className="info-value"><a href={profile.website} target="_blank" rel="noreferrer">{profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></div></>
          )}
        </div>
      </div>

      {/* Key Ratios & Financials — replaced by AI insights when available */}
      {insights ? (
        <RatioInsights insights={insights} ratios={ratios} financials={financials} />
      ) : (
        <>
          {/* Key Ratios */}
          <div className="info-section">
            <div className="info-section-title">Key Ratios</div>
            <div className="info-grid">
              <div className="info-label">P/E (TTM)</div><div className="info-value">{fmt(ratios.trailingPE)}</div>
              <div className="info-label">P/E (Fwd)</div><div className="info-value">{fmt(ratios.forwardPE)}</div>
              <div className="info-label">PEG</div><div className="info-value">{fmt(ratios.trailingPegRatio)}</div>
              <div className="info-label">EPS (TTM)</div><div className="info-value">{fmt(ratios.trailingEps)}</div>
              <div className="info-label">EPS (Fwd)</div><div className="info-value">{fmt(ratios.forwardEps)}</div>
              <div className="info-label">P/B</div><div className="info-value">{fmt(ratios.priceToBook)}</div>
              <div className="info-label">D/E</div><div className="info-value">{fmt(ratios.debtToEquity)}</div>
              <div className="info-label">Beta</div><div className="info-value">{fmt(ratios.beta)}</div>
            </div>
          </div>

          {/* Financials */}
          <div className="info-section">
            <div className="info-section-title">Financials</div>
            <div className="info-grid">
              <div className="info-label">Market Cap</div><div className="info-value">{fmtLarge(financials.marketCap)}</div>
              <div className="info-label">Revenue</div><div className="info-value">{fmtLarge(financials.totalRevenue)}</div>
              <div className="info-label">Rev Growth</div><div className="info-value">{fmtPct(financials.revenueGrowth)}</div>
              <div className="info-label">Profit Margin</div><div className="info-value">{fmtPct(financials.profitMargins)}</div>
              <div className="info-label">Op Margin</div><div className="info-value">{fmtPct(financials.operatingMargins)}</div>
              <div className="info-label">Gross Margin</div><div className="info-value">{fmtPct(financials.grossMargins)}</div>
              <div className="info-label">ROE</div><div className="info-value">{fmtPct(financials.returnOnEquity)}</div>
              <div className="info-label">ROA</div><div className="info-value">{fmtPct(financials.returnOnAssets)}</div>
            </div>
          </div>

          {/* Insights loading spinner */}
          {insightsLoading && (
            <div className="insights-loading">
              <div className="insights-loading-spinner" />
              <span>Analyzing ratios with AI...</span>
            </div>
          )}
        </>
      )}

      {/* Dividends */}
      {dividends.dividendRate && (
        <div className="info-section">
          <div className="info-section-title">Dividends</div>
          <div className="info-grid">
            <div className="info-label">Rate</div><div className="info-value">${dividends.dividendRate}</div>
            <div className="info-label">Yield</div><div className="info-value">{fmtPct(dividends.dividendYield)}</div>
            <div className="info-label">Payout Ratio</div><div className="info-value">{fmtPct(dividends.payoutRatio)}</div>
          </div>
        </div>
      )}

      {/* 52-Week Range */}
      {rangePosition !== null && (
        <div className="info-section">
          <div className="info-section-title">52-Week Range</div>
          <div className="range-bar-container">
            <span className="range-label">${price.fiftyTwoWeekLow?.toFixed(2)}</span>
            <div className="range-bar">
              <div className="range-fill" style={{ width: `${Math.min(Math.max(rangePosition, 0), 100)}%` }} />
            </div>
            <span className="range-label">${price.fiftyTwoWeekHigh?.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
