import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import CandlestickChart from '../components/CandlestickChart'
import StockInfoPanel from '../components/StockInfoPanel'
import AnalystWidget from '../components/AnalystWidget'
import { fetchStock, fetchStockInfo } from '../services/api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<any[]>([])
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchedTicker, setSearchedTicker] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/')
    }
  }, [navigate])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticker.trim()) return

    setLoading(true)
    setError('')
    setData([])
    setInfo(null)

    try {
      const upperTicker = ticker.trim().toUpperCase()
      const [ohlcv, stockInfo] = await Promise.all([
        fetchStock(upperTicker),
        fetchStockInfo(upperTicker).catch(() => null),
      ])
      setData(ohlcv)
      setInfo(stockInfo)
      setSearchedTicker(upperTicker)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stock data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <div className="dashboard">
      <Navbar onLogout={handleLogout} />
      <main className="dashboard-content">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Enter ticker symbol (e.g. AAPL)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
          <button type="submit" disabled={loading}>
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
                  <StockInfoPanel info={info} />
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
