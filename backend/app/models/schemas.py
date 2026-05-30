from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import UUID
from enum import Enum

class ResearchDepth(str, Enum):
    LIGHT = "light"
    MEDIUM = "medium"
    DEEP = "deep"

class ResearchRequest(BaseModel):
    query: str
    depth: ResearchDepth = ResearchDepth.MEDIUM
    max_iterations: int = Field(default=5, ge=1, le=15)

class ResearchStatusResponse(BaseModel):
    research_id: UUID
    status: str
    current_agent: str
    progress_percentage: float
    iteration_count: int
    sources_found_count: int
    confidence_score: float

class GraphNode(BaseModel):
    id: str
    type: str  # We will use this for the dynamic LLM category (e.g., "Tech Blog")
    label: str
    metadata: Dict[str, Any]
    color: Optional[str] = None # NEW: The LLM will define this hex code
    description: Optional[str] = None # NEW: The LLM's 2-sentence summary

class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str

class ResearchGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class SourceMetadata(BaseModel):
    url: str
    title: str
    trust_score: float
    factuality_estimate: float
    bias_estimate: float
    recency_score: float
    citation_frequency: int = 0

class FinalReportResponse(BaseModel):
    research_id: UUID
    markdown_content: str
    sources: List[SourceMetadata]
    contradiction_map: List[Dict[str, Any]]
    confidence_score: float