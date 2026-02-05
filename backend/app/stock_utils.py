import yfinance as yf
import pandas as pd


def fetch_ohlcv(ticker: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    data = yf.download(
        tickers=ticker,
        period=period,
        interval=interval,
        auto_adjust=True,
        progress=False,
    )
    if data.empty:
        return []

    # yfinance may return MultiIndex columns; flatten them
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    # Compute moving averages
    for window in [20, 50, 200]:
        data[f"SMA_{window}"] = data["Close"].rolling(window=window).mean()

    data = data.reset_index()

    records = []
    for _, row in data.iterrows():
        date_val = row["Date"]
        record = {
            "Date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
            "Open": round(float(row["Open"]), 2),
            "High": round(float(row["High"]), 2),
            "Low": round(float(row["Low"]), 2),
            "Close": round(float(row["Close"]), 2),
            "Volume": int(row["Volume"]),
        }
        for window in [20, 50, 200]:
            val = row[f"SMA_{window}"]
            record[f"SMA_{window}"] = round(float(val), 2) if pd.notna(val) else None
        records.append(record)
    return records


def _safe_get(info: dict, key: str, default=None):
    """Safely get a value from info dict, returning default if missing or None."""
    val = info.get(key)
    return val if val is not None else default


def _safe_round(val, digits=2):
    """Round a numeric value, returning None if not a number."""
    if val is None:
        return None
    try:
        return round(float(val), digits)
    except (TypeError, ValueError):
        return None


def fetch_ticker_info(ticker: str) -> dict:
    t = yf.Ticker(ticker)
    info = t.info

    if not info or info.get("quoteType") is None:
        return {}

    # Analyst recommendations (most recent month)
    rec = {"strongBuy": 0, "buy": 0, "hold": 0, "sell": 0, "strongSell": 0}
    try:
        recs_df = t.recommendations
        if recs_df is not None and not recs_df.empty:
            latest = recs_df.iloc[0]
            rec = {
                "strongBuy": int(latest.get("strongBuy", 0)),
                "buy": int(latest.get("buy", 0)),
                "hold": int(latest.get("hold", 0)),
                "sell": int(latest.get("sell", 0)),
                "strongSell": int(latest.get("strongSell", 0)),
            }
    except Exception:
        pass

    # Analyst price targets
    targets = {"current": None, "low": None, "mean": None, "median": None, "high": None}
    try:
        apt = t.analyst_price_targets
        if apt:
            targets = {
                "current": _safe_round(apt.get("current")),
                "low": _safe_round(apt.get("low")),
                "mean": _safe_round(apt.get("mean")),
                "median": _safe_round(apt.get("median")),
                "high": _safe_round(apt.get("high")),
            }
    except Exception:
        pass

    return {
        "profile": {
            "longName": _safe_get(info, "longName", "N/A"),
            "symbol": _safe_get(info, "symbol", ticker.upper()),
            "sector": _safe_get(info, "sector", "N/A"),
            "industry": _safe_get(info, "industry", "N/A"),
            "website": _safe_get(info, "website"),
            "fullTimeEmployees": _safe_get(info, "fullTimeEmployees"),
            "longBusinessSummary": _safe_get(info, "longBusinessSummary", "N/A"),
        },
        "price": {
            "currentPrice": _safe_round(info.get("currentPrice")),
            "previousClose": _safe_round(info.get("previousClose")),
            "dayHigh": _safe_round(info.get("dayHigh")),
            "dayLow": _safe_round(info.get("dayLow")),
            "fiftyTwoWeekHigh": _safe_round(info.get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow": _safe_round(info.get("fiftyTwoWeekLow")),
        },
        "ratios": {
            "trailingPE": _safe_round(info.get("trailingPE")),
            "forwardPE": _safe_round(info.get("forwardPE")),
            "trailingPegRatio": _safe_round(info.get("trailingPegRatio")),
            "trailingEps": _safe_round(info.get("trailingEps")),
            "forwardEps": _safe_round(info.get("forwardEps")),
            "priceToBook": _safe_round(info.get("priceToBook")),
            "debtToEquity": _safe_round(info.get("debtToEquity")),
            "beta": _safe_round(info.get("beta"), 3),
        },
        "financials": {
            "marketCap": _safe_get(info, "marketCap"),
            "totalRevenue": _safe_get(info, "totalRevenue"),
            "revenueGrowth": _safe_round(info.get("revenueGrowth"), 3),
            "profitMargins": _safe_round(info.get("profitMargins"), 3),
            "operatingMargins": _safe_round(info.get("operatingMargins"), 3),
            "grossMargins": _safe_round(info.get("grossMargins"), 3),
            "returnOnEquity": _safe_round(info.get("returnOnEquity"), 3),
            "returnOnAssets": _safe_round(info.get("returnOnAssets"), 3),
        },
        "dividends": {
            "dividendRate": _safe_round(info.get("dividendRate")),
            "dividendYield": _safe_round(info.get("dividendYield"), 4),
            "payoutRatio": _safe_round(info.get("payoutRatio"), 4),
        },
        "analyst": {
            "averageRating": _safe_get(info, "averageAnalystRating", "N/A"),
            "priceTargets": targets,
            "recommendations": rec,
        },
    }
