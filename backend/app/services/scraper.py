import httpx
from bs4 import BeautifulSoup
import urllib.parse
import asyncio
import logging
import re
from typing import List, Dict, Any
from ddgs import DDGS

logger = logging.getLogger("ScraperService")

class ConcurrentScraperService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    async def execute_search(self, query: str) -> List[str]:
        """Executes a non-authenticated query using DDGS to bypass HTML bot blocks."""
        try:
            # Run the synchronous DDGS call in an async thread pool to prevent blocking the event loop
            def fetch_search():
                # We use the 'lite' backend as it is highly resilient against rate limits
                return DDGS().text(query, backend="lite", max_results=7)
                
            results = await asyncio.to_thread(fetch_search)
            
            if not results:
                logger.warning(f"No search results found for query: {query}")
                return []
                
            links = []
            for res in results:
                href = res.get("href")
                if href and "duckduckgo.com" not in href:
                    links.append(href)
                    
            return links[:7]
            
        except Exception as e:
            logger.error(f"Search retrieval error for query [{query}]: {str(e)}")
            return []
        

    async def scrape_page(self, url: str) -> Dict[str, Any]:
        """Extracts text content and structures visual markers cleanly without boilerplates."""
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(url, headers=self.headers)
                if response.status_code != 200:
                    return {"url": url, "text": "", "title": "Error Code Source"}
                
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Strip dynamic structures, styles and scripting contexts
                for element in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                    element.decompose()
                    
                title = soup.title.string if soup.title else url
                text = " ".join(soup.get_text().split())
                # Truncate content to keep it within context window limits
                text = re.sub(r'\s+', ' ', text)[:12000]
                
                return {
                    "url": url,
                    "title": str(title).strip(),
                    "text": text
                }
        except Exception as e:
            return {"url": url, "text": "", "title": f"Failed Parse: {str(e)}"}

    async def scrape_batch(self, urls: List[str]) -> List[Dict[str, Any]]:
        tasks = [self.scrape_page(url) for url in urls]
        return await asyncio.gather(*tasks)