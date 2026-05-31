import os
import httpx
import asyncio
import logging
from typing import List, Dict, Any, AsyncGenerator
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LLMClient")

class ResilientLLMClient:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"
        self.models = [
            "llama-3.3-70b-versatile",    # 1. Primary: Smartest and highly capable
            "mixtral-8x7b-32768",         # 2. Fallback 1: Excellent context window
            "llama3-70b-8192",            # 3. Fallback 2: Previous gen heavy-hitter
            "llama-3.1-8b-instant",       # 4. Fallback 3: Blazing fast, highly reliable
            "gemma2-9b-it",               # 5. Fallback 4: Google's architecture, great redundancy
            "llama3-8b-8192",             # 6. Fallback 5: Standard Llama 3 8B
            "llama-3.2-3b-preview",       # 7. Last Resort: Ultra-light, almost never rate-limited
            "qwen3-7b-instant"            # 8. Emergency Backup: Qwen's fastest, most efficient model
        ]
        if not self.api_key:
            logger.warning("GROQ_API_KEY missing from environment context.")

    async def generate(self, messages: List[Dict[str, str]], temperature: float = 0.2, stream: bool = False) -> str:
        last_exception = None
        for model in self.models:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "stream": stream
                }
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(self.endpoint, json=payload, headers=headers)
                    if response.status_code == 429:
                        logger.warning(f"Rate limited on model {model}. Attempting fallback topology.")
                        continue
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"Failure processing completion with model {model}: {str(e)}")
                last_exception = e
                continue
        raise RuntimeError(f"All available models exhausted in fallback ring. Last error: {str(last_exception)}")

    async def generate_stream(self, messages: List[Dict[str, str]], temperature: float = 0.2) -> AsyncGenerator[str, None]:
        # Implementation fallback variant for token-by-token streaming requirements
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        # Force secondary backup if deepseek rate bounds occur during direct streams
        model = self.models[1] 
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True
        }
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", self.endpoint, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        yield f"[Fallback Routing Notification: API Error {response.status_code}]"
                        return
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and not line.endswith("[DONE]"):
                            import json
                            try:
                                chunk = json.loads(line[6:])
                                delta = chunk["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta
                            except Exception:
                                pass
        except Exception as e:
            yield f"\n[Streaming Interruption Exception: {str(e)}]"
