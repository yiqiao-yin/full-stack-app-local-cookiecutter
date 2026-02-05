import Plot from 'react-plotly.js'

interface StockData {
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}

interface CandlestickChartProps {
  data: StockData[]
  ticker: string
}

export default function CandlestickChart({ data, ticker }: CandlestickChartProps) {
  return (
    <div className="chart-container">
      <Plot
        data={[
          {
            type: 'candlestick',
            x: data.map((d) => d.Date),
            open: data.map((d) => d.Open),
            high: data.map((d) => d.High),
            low: data.map((d) => d.Low),
            close: data.map((d) => d.Close),
            increasing: { line: { color: '#26a69a' } },
            decreasing: { line: { color: '#ef5350' } },
          },
        ]}
        layout={{
          title: { text: `${ticker} — Candlestick Chart`, font: { color: '#e6edf3' } },
          paper_bgcolor: '#0d1117',
          plot_bgcolor: '#161b22',
          font: { color: '#e6edf3' },
          xaxis: {
            gridcolor: '#30363d',
            rangeslider: { visible: false },
          },
          yaxis: {
            gridcolor: '#30363d',
            title: { text: 'Price (USD)' },
          },
          autosize: true,
          margin: { l: 50, r: 30, t: 50, b: 40 },
        }}
        useResizeHandler
        style={{ width: '100%', height: '500px' }}
        config={{ responsive: true }}
      />
    </div>
  )
}
