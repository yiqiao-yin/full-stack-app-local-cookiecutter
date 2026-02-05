interface AnalystData {
  averageRating: string
  priceTargets: {
    current: number | null
    low: number | null
    mean: number | null
    median: number | null
    high: number | null
  }
  recommendations: {
    strongBuy: number
    buy: number
    hold: number
    sell: number
    strongSell: number
  }
}

interface AnalystWidgetProps {
  analyst: AnalystData
}

export default function AnalystWidget({ analyst }: AnalystWidgetProps) {
  const { recommendations, priceTargets, averageRating } = analyst
  const total = recommendations.strongBuy + recommendations.buy + recommendations.hold + recommendations.sell + recommendations.strongSell

  const ratingLabel = averageRating !== 'N/A' ? averageRating.split(' - ')[1] || averageRating : 'N/A'
  const ratingColor =
    ratingLabel === 'Buy' || ratingLabel === 'Strong Buy' ? '#26a69a' :
    ratingLabel === 'Hold' ? '#f0ad4e' :
    ratingLabel === 'Sell' || ratingLabel === 'Strong Sell' ? '#ef5350' : '#8b949e'

  // Price target bar position
  const targetRange = priceTargets.high && priceTargets.low ? priceTargets.high - priceTargets.low : null
  const currentPos = targetRange && priceTargets.current && priceTargets.low
    ? ((priceTargets.current - priceTargets.low) / targetRange) * 100 : null
  const meanPos = targetRange && priceTargets.mean && priceTargets.low
    ? ((priceTargets.mean - priceTargets.low) / targetRange) * 100 : null

  return (
    <div className="analyst-widget">
      <div className="analyst-header">
        <span className="analyst-title">Analyst Consensus</span>
        <span className="analyst-badge" style={{ borderColor: ratingColor, color: ratingColor }}>
          {ratingLabel}
        </span>
      </div>

      {/* Recommendation Bar */}
      {total > 0 && (
        <div className="analyst-section">
          <div className="analyst-label">Recommendations ({total} analysts)</div>
          <div className="rec-bar">
            {recommendations.strongBuy > 0 && (
              <div className="rec-segment strong-buy" style={{ width: `${(recommendations.strongBuy / total) * 100}%` }}>
                {recommendations.strongBuy}
              </div>
            )}
            {recommendations.buy > 0 && (
              <div className="rec-segment buy" style={{ width: `${(recommendations.buy / total) * 100}%` }}>
                {recommendations.buy}
              </div>
            )}
            {recommendations.hold > 0 && (
              <div className="rec-segment hold" style={{ width: `${(recommendations.hold / total) * 100}%` }}>
                {recommendations.hold}
              </div>
            )}
            {recommendations.sell > 0 && (
              <div className="rec-segment sell" style={{ width: `${(recommendations.sell / total) * 100}%` }}>
                {recommendations.sell}
              </div>
            )}
            {recommendations.strongSell > 0 && (
              <div className="rec-segment strong-sell" style={{ width: `${(recommendations.strongSell / total) * 100}%` }}>
                {recommendations.strongSell}
              </div>
            )}
          </div>
          <div className="rec-legend">
            <span className="rec-legend-item"><span className="dot strong-buy" />Strong Buy</span>
            <span className="rec-legend-item"><span className="dot buy" />Buy</span>
            <span className="rec-legend-item"><span className="dot hold" />Hold</span>
            <span className="rec-legend-item"><span className="dot sell" />Sell</span>
            <span className="rec-legend-item"><span className="dot strong-sell" />Strong Sell</span>
          </div>
        </div>
      )}

      {/* Price Target Range */}
      {targetRange && priceTargets.low !== null && priceTargets.high !== null && (
        <div className="analyst-section">
          <div className="analyst-label">Price Target Range</div>
          <div className="target-bar-container">
            <span className="range-label">${priceTargets.low}</span>
            <div className="target-bar">
              {currentPos !== null && (
                <div className="target-marker current" style={{ left: `${Math.min(Math.max(currentPos, 0), 100)}%` }} title={`Current: $${priceTargets.current}`}>
                  <div className="target-marker-line" />
                  <div className="target-marker-label">Current</div>
                </div>
              )}
              {meanPos !== null && (
                <div className="target-marker mean" style={{ left: `${Math.min(Math.max(meanPos, 0), 100)}%` }} title={`Target: $${priceTargets.mean}`}>
                  <div className="target-marker-line" />
                  <div className="target-marker-label">Target</div>
                </div>
              )}
            </div>
            <span className="range-label">${priceTargets.high}</span>
          </div>
          <div className="target-details">
            <span>Low: ${priceTargets.low}</span>
            <span>Mean: ${priceTargets.mean}</span>
            <span>Median: ${priceTargets.median}</span>
            <span>High: ${priceTargets.high}</span>
          </div>
        </div>
      )}
    </div>
  )
}
