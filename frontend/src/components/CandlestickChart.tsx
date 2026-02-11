import Plot from 'react-plotly.js'

interface StockData {
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
  SMA_20: number | null
  SMA_50: number | null
  SMA_200: number | null
}

interface ForecastPoint {
  Date: string
  Price: number
  Upper: number
  Lower: number
}

interface CandlestickChartProps {
  data: StockData[]
  ticker: string
  forecast?: ForecastPoint[] | null
}

export default function CandlestickChart({ data, ticker, forecast }: CandlestickChartProps) {
  const dates = data.map((d) => d.Date)

  const traces: any[] = [
    {
      type: 'candlestick',
      x: dates,
      open: data.map((d) => d.Open),
      high: data.map((d) => d.High),
      low: data.map((d) => d.Low),
      close: data.map((d) => d.Close),
      increasing: { line: { color: '#26a69a' } },
      decreasing: { line: { color: '#ef5350' } },
      name: 'Price',
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: data.map((d) => d.SMA_20),
      name: '20-day SMA',
      line: { color: '#85c1e9', width: 1.5 },
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: data.map((d) => d.SMA_50),
      name: '50-day SMA',
      line: { color: '#3498db', width: 1.5 },
    },
    {
      type: 'scatter',
      mode: 'lines',
      x: dates,
      y: data.map((d) => d.SMA_200),
      name: '200-day SMA',
      line: { color: '#1a5276', width: 2 },
    },
  ]

  if (forecast && forecast.length > 0) {
    const lastClose = data[data.length - 1].Close
    const lastDate = data[data.length - 1].Date

    const forecastDates = [lastDate, ...forecast.map((f) => f.Date)]
    const forecastPrices = [lastClose, ...forecast.map((f) => f.Price)]
    const forecastUpper = [lastClose, ...forecast.map((f) => f.Upper)]
    const forecastLower = [lastClose, ...forecast.map((f) => f.Lower)]

    traces.push(
      {
        type: 'scatter',
        mode: 'lines',
        x: forecastDates,
        y: forecastUpper,
        name: 'Upper CI',
        line: { color: 'rgba(0, 212, 255, 0.4)', width: 1, dash: 'dash' },
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: forecastDates,
        y: forecastLower,
        name: 'Lower CI',
        line: { color: 'rgba(0, 212, 255, 0.4)', width: 1, dash: 'dash' },
        fill: 'tonexty',
        fillcolor: 'rgba(0, 212, 255, 0.1)',
        showlegend: false,
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: forecastDates,
        y: forecastPrices,
        name: '7-day Forecast',
        line: { color: '#00d4ff', width: 2.5 },
      },
    )
  }

  return (
    <div className="chart-container">
      <Plot
        data={traces}
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
          legend: {
            bgcolor: 'rgba(22,27,34,0.8)',
            font: { color: '#e6edf3' },
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
