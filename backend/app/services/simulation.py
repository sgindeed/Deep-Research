import json
import re
import asyncio
import logging
from typing import List, Dict, Tuple
from app.core.llm import ResilientLLMClient

logger = logging.getLogger("SimulationEngine")

class FutureSimulationEngine:
    def __init__(self, llm_client: ResilientLLMClient, query: str, context_report: str, stream_callback):
        self.llm = llm_client
        self.query = query
        self.context = context_report
        self.stream_callback = stream_callback
        self.personas = []
        self.transcript = []

    async def _generate_personas(self, count: int = 3) -> List[Dict[str, str]]:
        prompt = f"""
        Based on the following research context regarding '{self.query}', create exactly {count} distinct expert personas to debate the future of this topic.
        Ensure they have conflicting but highly logical viewpoints.
        
        IMPORTANT: Do NOT use human names or human personas. The 'name' field MUST be a functional role or title indicating their domain of expertise (e.g., "Economics Agent", "History Agent", "Technology Agent", "Ethics Agent", "Skeptic Agent").
        
        Output STRICTLY as a JSON array of objects with keys: "name", "role", and "perspective".
        Context: {self.context[:3000]}
        """
        try:
            res = await self.llm.generate([{"role": "user", "content": prompt}], temperature=0.6)
            json_match = re.search(r'\[.*\]', res, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            return []
        except Exception:
            return []

    async def _run_streaming_prediction(self, persona: Dict[str, str], phase: str, previous_debate: str = ""):
        if phase == "Hypothesis":
            prompt = f"You are the {persona['name']}, a {persona['role']}. Perspective: {persona['perspective']}.\nBased on these facts, formulate one future prediction regarding '{self.query}'. Justify it quickly. Keep it under 100 words.\nFacts: {self.context[:3000]}"
        else:
            prompt = f"You are the {persona['name']}, a {persona['role']}. Perspective: {persona['perspective']}.\nReview peers' predictions on '{self.query}':\n{previous_debate}\nWrite a sharp rebuttal or expansion. Attack flaws or build on ideas. Keep it under 100 words."

        # Alert the frontend that a new agent is typing
        await self.stream_callback({"type": "start_turn", "agent": persona["name"], "role": persona["role"], "phase": phase})
        
        full_text = ""
        # Stream the thought process chunk by chunk
        async for chunk in self.llm.generate_stream([{"role": "user", "content": prompt}], temperature=0.7):
            full_text += chunk
            await self.stream_callback({"type": "token", "content": chunk})
            
        self.transcript.append({"agent": persona['name'], "role": persona['role'], "phase": phase, "content": full_text})

    async def _synthesize_and_score(self) -> Tuple[str, List[Dict]]:
        debate_text = "\n\n".join([f"[{m['phase']}] **{m['agent']} ({m['role']})**: {m['content']}" for m in self.transcript])
        prompt = f"""
        You are the Evaluator Agent. Review the multi-phase debate below regarding '{self.query}'.
        Debate Transcript:
        {debate_text}
        
        TASK 1: Write a concise, professional Markdown report synthesizing these future possibilities.
        TASK 2: At the end, output a strict JSON array of the most distinct outcomes. Assign a confidence percentage (0-100) to each.
        Wrap the JSON in <json> tags:
        <json>
        [
            {{"scenario": "Short title", "confidence_percentage": 85.5, "description": "1 sentence explanation"}}
        ]
        </json>
        """
        res = await self.llm.generate([{"role": "user", "content": prompt}], temperature=0.3)
        markdown_report = res
        outcomes = []
        json_match = re.search(r'<json>(.*?)</json>', res, re.DOTALL)
        if json_match:
            try:
                outcomes = json.loads(json_match.group(1))
                markdown_report = res.replace(json_match.group(0), "").strip()
            except Exception:
                pass
        return markdown_report, outcomes

    async def run_simulation(self) -> Tuple[str, List[Dict], List[Dict]]:
        self.personas = await self._generate_personas(count=3)
        if not self.personas:
            # Fallback to role-based names if JSON generation fails
            self.personas = [
                {"name": "Systems Agent", "role": "System Optimist", "perspective": "Growth and integration."},
                {"name": "Skeptic Agent", "role": "Skeptic", "perspective": "Bottlenecks and structural failure."}
            ]

        # Phase 1: Sequential Hypothesis Streaming
        for p in self.personas:
            await self._run_streaming_prediction(p, "Hypothesis")

        # Phase 2: Sequential Cross-Examination Streaming
        debate_context = "\n".join([f"{r['agent']} ({r['role']}): {r['content']}" for r in self.transcript])
        for p in self.personas:
            await self._run_streaming_prediction(p, "Cross-Examination", debate_context)

        # Final Evaluation
        await self.stream_callback({"type": "start_turn", "agent": "Evaluator Agent", "role": "Central Core", "phase": "Synthesis"})
        final_report, outcomes = await self._synthesize_and_score()
        
        return final_report, outcomes, self.transcript