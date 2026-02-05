import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import CandlestickChart from '../components/CandlestickChart'
import { fetchStock } from '../services/api'

interface StockData {
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  Volume: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState('')
  const [data, setData] = useState<StockData[]>([])
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

    try {
      const result = await fetchStock(ticker.trim().toUpperCase())
      setData(result)
      setSearchedTicker(ticker.trim().toUpperCase())
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
          <CandlestickChart data={data} ticker={searchedTicker} />
        )}
      </main>
    </div>
  )
}
