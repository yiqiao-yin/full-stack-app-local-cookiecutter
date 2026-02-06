import json
import os
import time
import logging

import anthropic

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 3600  # 1 hour

RATED_METRICS = [
    "trailingPE",
    "forwardPE",
    "pegRatio",
    "priceToBook",
    "debtToEquity",
    "beta",
    "profitMargins",
    "revenueGrowth",
    "returnOnEquity",
    "returnOnAssets",
]


def _build_prompt(stock_data: dict) -> str:
    profile = stock_data.get("profile", {})
    ratios = stock_data.get("ratios", {})
    financials = stock_data.get("financials", {})

    company = profile.get("longName", "Unknown")
    sector = profile.get("sector", "Unknown")
    industry = profile.get("industry", "Unknown")

    raw_values = {
        "trailingPE": ratios.get("trailingPE"),
        "forwardPE": ratios.get("forwardPE"),
        "pegRatio": ratios.get("trailingPegRatio"),
        "priceToBook": ratios.get("priceToBook"),
        "debtToEquity": ratios.get("debtToEquity"),
        "beta": ratios.get("beta"),
        "profitMargins": financials.get("profitMargins"),
        "revenueGrowth": financials.get("revenueGrowth"),
        "returnOnEquity": financials.get("returnOnEquity"),
        "returnOnAssets": financials.get("returnOnAssets"),
    }

    values_str = "\n".join(
        f"  {k}: {v if v is not None else 'N/A'}" for k, v in raw_values.items()
    )

    return f"""You are a senior financial analyst. Evaluate the following financial ratios for {company} ({sector} / {industry}) **relative to its sector and industry norms**.

Raw metrics:
{values_str}

For each metric, provide:
- "score": integer 1-10 (10 = excellent for an investor)
- "label": one of "Excellent", "Good", "Fair", "Poor", "Bad"
- "color": one of "green", "yellow-green", "yellow", "orange", "red"
- "explanation": one sentence explaining why this score, mentioning sector context

Scoring direction:
- trailingPE, forwardPE, pegRatio, priceToBook, debtToEquity: LOWER is better (higher score for lower values relative to sector)
- beta: closer to 1.0 is generally better; very high or very low gets lower score
- profitMargins, revenueGrowth, returnOnEquity, returnOnAssets: HIGHER is better (higher score for higher values relative to sector)

If a metric is N/A, set score to null, label to "N/A", color to "gray", and explanation to "Data not available."

Also provide:
- "overallScore": integer 1-100 representing overall financial health
- "overallLabel": one of "Strong", "Above Average", "Average", "Below Average", "Weak"
- "overallSummary": 1-2 sentences summarizing the stock's financial position relative to its sector

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{{
  "metrics": {{
    "trailingPE": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "forwardPE": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "pegRatio": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "priceToBook": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "debtToEquity": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "beta": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "profitMargins": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "revenueGrowth": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "returnOnEquity": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}},
    "returnOnAssets": {{"score": ..., "label": "...", "color": "...", "explanation": "..."}}
  }},
  "overallScore": ...,
  "overallLabel": "...",
  "overallSummary": "..."
}}"""


def _parse_response(text: str) -> dict | None:
    # Strip markdown fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Claude response as JSON")
        return None

    # Validate required fields
    if "metrics" not in data or "overallScore" not in data:
        logger.warning("Claude response missing required fields")
        return None

    for metric in RATED_METRICS:
        if metric not in data["metrics"]:
            logger.warning("Claude response missing metric: %s", metric)
            return None

    return data


def get_insights(stock_data: dict, ticker: str) -> dict | None:
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key or api_key == "your-claude-api-key-here":
        logger.info("CLAUDE_API_KEY not configured, skipping insights")
        return None

    # Check cache
    cache_key = ticker.upper()
    if cache_key in _cache:
        cached_time, cached_data = _cache[cache_key]
        if time.time() - cached_time < CACHE_TTL:
            return cached_data

    prompt = _build_prompt(stock_data)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = message.content[0].text
        insights = _parse_response(response_text)

        if insights:
            _cache[cache_key] = (time.time(), insights)

        return insights

    except Exception:
        logger.exception("Claude API call failed for %s", ticker)
        return None
