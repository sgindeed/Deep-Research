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

class SourceMetadata(BaseModel):
    url: str
    title: str
    trust_score: float
    factuality_estimate: float
    bias_estimate: float
    recency_score: float
    citation_frequency: int = 0

class FutureOutcome(BaseModel):
    scenario: str
    confidence_percentage: float
    description: str

class FinalReportResponse(BaseModel):
    research_id: UUID
    markdown_content: str
    sources: List[SourceMetadata]
    contradiction_map: List[Dict[str, Any]]
    confidence_score: float
    future_report_markdown: Optional[str] = None
    future_outcomes: List[FutureOutcome] = []
    debate_transcript: List[Dict[str, Any]] = []