import yfinance as yf
import pandas as pd


def fetch_ohlcv(ticker: str, period: str = "6mo", interval: str = "1d") -> list[dict]:
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

    data = data.reset_index()

    records = []
    for _, row in data.iterrows():
        date_val = row["Date"]
        records.append(
            {
                "Date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
                "Open": round(float(row["Open"]), 2),
                "High": round(float(row["High"]), 2),
                "Low": round(float(row["Low"]), 2),
                "Close": round(float(row["Close"]), 2),
                "Volume": int(row["Volume"]),
            }
        )
    return records
