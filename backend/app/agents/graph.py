import asyncio
import logging
import json
import re
import random
import networkx as nx
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
        
        self.graph = nx.DiGraph()
        self.graph.add_node("START", type="system", label="Initialization", color="#ef4444", description="System Boot")
        
        self.current_iteration = 0
        self.sources = []
        self.contradictions = []
        self.final_report = ""
        self.confidence_score = 1.0
        self.current_agent = "Planner Agent"

    async def _generate_node_metadata(self, url: str, text: str) -> Dict[str, str]:
        """Asks the LLM to dynamically categorize a scraped page and assign a vibrant color."""
        
        # A vibrant fallback palette just in case the LLM fails or hits rate limits
        fallback_colors = ["#f43f5e", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#84cc16"]
        safe_color = random.choice(fallback_colors)
        
        prompt = f"""
        Analyze the following text extracted from {url}. 
        1. Categorize the source type in exactly 1 or 2 words (e.g., "Research Paper", "Opinion Piece", "Documentation", "Forum Debate").
        2. Assign a HIGHLY DISTINCT, VIBRANT hex color code based on the context and sentiment of the text. 
           - FORCE diverse colors. Do NOT use gray, black, or plain white.
           - Pick a unique color that fits the vibe of the text.
        3. Write a concise, 2-sentence summary of the core argument or information presented.
        
        Output strictly as JSON: {{"category": "...", "color": "...", "summary": "..."}}
        
        Text Snippet: {text[:2000]}
        """
        try:
            raw_res = await self.llm.generate([{"role": "user", "content": prompt}], temperature=0.4)
            json_match = re.search(r'\{.*\}', raw_res, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(0))
                # Validate the LLM returned a real hex code
                if not data.get("color", "").startswith("#"):
                    data["color"] = safe_color
                return data
                
            return {"category": "url", "color": safe_color, "summary": "Data source successfully parsed."}
        except Exception:
            return {"category": "url", "color": safe_color, "summary": "Data source successfully parsed."}

    async def execute(self):
        await self.update_callback("Planner Agent", 10.0, "Constructing analytical execution nodes.")
        
        # Define Root Node
        root_label_prompt = f"Summarize this query in exactly 3 words or less: '{self.query}'"
        root_label = await self.llm.generate([{"role": "user", "content": root_label_prompt}])
        root_label = root_label.strip().replace('"', '')
        
        self.graph.add_node(self.query, type="query", label=root_label[:30], color="#8b5cf6", description="Original User Prompt")
        self.graph.add_edge("START", self.query, relation="initiates")
        
        plan_prompt = f"Topic: '{self.query}'. Generate exactly 3 short search queries. Maximum 3 words per query. DO NOT include any conversational text. Output ONLY the 3 queries, separated by line breaks."
        raw_plan = await self.llm.generate([{"role": "user", "content": plan_prompt}])
        
        subtopics = []
        for line in raw_plan.split("\n"):
            clean_line = line.strip().replace('- ', '').replace('* ', '').replace('"', '')
            if clean_line and "here are" not in clean_line.lower():
                subtopics.append(clean_line)
        current_queries = subtopics[:3] if subtopics else [self.query[:20]]
        
        while self.current_iteration < self.max_iterations:
            self.current_iteration += 1
            progress = 10.0 + (float(self.current_iteration) / self.max_iterations) * 70.0
            
            self.current_agent = "Search Agent"
            await self.update_callback(self.current_agent, progress, f"Executing parallel search iteration {self.current_iteration}.")
            
            search_tasks = [self.scraper.execute_search(q) for q in current_queries]
            search_results = await asyncio.gather(*search_tasks)
            
            all_urls = []
            for idx, urls in enumerate(search_results):
                q_node = current_queries[idx]
                if not self.graph.has_node(q_node):
                    self.graph.add_node(q_node, type="query", label=q_node, color="#3b82f6", description="Autonomous Sub-Query")
                    self.graph.add_edge(self.query, q_node, relation="expands")
                
                for url in urls[:3]:
                    all_urls.append(url)
                    self.graph.add_node(url, type="url", label="Pending...")
                    self.graph.add_edge(q_node, url, relation="yields")

            all_urls = list(set(all_urls))[:5]
            if not all_urls:
                break
                
            self.current_agent = "Scraper Agent"
            await self.update_callback(self.current_agent, progress + 5.0, f"Scraping {len(all_urls)} source assets.")
            scraped_pages = await self.scraper.scrape_batch(all_urls)
            
            if scraped_pages:
                titles = [p.get("title", "Unknown") for p in scraped_pages]
                label_prompt = f"Summarize each of the following webpage titles into a strict maximum of 3 words per title. Output a valid JSON array of strings in the exact same order.\nTitles: {titles}"
                try:
                    raw_labels = await self.llm.generate([{"role": "user", "content": label_prompt}], temperature=0.1)
                    json_match = re.search(r'\[\s*.*\s*\]', raw_labels, re.DOTALL)
                    url_labels = json.loads(json_match.group(0)) if json_match else []
                except Exception:
                    url_labels = []

            self.current_agent = "Fact Checker Agent"
            parsed_facts = []
            
            # Fire LLM metadata requests concurrently to save time
            metadata_tasks = []
            for page in scraped_pages:
                if page.get("text"):
                    metadata_tasks.append(self._generate_node_metadata(page["url"], page["text"]))
            
            node_metadata_results = await asyncio.gather(*metadata_tasks) if metadata_tasks else []

            valid_idx = 0
            for idx, page in enumerate(scraped_pages):
                if not page.get("text"):
                    continue
                    
                url = page["url"]
                cred = SourceCredibilityEngine.evaluate(page)
                self.sources.append(cred)
                self.vector_store.add_document(page["text"], {"url": url})
                parsed_facts.append(page)
                
                # Retrieve the corresponding LLM classifications
                llm_meta = node_metadata_results[valid_idx] if valid_idx < len(node_metadata_results) else {"category": "url", "color": "#10b981", "summary": ""}
                valid_idx += 1
                
                safe_title = page.get("title", "Source Document")
                label_3w = url_labels[idx] if (url_labels and idx < len(url_labels)) else " ".join(safe_title.split()[:3])
                
                # Check for redirects or exact matches and update the Graph Nodes
                if self.graph.has_node(url):
                    self.graph.nodes[url]["label"] = label_3w
                    self.graph.nodes[url]["type"] = llm_meta.get("category", "url")
                    self.graph.nodes[url]["color"] = llm_meta.get("color", "#10b981")
                    self.graph.nodes[url]["description"] = llm_meta.get("summary", "")
                    self.graph.nodes[url]["metadata"] = cred
                else:
                    updated = False
                    for node in list(self.graph.nodes):
                        if self.graph.nodes[node].get("type") == "url" and self.graph.nodes[node].get("label") == "Pending...":
                            self.graph.nodes[node]["label"] = label_3w
                            self.graph.nodes[node]["type"] = llm_meta.get("category", "url")
                            self.graph.nodes[node]["color"] = llm_meta.get("color", "#10b981")
                            self.graph.nodes[node]["description"] = llm_meta.get("summary", "")
                            self.graph.nodes[node]["metadata"] = cred
                            updated = True
                            break
                    if not updated:
                        self.graph.add_node(
                            url, 
                            type=llm_meta.get("category", "url"), 
                            label=label_3w, 
                            color=llm_meta.get("color", "#10b981"),
                            description=llm_meta.get("summary", ""),
                            metadata=cred
                        )
                
            self.current_agent = "Contradiction Analyzer Agent"
            iteration_conflicts = await self.contradiction_engine.discover_conflicts(parsed_facts)
            for conflict in iteration_conflicts:
                self.contradictions.append(conflict)
                c_id = f"conflict_{uuid4().hex[:6]}"
                c_label = conflict.get("label_3_words", "Logical Conflict")
                c_summary = conflict.get("contradiction_summary", "Factual mismatch detected.")
                
                self.graph.add_node(c_id, type="contradiction", label=c_label, color="#f59e0b", description=c_summary)
                self.graph.add_edge(conflict.get("source_a", ""), c_id, relation="contradicts")
                self.graph.add_edge(conflict.get("source_b", ""), c_id, relation="contradicts")

            self.current_agent = "Skeptic Agent"
            gap_prompt = f"Review compiled data on '{self.query}'. Formulate a single sharp search query to resolve a missing gap. Maximum 3 words."
            next_q = await self.llm.generate([{"role": "user", "content": gap_prompt}])
            current_queries = [next_q.strip().replace('"', '')]
            
        self.current_agent = "Report Writer Agent"
        await self.update_callback(self.current_agent, 90.0, "Synthesizing full analytical response text.")
        
        report_prompt = f"""
        Write a comprehensive, enterprise-grade research report on the query: '{self.query}'. 
        Organize with exactly these Markdown headers: 
        # Executive Summary
        # Deep Analysis
        # Contradiction Evaluation
        # Future Implications
        
        STRICT FORMATTING REQUIREMENTS:
        - You MUST include at least one Markdown table to compare data, entities, or statistics.
        - Use bulleted and numbered lists to break down key takeaways.
        - Use **bold text** to emphasize crucial insights and metrics.
        - Maintain a highly professional, analytical, and objective tone (like a McKinsey or Gartner report).
        
        Synthesize the information from the {len(self.sources)} compiled sources. Always include inline reference citations (e.g., [1], [2]).
        """
        
        self.final_report = await self.llm.generate([{"role": "user", "content": report_prompt}], temperature=0.3)
        
        await self.update_callback("Complete", 100.0, "Research processing finalized safely.")
