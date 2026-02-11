import yfinance as yf
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA


def fetch_forecast(ticker: str, period: str = "1y", days: int = 7) -> dict:
    try:
        data = yf.download(
            tickers=ticker,
            period=period,
            auto_adjust=True,
            progress=False,
        )
        if data.empty:
            return {"ticker": ticker, "model": "ARIMA", "order": [2, 1, 2], "forecast": []}

        # yfinance may return MultiIndex columns; flatten them
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        close = data["Close"].dropna()
        if len(close) < 30:
            return {"ticker": ticker, "model": "ARIMA", "order": [2, 1, 2], "forecast": []}

        model = ARIMA(close, order=(2, 1, 2))
        model_fit = model.fit()

        forecast_result = model_fit.get_forecast(steps=days)
        predicted = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=0.05)

        last_date = close.index[-1]
        future_dates = pd.bdate_range(start=last_date + pd.Timedelta(days=1), periods=days)

        forecast_list = []
        for i in range(days):
            forecast_list.append({
                "Date": future_dates[i].isoformat(),
                "Price": round(float(predicted.iloc[i]), 2),
                "Upper": round(float(conf_int.iloc[i, 1]), 2),
                "Lower": round(float(conf_int.iloc[i, 0]), 2),
            })

        return {
            "ticker": ticker.upper(),
            "model": "ARIMA",
            "order": [2, 1, 2],
            "forecast": forecast_list,
        }
    except Exception:
        return {"ticker": ticker.upper(), "model": "ARIMA", "order": [2, 1, 2], "forecast": []}
