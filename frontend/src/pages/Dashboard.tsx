import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import Navbar from '../components/Navbar'
import CandlestickChart from '../components/CandlestickChart'
import StockInfoPanel from '../components/StockInfoPanel'
import AnalystWidget from '../components/AnalystWidget'
import { fetchStock, fetchStockInfo, fetchStockInsights } from '../services/api'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function Dashboard() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<any[]>([])
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchedTicker, setSearchedTicker] = useState('')
  const [insights, setInsights] = useState<any>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const driverRef = useRef<ReturnType<typeof driver> | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/')
    }
    return () => {
      driverRef.current?.destroy()
    }
  }, [navigate])

  // Core search logic extracted for reuse by copilot action
  const performSearch = useCallback(async (searchTicker: string) => {
    if (!searchTicker.trim()) return

    setLoading(true)
    setError('')
    setData([])
    setInfo(null)
    setInsights(null)
    setInsightsLoading(false)

    try {
      const upperTicker = searchTicker.trim().toUpperCase()
      const [ohlcv, stockInfo] = await Promise.all([
        fetchStock(upperTicker),
        fetchStockInfo(upperTicker).catch(() => null),
      ])
      setData(ohlcv)
      setInfo(stockInfo)
      setSearchedTicker(upperTicker)

      // Fetch AI insights asynchronously (non-blocking)
      setInsightsLoading(true)
      fetchStockInsights(upperTicker)
        .then((insightsData) => {
          setInsights(insightsData)
          setInsightsLoading(false)
        })
        .catch(() => {
          setInsightsLoading(false)
        })
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await performSearch(ticker)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/')
  }

  // ── CopilotKit: expose readable state ──
  useCopilotReadable({
    description: 'The current ticker symbol entered in the search box',
    value: ticker,
  })

  useCopilotReadable({
    description: 'The currently displayed stock ticker (after search)',
    value: searchedTicker,
  })

  useCopilotReadable({
    description: 'Whether stock data is currently loaded and displayed',
    value: data.length > 0 ? `Showing ${data.length} data points for ${searchedTicker}` : 'No stock data loaded',
  })

  useCopilotReadable({
    description: 'The current page the user is on',
    value: 'Dashboard',
  })

  // ── CopilotKit: searchTicker action with Driver.js visual automation ──
  useCopilotAction({
    name: 'searchTicker',
    description: 'Search for a stock ticker symbol. This will visually type the ticker into the search box and click the search button, showing the user what is happening.',
    parameters: [
      {
        name: 'ticker',
        type: 'string',
        description: 'The stock ticker symbol to search for (e.g. AAPL, TSLA, MSFT)',
        required: true,
      },
    ],
    handler: async ({ ticker: tickerParam }: { ticker: string }) => {
      const tickerValue = tickerParam.trim().toUpperCase()

      // Clean up any previous driver instance
      driverRef.current?.destroy()

      const driverObj = driver({
        popoverClass: 'copilot-driver-theme',
        stagePadding: 8,
        stageRadius: 8,
        animate: true,
        allowClose: false,
        overlayOpacity: 0.4,
      })
      driverRef.current = driverObj

      // Step 1: Highlight the input and type letters one by one
      driverObj.highlight({
        element: '#ticker-input',
        popover: {
          title: 'Copilot Action',
          description: `Entering ticker: ${tickerValue}`,
          side: 'bottom',
          align: 'start',
        },
      })

      // Clear existing text
      setTicker('')
      await delay(200)

      // Type each letter with a delay for visual effect
      for (let i = 0; i < tickerValue.length; i++) {
        const partial = tickerValue.substring(0, i + 1)
        setTicker(partial)
        await delay(120)
      }

      await delay(300)

      // Step 2: Move highlight to the search button
      driverObj.highlight({
        element: '#search-button',
        popover: {
          title: 'Copilot Action',
          description: `Searching for ${tickerValue}...`,
          side: 'bottom',
          align: 'start',
        },
      })

      await delay(400)

      // Step 3: Dismiss overlay and trigger the search
      driverObj.destroy()
      driverRef.current = null

      await performSearch(tickerValue)

      return `Successfully searched for ${tickerValue}`
    },
  })

  return (
    <div className="dashboard">
      <Navbar onLogout={handleLogout} />
      <main className="dashboard-content">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            id="ticker-input"
            type="text"
            placeholder="Enter ticker symbol (e.g. AAPL)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
          <button id="search-button" type="submit" disabled={loading}>
            {loading ? 'Loading...' : 'Search'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        {data.length > 0 && (
          <>
            <div className="stock-layout">
              <div className="stock-chart-col">
                <CandlestickChart data={data} ticker={searchedTicker} />
              </div>
              {info && (
                <div className="stock-info-col">
                  <StockInfoPanel info={info} insights={insights} insightsLoading={insightsLoading} />
                </div>
              )}
            </div>
            {info?.analyst && (
              <AnalystWidget analyst={info.analyst} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
