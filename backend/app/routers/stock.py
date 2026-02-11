from fastapi import APIRouter, Depends, HTTPException

from app.auth_utils import get_current_user
from app.stock_utils import fetch_ohlcv, fetch_ticker_info
from app.claude_insights import get_insights
from app.forecast_utils import fetch_forecast

router = APIRouter()


@router.get("/{ticker}")
def get_stock(
    ticker: str,
    period: str = "1y",
    interval: str = "1d",
    _user: str = Depends(get_current_user),
):
    data = fetch_ohlcv(ticker, period, interval)
    if not data:
        raise HTTPException(
            status_code=404, detail=f"No data found for ticker '{ticker}'"
        )
    return data


@router.get("/{ticker}/info")
def get_stock_info(
    ticker: str,
    _user: str = Depends(get_current_user),
):
    info = fetch_ticker_info(ticker)
    if not info:
        raise HTTPException(
            status_code=404, detail=f"No info found for ticker '{ticker}'"
        )
    return info


@router.get("/{ticker}/insights")
def get_stock_insights(
    ticker: str,
    _user: str = Depends(get_current_user),
):
    info = fetch_ticker_info(ticker)
    if not info:
        raise HTTPException(
            status_code=404, detail=f"No info found for ticker '{ticker}'"
        )
    insights = get_insights(info, ticker)
    if not insights:
        raise HTTPException(
            status_code=503, detail="AI insights unavailable"
        )
    return insights


@router.get("/{ticker}/forecast")
def get_stock_forecast(
    ticker: str,
    days: int = 7,
    period: str = "1y",
    _user: str = Depends(get_current_user),
):
    result = fetch_forecast(ticker, period, days)
    if not result.get("forecast"):
        raise HTTPException(
            status_code=404, detail=f"No forecast data for ticker '{ticker}'"
        )
    return result
