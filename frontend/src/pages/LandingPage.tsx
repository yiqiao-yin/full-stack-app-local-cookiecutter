import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'

export default function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard')
    }
  }, [navigate])

  return (
    <div className="landing">
      <div className="landing-hero">
        <h1>StockView</h1>
        <p>Search any ticker. See the chart. It's that simple.</p>
      </div>
      <AuthForm onSuccess={() => navigate('/dashboard')} />
    </div>
  )
}
