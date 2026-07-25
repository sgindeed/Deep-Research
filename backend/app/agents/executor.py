import asyncio
import logging
import json
import re
from uuid import UUID, uuid4
from typing import Dict, Any, List
from app.core.llm import ResilientLLMClient
from app.services.scraper import ConcurrentScraperService
from app.services.scoring import SourceCredibilityEngine, ContradictionDetectionEngine
from app.memory.vector import InMemoryVectorStore

logger = logging.getLogger("ResearchEngine")

class DeepResearchWorkflowExecutor:
    def __init__(self, session_id: UUID, query: str, depth: str, max_iterations: int, update_callback):
        self.session_id = session_id
        self.query = query
        self.depth = depth
        self.max_iterations = max_iterations
        self.update_callback = update_callback
        
        self.llm = ResilientLLMClient()
        self.scraper = ConcurrentScraperService()
        self.contradiction_engine = ContradictionDetectionEngine(self.llm)
        self.vector_store = InMemoryVectorStore()
        
        self.current_iteration = 0
        self.sources = []
        self.contradictions = []
        self.final_report = ""
        
        self.future_report = ""       
        self.future_outcomes = []     
        self.debate_transcript = []
        
        self.confidence_score = 1.0
        self.current_agent = "Planner Agent"

    async def execute(self):
        await self.update_callback("Planner Agent", 10.0, "Constructing research plan.")
        
        plan_prompt = f"""
        Topic: '{self.query}'. Generate exactly 3 short search queries to deeply explore this topic.
        Output strictly as a JSON array of objects with keys: "query" (max 3 words) and "reason" (1 sentence explanation of why this query is highly relevant to the main topic).
        """
        try:
            raw_plan = await self.llm.generate([{"role": "user", "content": plan_prompt}])
            json_match = re.search(r'\[.*\]', raw_plan, re.DOTALL)
            plan_data = json.loads(json_match.group(0)) if json_match else [{"query": self.query[:20], "reason": "Fallback search initialization."}]
        except Exception:
            plan_data = [{"query": self.query[:20], "reason": "Fallback search initialization."}]
            
        current_queries = [item.get("query", self.query[:20]) for item in plan_data][:3]
        
        while self.current_iteration < self.max_iterations:
            self.current_iteration += 1
            progress = 10.0 + (float(self.current_iteration) / self.max_iterations) * 75.0 
            
            self.current_agent = "Search Agent"
            await self.update_callback(self.current_agent, progress, f"Executing parallel search iteration {self.current_iteration}.")
            
            search_tasks = [self.scraper.execute_search(q) for q in current_queries]
            search_results = await asyncio.gather(*search_tasks)
            
            all_urls = []
            for urls in search_results:
                for url in urls[:3]:
                    all_urls.append(url)

            all_urls = list(set(all_urls))[:5]
            if not all_urls:
                break
                
            self.current_agent = "Scraper Agent"
            await self.update_callback(self.current_agent, progress + 5.0, f"Scraping {len(all_urls)} source assets.")
            scraped_pages = await self.scraper.scrape_batch(all_urls)

            self.current_agent = "Fact Checker Agent"
            parsed_facts = []

            for idx, page in enumerate(scraped_pages):
                if not page.get("text"):
                    continue
                    
                url = page["url"]
                cred = SourceCredibilityEngine.evaluate(page)
                self.sources.append(cred)
                self.vector_store.add_document(page["text"], {"url": url})
                parsed_facts.append(page)
                
            self.current_agent = "Contradiction Analyzer Agent"
            iteration_conflicts = await self.contradiction_engine.discover_conflicts(parsed_facts)
            for conflict in iteration_conflicts:
                self.contradictions.append(conflict)

            self.current_agent = "Skeptic Agent"
            next_q = await self.llm.generate([{"role": "user", "content": f"Formulate a single sharp 3-word search query to resolve a gap on '{self.query}'."}])
            current_queries = [next_q.strip().replace('"', '')]
            
        self.current_agent = "Report Writer Agent"
        await self.update_callback(self.current_agent, 90.0, "Synthesizing full analytical response text.")
        
        report_prompt = f"""
        Write a comprehensive, enterprise-grade research report on the query: '{self.query}'. 
        # Executive Summary
        # Deep Analysis
        # Contradiction Evaluation
        # Future Implications
        """
        self.final_report = await self.llm.generate([{"role": "user", "content": report_prompt}], temperature=0.3)
        await self.update_callback("Complete", 100.0, "Research finalized. Awaiting neural simulation trigger.")