from fastapi import APIRouter, Depends, HTTPException

from app.auth_utils import get_current_user
from app.stock_utils import fetch_ohlcv

router = APIRouter()


@router.get("/{ticker}")
def get_stock(
    ticker: str,
    period: str = "6mo",
    interval: str = "1d",
    _user: str = Depends(get_current_user),
):
    data = fetch_ohlcv(ticker, period, interval)
    if not data:
        raise HTTPException(
            status_code=404, detail=f"No data found for ticker '{ticker}'"
        )
    return data
