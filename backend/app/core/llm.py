import os
import httpx
import logging
from typing import List, Dict, AsyncGenerator
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LLMClient")

class ResilientLLMClient:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"
        
        # Updated to Groq's most stable and current model roster
        self.models = [
            "llama-3.3-70b-versatile",    # 1. Primary flagship
            "llama-3.1-8b-instant",       # 2. Blazing fast fallback
            "mixtral-8x7b-32768",         # 3. Deep context fallback
            "gemma2-9b-it"                # 4. Redundancy fallback
        ]

    async def generate(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        """Standard generation with auto-cascading fallbacks."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        for model in self.models:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature
            }
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(self.endpoint, json=payload, headers=headers)
                    if response.status_code == 200:
                        return response.json()["choices"][0]["message"]["content"]
                    else:
                        logger.warning(f"Generation failed on {model} (Code {response.status_code}): {response.text}")
                        continue # Immediately try the next model
            except Exception as e:
                logger.warning(f"Connection exception on {model}: {str(e)}")
                continue
                
        return "Error: All Groq models exhausted. Please check your API limits or network."

    async def generate_stream(self, messages: List[Dict[str, str]], temperature: float = 0.5) -> AsyncGenerator[str, None]:
        """Streaming generation with auto-cascading fallbacks."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        for model in self.models:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "stream": True
            }
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream("POST", self.endpoint, json=payload, headers=headers) as response:
                        
                        # If the model is accepted, stream the chunks to the UI
                        if response.status_code == 200:
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
                            return # Exit generator completely upon success
                            
                        # If Groq throws a 400/429/500, read the error and try the next model
                        else:
                            await response.aread() 
                            logger.warning(f"Streaming rejected by {model} (Code {response.status_code}): {response.text}")
                            continue 
                            
            except Exception as e:
                logger.warning(f"Streaming exception on {model}: {str(e)}")
                continue
                
        yield "\n[System Notice: The neural matrix failed to respond. All backup models are currently exhausted or rate-limited.]" 