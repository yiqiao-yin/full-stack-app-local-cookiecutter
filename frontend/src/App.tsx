import { Routes, Route } from 'react-router-dom'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <CopilotKit runtimeUrl="/copilotkit">
      <CopilotSidebar
        labels={{
          title: 'StockView Copilot',
          initial: 'Hi! I can help you search for stock tickers. Try asking me to look up AAPL or TSLA.',
        }}
        defaultOpen={false}
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </CopilotSidebar>
    </CopilotKit>
  )
}

export default App
