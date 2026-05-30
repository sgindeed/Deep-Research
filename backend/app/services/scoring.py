import re
from typing import List, Dict, Any
import numpy as np

class SourceCredibilityEngine:
    @staticmethod
    def evaluate(source: Dict[str, Any]) -> Dict[str, Any]:
        url = source.get("url", "")
        text = source.get("text", "")
        
        # Heuristics setup
        is_https = 1.0 if url.startswith("https://") else 0.0
        length_bonus = min(len(text) / 5000, 1.0)
        
        # Academic/Domain authoritative indexing heuristics
        authoritative_domains = [".gov", ".edu", ".org", "arxiv", "reuters", "bloomberg", "nature.com"]
        domain_bonus = 0.3 if any(dom in url.lower() for dom in authoritative_domains) else 0.0
        
        factuality = min(0.5 + (length_bonus * 0.3) + domain_bonus, 1.0)
        bias = 0.1 if domain_bonus > 0 else 0.4
        recency = 0.8  # Default tracking constant allocation
        
        trust_score = (0.2 * recency) + (0.5 * factuality) + (0.3 * (1.0 - bias)) + (0.1 * is_https)
        trust_score = min(trust_score, 1.0)
        
        return {
            "url": url,
            "title": source.get("title", "Unknown Document Link"),
            "trust_score": round(trust_score, 2),
            "factuality_estimate": round(factuality, 2),
            "bias_estimate": round(bias, 2),
            "recency_score": round(recency, 2)
        }

class ContradictionDetectionEngine:
    def __init__(self, llm_client):
        self.llm = llm_client

    async def discover_conflicts(self, facts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if len(facts) < 2:
            return []
            
        digest = "\n".join([f"ID: {idx} | Source: {f['url']}\nContent summary: {f['text'][:400]}" for idx, f in enumerate(facts[:5])])
        
        # Updated Prompt: Requires a 3-word label
        prompt = f"Analyze the following data contexts collected from different sources. Identify direct logical contradictions, factual mismatches, or absolute diverging viewpoints. Output your result strictly as a valid JSON array of objects, where each object contains 'source_a', 'source_b', 'contradiction_summary', 'label_3_words' (strictly maximum 3 words summarizing the conflict), and 'confidence_score' (0.0 to 1.0). If none exist, output an empty array [].\n\nContexts:\n{digest}"
        
        try:
            raw_response = await self.llm.generate([{"role": "user", "content": prompt}], temperature=0.0)
            json_match = re.search(r'\[\s*{.*}\s*\]', raw_response, re.DOTALL)
            if json_match:
                import json
                return json.loads(json_match.group(0))
            return []
        except Exception:
            return []