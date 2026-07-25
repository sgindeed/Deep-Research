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

    async def _generate_personas(self, count: int = 4) -> List[Dict[str, str]]:
        prompt = f"""
        Based on the following research context regarding '{self.query}', create exactly {count} distinct expert personas to debate the future of this topic.
        
        CRITICAL: Each persona must represent a UNIQUE functional role or domain of expertise that is DIRECTLY RELEVANT to the query topic.
        DO NOT use human names. The 'name' field MUST be a functional role (e.g., "Economic Forecaster", "Technology Analyst", "Policy Expert", "Ethics Advisor", "Environmental Scientist", "Security Specialist").
        
        Ensure they have conflicting but highly logical viewpoints to create a robust debate.
        
        Output STRICTLY as a JSON array of objects with keys: "name", "role" (brief role description), and "perspective" (their core viewpoint).
        
        Context: {self.context[:3000]}
        """
        try:
            res = await self.llm.generate([{"role": "user", "content": prompt}], temperature=0.7)
            json_match = re.search(r'\[.*\]', res, re.DOTALL)
            if json_match:
                personas = json.loads(json_match.group(0))
                # Ensure we have at least 3 personas
                if len(personas) < 3:
                    return self._get_fallback_personas()
                return personas
            return self._get_fallback_personas()
        except Exception:
            return self._get_fallback_personas()
    
    def _get_fallback_personas(self) -> List[Dict[str, str]]:
        """Fallback personas if generation fails"""
        return [
            {"name": "Technology Analyst", "role": "Technology Expert", "perspective": "Focus on innovation and technological advancement."},
            {"name": "Economic Forecaster", "role": "Economics Expert", "perspective": "Focus on market forces and economic impact."},
            {"name": "Policy Expert", "role": "Policy Analyst", "perspective": "Focus on regulation and governance."},
            {"name": "Ethics Advisor", "role": "Ethics Specialist", "perspective": "Focus on ethical implications and social impact."}
        ]

    async def _run_streaming_prediction(self, persona: Dict[str, str], phase: str, previous_debate: str = ""):
        if phase == "Hypothesis":
            prompt = f"""
            You are the {persona['name']}, a {persona['role']}. 
            Perspective: {persona['perspective']}
            
            Based on these facts, formulate ONE future prediction regarding '{self.query}'. 
            Justify your prediction with specific reasoning. Keep it under 120 words.
            
            Facts: {self.context[:3000]}
            """
        else:
            prompt = f"""
            You are the {persona['name']}, a {persona['role']}. 
            Perspective: {persona['perspective']}
            
            Review your peers' predictions on '{self.query}':
            {previous_debate}
            
            Write a sharp rebuttal OR an expansion of the ideas. 
            Identify weaknesses in others' arguments OR build upon strong points.
            Keep it under 120 words.
            """

        await self.stream_callback({"type": "start_turn", "agent": persona["name"], "role": persona["role"], "phase": phase})
        
        full_text = ""
        async for chunk in self.llm.generate_stream([{"role": "user", "content": prompt}], temperature=0.8):
            full_text += chunk
            await self.stream_callback({"type": "token", "content": chunk})
            
        self.transcript.append({"agent": persona['name'], "role": persona['role'], "phase": phase, "content": full_text})

    async def _synthesize_and_score(self) -> Tuple[str, List[Dict]]:
        debate_text = "\n\n".join([f"[{m['phase']}] **{m['agent']} ({m['role']})**: {m['content']}" for m in self.transcript])
        prompt = f"""
        You are the Swarm Intelligence Evaluator. Review the multi-phase expert debate below regarding '{self.query}'.
        
        Debate Transcript:
        {debate_text}
        
        TASK 1: Write a comprehensive, professional Markdown report that synthesizes all future possibilities discussed.
        Structure it as:
        - Executive Summary of Key Predictions
        - Analysis of Conflicting Viewpoints
        - Consensus Areas (where experts agreed)
        - Recommended Actions/Policies
        
        TASK 2: At the end, output a JSON array of the most distinct future outcomes. Assign a confidence percentage (0-100) to each.
        Wrap the JSON in <json> tags:
        <json>
        [
            {{"scenario": "Short title (5-7 words)", "confidence_percentage": 85.5, "description": "Detailed 1-2 sentence explanation"}}
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
        # Generate dynamic personas based on the query
        self.personas = await self._generate_personas(count=4)
        
        # Phase 1: Initial Hypotheses (each agent makes their prediction)
        for p in self.personas:
            await self._run_streaming_prediction(p, "Hypothesis")

        # Phase 2: Cross-Examination (agents challenge each other)
        debate_context = "\n".join([f"{r['agent']} ({r['role']}): {r['content']}" for r in self.transcript])
        for p in self.personas:
            await self._run_streaming_prediction(p, "Cross-Examination", debate_context)

        # Phase 3: Synthesis and Swarm Intelligence Report
        await self.stream_callback({"type": "start_turn", "agent": "Swarm Intelligence", "role": "Synthesizer", "phase": "Synthesis"})
        final_report, outcomes = await self._synthesize_and_score()
        
        # Stream the final report
        for chunk in final_report:
            await self.stream_callback({"type": "token", "content": chunk})
        
        return final_report, outcomes, self.transcript