"""Tests for Claude API insights helpers and live integration."""

import json
import os

import pytest

from app.claude_insights import (
    _build_prompt,
    _parse_response,
    get_insights,
    RATED_METRICS,
    _cache,
)

# Sample stock_data matching the shape returned by fetch_ticker_info
SAMPLE_STOCK_DATA = {
    "profile": {
        "longName": "Apple Inc.",
        "sector": "Technology",
        "industry": "Consumer Electronics",
    },
    "ratios": {
        "trailingPE": 28.5,
        "forwardPE": 25.1,
        "trailingPegRatio": 1.2,
        "priceToBook": 40.3,
        "debtToEquity": 150.0,
        "beta": 1.2,
    },
    "financials": {
        "profitMargins": 0.25,
        "revenueGrowth": 0.08,
        "returnOnEquity": 1.5,
        "returnOnAssets": 0.3,
    },
}

# A valid response structure that _parse_response should accept
VALID_RESPONSE = {
    "metrics": {
        m: {"score": 7, "label": "Good", "color": "green", "explanation": "Solid."}
        for m in RATED_METRICS
    },
    "overallScore": 72,
    "overallLabel": "Above Average",
    "overallSummary": "Looks healthy.",
}


# ---------------------------------------------------------------------------
# _build_prompt
# ---------------------------------------------------------------------------
class TestBuildPrompt:
    def test_contains_company_name(self):
        prompt = _build_prompt(SAMPLE_STOCK_DATA)
        assert "Apple Inc." in prompt

    def test_includes_all_metrics(self):
        prompt = _build_prompt(SAMPLE_STOCK_DATA)
        for metric in RATED_METRICS:
            assert metric in prompt, f"Metric {metric} not found in prompt"

    def test_handles_missing_data(self):
        prompt = _build_prompt({})
        assert isinstance(prompt, str)
        assert len(prompt) > 0


# ---------------------------------------------------------------------------
# _parse_response
# ---------------------------------------------------------------------------
class TestParseResponse:
    def test_valid_json(self):
        result = _parse_response(json.dumps(VALID_RESPONSE))
        assert result is not None
        assert "metrics" in result
        assert result["overallScore"] == 72

    def test_strips_markdown_fences(self):
        wrapped = "```json\n" + json.dumps(VALID_RESPONSE) + "\n```"
        result = _parse_response(wrapped)
        assert result is not None
        assert result["overallScore"] == 72

    def test_invalid_json_returns_none(self):
        assert _parse_response("this is not json") is None

    def test_missing_metrics_returns_none(self):
        bad = {"overallScore": 50}
        assert _parse_response(json.dumps(bad)) is None

    def test_missing_score_returns_none(self):
        bad = {"metrics": {m: {} for m in RATED_METRICS}}
        assert _parse_response(json.dumps(bad)) is None

    def test_incomplete_metrics_returns_none(self):
        partial = {
            "metrics": {m: {} for m in RATED_METRICS[:5]},  # only 5 of 10
            "overallScore": 50,
        }
        assert _parse_response(json.dumps(partial)) is None


# ---------------------------------------------------------------------------
# get_insights (live + offline)
# ---------------------------------------------------------------------------
class TestGetInsights:
    def test_none_when_api_key_missing(self, monkeypatch):
        monkeypatch.delenv("CLAUDE_API_KEY", raising=False)
        _cache.clear()
        result = get_insights(SAMPLE_STOCK_DATA, "AAPL")
        assert result is None

    def test_none_for_placeholder_key(self, monkeypatch):
        monkeypatch.setenv("CLAUDE_API_KEY", "your-claude-api-key-here")
        _cache.clear()
        result = get_insights(SAMPLE_STOCK_DATA, "AAPL")
        assert result is None

    @pytest.mark.skipif(
        not os.getenv("CLAUDE_API_KEY")
        or os.getenv("CLAUDE_API_KEY") == "your-claude-api-key-here",
        reason="CLAUDE_API_KEY not configured — skipping live API test",
    )
    def test_live_api_returns_valid_structure(self):
        _cache.clear()
        result = get_insights(SAMPLE_STOCK_DATA, "AAPL")
        assert result is not None, "Live Claude API returned None"
        assert "metrics" in result
        assert "overallScore" in result
        assert isinstance(result["overallScore"], (int, float))
        for metric in RATED_METRICS:
            assert metric in result["metrics"], f"Missing metric: {metric}"
