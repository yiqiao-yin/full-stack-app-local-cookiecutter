const API_BASE = '/api'

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${res.status})`)
  }

  return res.json()
}

export async function register(username: string, password: string) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function login(username: string, password: string) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchStock(ticker: string, period = '6mo', interval = '1d') {
  return request(`/stock/${ticker}?period=${period}&interval=${interval}`)
}
