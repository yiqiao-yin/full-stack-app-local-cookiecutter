import { useState } from 'react'
import { login, register } from '../services/api'

interface AuthFormProps {
  onSuccess: () => void
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const data = await login(username, password)
        localStorage.setItem('token', data.access_token)
        onSuccess()
      } else {
        await register(username, password)
        const data = await login(username, password)
        localStorage.setItem('token', data.access_token)
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button
          className={isLogin ? 'active' : ''}
          onClick={() => { setIsLogin(true); setError('') }}
        >
          Login
        </button>
        <button
          className={!isLogin ? 'active' : ''}
          onClick={() => { setIsLogin(false); setError('') }}
        >
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isLogin ? 'Login' : 'Register'}
        </button>
      </form>
    </div>
  )
}
