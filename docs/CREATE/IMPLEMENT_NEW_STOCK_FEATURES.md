# Implementation Plan: New Stock Features

> **Goal**: After a user searches a ticker, show rich context around the candlestick chart — company info, key financial ratios, moving-average overlays, and analyst sentiment.

---

## Feasibility Summary

All features below have been **verified as available** by running `yfinance` 1.1.0 against a live ticker (`AAPL`). Every data point listed comes directly from `Ticker.info`, `Ticker.recommendations`, or `Ticker.analyst_price_targets`.

| Feature | yfinance Source | Feasible? |
|---------|----------------|-----------|
| Company description | `info["longBusinessSummary"]` | Yes |
| Sector / Industry | `info["sector"]`, `info["industry"]` | Yes |
| Market cap | `info["marketCap"]` | Yes |
| P/E ratio (trailing & forward) | `info["trailingPE"]`, `info["forwardPE"]` | Yes |
| EPS (trailing & forward) | `info["trailingEps"]`, `info["forwardEps"]` | Yes |
| PEG ratio | `info["trailingPegRatio"]` | Yes (occasionally `None`) |
| Dividend yield & rate | `info["dividendYield"]`, `info["dividendRate"]` | Yes |
| 52-week high / low | `info["fiftyTwoWeekHigh"]`, `info["fiftyTwoWeekLow"]` | Yes |
| 50-day moving average | `info["fiftyDayAverage"]` | Yes |
| 200-day moving average | `info["twoHundredDayAverage"]` | Yes |
| Moving averages (custom periods) | Computed from OHLCV history via pandas `.rolling()` | Yes |
| Beta | `info["beta"]` | Yes |
| Profit / operating / gross margins | `info["profitMargins"]`, `info["operatingMargins"]`, `info["grossMargins"]` | Yes |
| Revenue & earnings growth | `info["revenueGrowth"]`, `info["earningsGrowth"]` | Yes |
| Debt-to-equity | `info["debtToEquity"]` | Yes |
| Return on equity / assets | `info["returnOnEquity"]`, `info["returnOnAssets"]` | Yes |
| Analyst recommendations | `Ticker.recommendations` (DataFrame: strongBuy, buy, hold, sell, strongSell) | Yes |
| Analyst price targets | `Ticker.analyst_price_targets` (current, high, low, mean, median) | Yes |
| Average analyst rating | `info["averageAnalystRating"]` (e.g. `"2.0 - Buy"`) | Yes |

---

## What We Will Build

### A. Stock Info Panel (sidebar / top section)

A card displayed alongside the candlestick chart showing:

| Section | Fields |
|---------|--------|
| **Header** | Company name (`longName`), ticker symbol, current price, daily change % |
| **About** | `longBusinessSummary` (collapsible, first 2-3 sentences visible) |
| **Profile** | Sector, Industry, Website, Full-time employees |
| **Key Ratios** | Trailing P/E, Forward P/E, PEG, EPS, Price-to-Book, Debt-to-Equity |
| **Financials** | Market Cap, Revenue, Profit Margins, ROE, ROA |
| **Dividends** | Dividend Rate, Dividend Yield, Payout Ratio |
| **52-Week Range** | Visual bar showing current price position between 52w low and 52w high |

### B. Moving Average Overlays on Candlestick Chart

Overlay lines on the existing Plotly candlestick chart:

- **20-day SMA** (short-term, light blue)
- **50-day SMA** (medium-term, medium blue)
- **200-day SMA** (long-term, dark blue / navy)

These are computed server-side from the OHLCV history using `pandas.Series.rolling().mean()`. Sent to the frontend as additional arrays in the stock response.

### C. Analyst Sentiment Widget

A small panel below or beside the chart:

- **Recommendation breakdown**: horizontal stacked bar (strongBuy / buy / hold / sell / strongSell) from `Ticker.recommendations`
- **Price target range**: low → mean → median → high from `Ticker.analyst_price_targets`, with a marker at the current price
- **Consensus label**: e.g. "Buy" from `info["averageAnalystRating"]`

---

## Implementation Plan

### Step 1: Backend — New Endpoint for Ticker Info

**File**: `backend/app/routers/stock.py`

Add a new endpoint:

```
GET /api/stock/{ticker}/info
```

Response shape:

```json
{
  "profile": {
    "longName": "Apple Inc.",
    "symbol": "AAPL",
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "website": "https://www.apple.com",
    "fullTimeEmployees": 150000,
    "longBusinessSummary": "Apple Inc. designs, manufactures..."
  },
  "price": {
    "currentPrice": 276.38,
    "previousClose": 276.49,
    "dayHigh": 279.50,
    "dayLow": 273.23,
    "fiftyTwoWeekHigh": 288.62,
    "fiftyTwoWeekLow": 169.21
  },
  "ratios": {
    "trailingPE": 34.94,
    "forwardPE": 29.79,
    "trailingPegRatio": 2.50,
    "trailingEps": 7.91,
    "forwardEps": 9.28,
    "priceToBook": 46.08,
    "debtToEquity": 102.63,
    "beta": 1.107
  },
  "financials": {
    "marketCap": 4062214094848,
    "totalRevenue": 435617005568,
    "revenueGrowth": 0.157,
    "profitMargins": 0.270,
    "operatingMargins": 0.354,
    "grossMargins": 0.473,
    "returnOnEquity": 1.520,
    "returnOnAssets": 0.244
  },
  "dividends": {
    "dividendRate": 1.04,
    "dividendYield": 0.0038,
    "payoutRatio": 0.1304
  },
  "analyst": {
    "averageRating": "2.0 - Buy",
    "priceTargets": {
      "current": 276.33,
      "low": 205.0,
      "mean": 292.46,
      "median": 300.0,
      "high": 350.0
    },
    "recommendations": {
      "strongBuy": 6,
      "buy": 23,
      "hold": 15,
      "sell": 1,
      "strongSell": 2
    }
  }
}
```

**File**: `backend/app/stock_utils.py`

Add a `fetch_ticker_info(ticker: str) -> dict` function that calls `yf.Ticker(ticker).info`, `Ticker.recommendations`, and `Ticker.analyst_price_targets`, then reshapes into the structure above. Values that are `None` get a sensible default (`null` / `"N/A"`).

### Step 2: Backend — Add Moving Averages to Existing OHLCV Response

**File**: `backend/app/stock_utils.py`

Modify `fetch_ohlcv()` to also compute and return moving averages:

```python
for window in [20, 50, 200]:
    col = f"SMA_{window}"
    data[col] = data["Close"].rolling(window=window).mean()
```

Each OHLCV record gains three new fields:

```json
{
  "Date": "...", "Open": ..., "High": ..., "Low": ..., "Close": ..., "Volume": ...,
  "SMA_20": 274.12,
  "SMA_50": 268.57,
  "SMA_200": 237.76
}
```

`SMA_*` values will be `null` for the first N records where the window hasn't filled.

**Note**: To have enough data for a 200-day SMA, the default fetch period should be extended from `6mo` to `1y`.

### Step 3: Frontend — API Service

**File**: `frontend/src/services/api.ts`

Add a new function:

```ts
export async function fetchStockInfo(ticker: string) {
  return request(`/stock/${ticker}/info`)
}
```

### Step 4: Frontend — Stock Info Panel Component

**New file**: `frontend/src/components/StockInfoPanel.tsx`

A card component that receives the info JSON and renders:

- Company header (name, price, change)
- Collapsible "About" section
- Key ratios in a 2-column grid
- 52-week range as a CSS progress bar
- Dividend info (if available)

Styling: dark card (`#161b22`), consistent with existing theme. Mobile: stacks full-width above the chart.

### Step 5: Frontend — Moving Average Overlays on Chart

**File**: `frontend/src/components/CandlestickChart.tsx`

Add three additional Plotly `scatter` traces to the chart's `data` array:

```ts
{
  type: 'scatter', mode: 'lines',
  x: dates,
  y: data.map(d => d.SMA_20),
  name: '20-day SMA',
  line: { color: '#85c1e9', width: 1.5 },
},
{
  type: 'scatter', mode: 'lines',
  x: dates,
  y: data.map(d => d.SMA_50),
  name: '50-day SMA',
  line: { color: '#3498db', width: 1.5 },
},
{
  type: 'scatter', mode: 'lines',
  x: dates,
  y: data.map(d => d.SMA_200),
  name: '200-day SMA',
  line: { color: '#1a5276', width: 1.5 },
}
```

This overlays the moving averages directly on the candlestick chart with a legend toggle.

### Step 6: Frontend — Analyst Sentiment Widget

**New file**: `frontend/src/components/AnalystWidget.tsx`

- Horizontal stacked bar for recommendation counts (color coded: green → yellow → red)
- Price target range bar with a marker at the current price
- Consensus label badge (e.g. "Buy" in green)

### Step 7: Frontend — Dashboard Layout Update

**File**: `frontend/src/pages/Dashboard.tsx`

After a successful search, fetch both endpoints in parallel:

```ts
const [ohlcv, info] = await Promise.all([
  fetchStock(ticker),
  fetchStockInfo(ticker),
])
```

New layout:

```
┌──────────────────────────────────────────────────┐
│  Search bar                                      │
├────────────────────────────┬─────────────────────┤
│  Candlestick Chart         │  Stock Info Panel   │
│  (with SMA overlays)       │  (scrollable card)  │
├────────────────────────────┴─────────────────────┤
│  Analyst Sentiment Widget                        │
└──────────────────────────────────────────────────┘
```

On mobile (< 768px), the Info Panel moves below the chart (full width).

### Step 8: Rebuild & Deploy

```bash
docker compose -f deployment/docker-compose.yml up --build -d
```

---

## Files Changed / Created

| Action | File |
|--------|------|
| **Modified** | `backend/app/stock_utils.py` — add `fetch_ticker_info()`, add SMA to `fetch_ohlcv()` |
| **Modified** | `backend/app/routers/stock.py` — add `GET /api/stock/{ticker}/info` |
| **Modified** | `frontend/src/services/api.ts` — add `fetchStockInfo()` |
| **Modified** | `frontend/src/components/CandlestickChart.tsx` — add SMA overlay traces |
| **Modified** | `frontend/src/pages/Dashboard.tsx` — new layout, parallel fetch |
| **Modified** | `frontend/src/styles/global.css` — styles for info panel, analyst widget, responsive layout |
| **Created** | `frontend/src/components/StockInfoPanel.tsx` |
| **Created** | `frontend/src/components/AnalystWidget.tsx` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `Ticker.info` is slow (~1-2s network call) | Fetch in parallel with OHLCV; show loading skeleton |
| Some `.info` fields are `None` for certain tickers (e.g. no dividends for GOOGL) | Use `"N/A"` fallbacks; conditionally hide empty sections |
| `trailingPegRatio` sometimes returns `None` (known yfinance issue since mid-2025) | Display "N/A" gracefully |
| 200-day SMA requires >200 data points | Change default period from `6mo` to `1y` |
| Extra data increases response size | Minimal impact — info is a single JSON object; SMA adds 3 floats per row |

---

## Open Decisions (for review)

1. **Layout preference**: Info Panel on the right side (desktop) vs. tabbed view below the chart?
2. **Which ratios to show by default**: The plan includes ~15 metrics. Should we show all, or group into expandable sections?
3. **Moving average periods**: 20/50/200 are standard. Want any custom periods (e.g. 10, 100)?
4. **Analyst widget**: Include or skip? Some users may not care about analyst ratings.

---

*Awaiting review before implementation begins.*
