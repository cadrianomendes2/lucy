import os
import httpx

TAVILY_URL = "https://api.tavily.com/search"


async def web_search(query: str) -> list[dict]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(
                TAVILY_URL,
                json={
                    "api_key": api_key,
                    "query": query,
                    "max_results": 3,
                    "search_depth": "basic",
                },
            )
            r.raise_for_status()
            data = r.json()
            return [
                {
                    "title": item["title"],
                    "snippet": item["content"],
                    "url": item["url"],
                }
                for item in data.get("results", [])[:3]
            ]
    except Exception:
        return []
