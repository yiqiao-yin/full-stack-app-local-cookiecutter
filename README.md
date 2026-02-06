# StockView — Full-Stack Local Cookiecutter

A self-hosted, dockerized web application for searching stock tickers, viewing candlestick charts with moving average overlays, and exploring company fundamentals and analyst sentiment. Now includes **AI-powered ratio insights** via the Claude API that evaluate financial metrics relative to sector/industry norms. Built as a school-project-grade template that runs entirely on your local machine — no cloud setup required.

## Quick Start

```bash
# 1. Set your Claude API key (optional — app works without it)
cp .env.example .env
# Edit .env and set CLAUDE_API_KEY=sk-ant-...

# 2. Build and run
docker compose -f deployment/docker-compose.yml up --build -d
```

Then open **http://localhost:3001** in your browser.

## What It Does

1. **Register / Login** — Create an account on the dark-themed landing page.
2. **Search a Ticker** — Enter a stock symbol (e.g. `AAPL`, `MSFT`, `TSLA`).
3. **View Candlestick Chart** — The app fetches 1 year of daily OHLCV data from Yahoo Finance and renders an interactive Plotly candlestick chart with **20/50/200-day SMA overlays**.
4. **Explore Company Info** — A sidebar panel shows company profile, key ratios (P/E, PEG, EPS, P/B, D/E, Beta), financials (market cap, revenue, margins, ROE, ROA), dividends, and a 52-week range bar.
5. **AI Ratio Insights** — When a Claude API key is configured, the app asynchronously analyzes 10 financial ratios relative to the stock's sector and industry. The Key Ratios and Financials sections transform into an AI-powered view with:
   - An **overall health gauge** (0-100 score) with color-coded rating
   - **Valuation metrics** (P/E TTM, P/E Fwd, PEG, P/B, D/E, Beta) with mini gauge bars and rated badges
   - **Performance metrics** (Profit Margin, Revenue Growth, ROE, ROA) in the same format
   - **Hover tooltips** with Claude's 1-sentence explanation for each metric
   - Results are cached for 1 hour per ticker to minimize API costs
6. **Analyst Sentiment** — A widget below the chart displays analyst recommendation breakdown (strongBuy → strongSell stacked bar), price target range, and consensus rating.

## Architecture

```
Browser ──► Nginx (:3001) ──► FastAPI (:8001) ──► Yahoo Finance API
             │                    │                     │
             │ static React SPA   │ CSV user store      ▼
             │ reverse proxy /api │ JWT auth        Claude API
             │                    │               (async insights)
```

Two Docker containers orchestrated by Docker Compose:

| Container | Tech | Host Port |
|-----------|------|-----------|
| `stock-frontend` | React 18 + TypeScript + Vite, served by Nginx | `3001` |
| `stock-backend` | Python 3.11, FastAPI, yfinance, anthropic | `8001` |

## Project Structure

```
full-stack-app-local-cookiecutter/
├── README.md
├── .env                       # Claude API key (gitignored)
├── .gitignore
├── backend/                   # FastAPI backend service
│   ├── Dockerfile
│   ├── requirements.txt       # Includes anthropic SDK
│   ├── data/                  # CSV user storage (created at runtime)
│   └── app/
│       ├── main.py            # FastAPI app entry point
│       ├── models.py          # Pydantic schemas
│       ├── auth_utils.py      # JWT + bcrypt helpers
│       ├── stock_utils.py     # yfinance wrapper + ticker info + SMA
│       ├── claude_insights.py # Claude API integration, prompt, cache
│       └── routers/
│           ├── auth.py        # POST /api/auth/register, /api/auth/login
│           └── stock.py       # GET  /api/stock/{ticker}, {ticker}/info, {ticker}/insights
├── frontend/                  # React SPA
│   ├── Dockerfile
│   ├── nginx.conf             # Nginx config (SPA fallback + API proxy)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── LandingPage.tsx    # Dark-themed login/register
│       │   └── Dashboard.tsx      # Ticker search + chart + info + analyst + insights
│       ├── components/
│       │   ├── AuthForm.tsx
│       │   ├── CandlestickChart.tsx   # Plotly chart with SMA overlays
│       │   ├── StockInfoPanel.tsx     # Company info, ratios, financials (+ AI overlay)
│       │   ├── RatioInsights.tsx      # AI gauges, badges, tooltips for rated metrics
│       │   ├── AnalystWidget.tsx      # Recommendations + price targets
│       │   └── Navbar.tsx
│       ├── services/
│       │   └── api.ts         # Fetch wrappers for /api/* (includes fetchStockInsights)
│       └── styles/
│           └── global.css     # Dark theme, mobile-adaptive, gauge/badge/tooltip styles
├── deployment/
│   └── docker-compose.yml     # Wires frontend + backend containers, loads .env
└── docs/
    └── CREATE/
        ├── SYSTEM.md                          # System blueprint and design rationale
        └── IMPLEMENT_NEW_STOCK_FEATURES.md    # Implementation plan for stock features
```

## Key Design Decisions

- **CSV for user storage** — No database needed; pandas reads/writes a simple CSV file. Suitable for a local school project.
- **JWT authentication** — Stateless tokens stored in the browser's `localStorage`.
- **Nginx reverse proxy** — The browser only talks to one origin (`localhost:3001`), so no CORS issues. Nginx forwards `/api/*` to the backend.
- **yfinance** — Free Yahoo Finance wrapper, no API key required. Provides OHLCV history, company fundamentals, and analyst data.
- **Claude API for insights** — Evaluates 10 financial ratios relative to sector/industry norms. Loaded asynchronously so the main panel renders instantly. Graceful fallback to raw numbers if the API key is missing or the call fails.
- **1-hour in-memory cache** — Prevents repeated Claude API calls for the same ticker, keeping costs low (~$0.02/call).
- **Dark theme** — GitHub-dark style (`#0d1117` background) with mobile-responsive CSS.
- **Server-side SMA** — Moving averages are computed in the backend via pandas `.rolling()`, keeping the frontend lightweight.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login, returns JWT token |
| `GET` | `/api/stock/{ticker}` | Fetch OHLCV + SMA data (requires auth) |
| `GET` | `/api/stock/{ticker}/info` | Fetch company info, ratios, analyst data (requires auth) |
| `GET` | `/api/stock/{ticker}/insights` | Fetch AI-generated ratio insights from Claude (requires auth) |
| `GET` | `/api/health` | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_API_KEY` | No | Anthropic API key for AI ratio insights. If not set, the app falls back to displaying raw numbers. |
| `SECRET_KEY` | No | JWT signing key. Defaults to a dev-only value. |

## Stopping the App

```bash
docker compose -f deployment/docker-compose.yml down
```
