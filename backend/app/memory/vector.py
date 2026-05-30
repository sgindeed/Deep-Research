import numpy as np
from typing import List, Dict, Any

class InMemoryVectorStore:
    """Production fallback Vector store mapping standard cos-sim pipelines safely."""
    def __init__(self):
        self.storage = []

    def add_document(self, text: str, metadata: Dict[str, Any]):
        # Mock token/embedding allocation via simple hashing for fully independent system stability
        words = text.lower().split()
        vector = np.zeros(128)
        for w in words:
            idx = hash(w) % 128
            vector[idx] += 1.0
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
        self.storage.append({"text": text, "metadata": metadata, "vector": vector})

    def query(self, text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not self.storage:
            return []
        words = text.lower().split()
        vector = np.zeros(128)
        for w in words:
            idx = hash(w) % 128
            vector[idx] += 1.0
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm
            
        scored = []
        for doc in self.storage:
            score = float(np.dot(vector, doc["vector"]))
            scored.append((score, doc))
            
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]