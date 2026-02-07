"""Tests for Yahoo Finance integration (real API calls, no mocking)."""

import pytest

from app.stock_utils import fetch_ohlcv, fetch_ticker_info

VALID_TICKER = "AAPL"
INVALID_TICKER = "ZZZXQQNOTREAL123"


class TestFetchOHLCV:
    def test_returns_data_for_valid_ticker(self):
        data = fetch_ohlcv(VALID_TICKER, period="5d", interval="1d")
        assert isinstance(data, list)
        assert len(data) > 0
        row = data[0]
        for key in ("Date", "Open", "High", "Low", "Close", "Volume"):
            assert key in row, f"Missing key: {key}"
        assert isinstance(row["Open"], float)
        assert isinstance(row["Volume"], int)

    def test_returns_empty_for_invalid_ticker(self):
        data = fetch_ohlcv(INVALID_TICKER, period="5d", interval="1d")
        assert data == []

    def test_sma_values_populated_for_long_period(self):
        data = fetch_ohlcv(VALID_TICKER, period="3mo", interval="1d")
        assert len(data) > 20
        # The last row should have SMA_20 populated (>= 20 data points)
        last = data[-1]
        assert "SMA_20" in last
        assert last["SMA_20"] is not None

    def test_data_values_are_sane(self):
        data = fetch_ohlcv(VALID_TICKER, period="5d", interval="1d")
        for row in data:
            assert row["Low"] <= row["High"], f"Low > High on {row['Date']}"
            assert row["Volume"] >= 0, f"Negative volume on {row['Date']}"


class TestFetchTickerInfo:
    def test_returns_nested_dict_for_valid_ticker(self):
        info = fetch_ticker_info(VALID_TICKER)
        assert isinstance(info, dict)
        for section in ("profile", "price", "ratios", "financials", "dividends", "analyst"):
            assert section in info, f"Missing section: {section}"

    def test_profile_has_company_name(self):
        info = fetch_ticker_info(VALID_TICKER)
        long_name = info["profile"]["longName"]
        assert "Apple" in long_name

    def test_price_has_current_price(self):
        info = fetch_ticker_info(VALID_TICKER)
        price = info["price"]
        assert price["currentPrice"] is not None or price["previousClose"] is not None

    def test_returns_empty_dict_for_invalid_ticker(self):
        info = fetch_ticker_info(INVALID_TICKER)
        assert info == {}

    def test_analyst_section_structure(self):
        info = fetch_ticker_info(VALID_TICKER)
        analyst = info["analyst"]
        assert "recommendations" in analyst
        assert "priceTargets" in analyst
        rec = analyst["recommendations"]
        for key in ("strongBuy", "buy", "hold", "sell", "strongSell"):
            assert key in rec, f"Missing recommendation key: {key}"
        targets = analyst["priceTargets"]
        for key in ("current", "low", "mean", "median", "high"):
            assert key in targets, f"Missing price target key: {key}"
