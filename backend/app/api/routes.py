import asyncio
import logging
from uuid import UUID, uuid4
from typing import Dict, Any

from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from app.models.schemas import ResearchRequest, FinalReportResponse
from app.models.db_models import ResearchSession, User
from app.db.database import get_db, AsyncSessionLocal
from app.core.auth import get_current_user
from app.agents.executor import DeepResearchWorkflowExecutor
from app.services.simulation import FutureSimulationEngine
from app.core.llm import ResilientLLMClient
from app.websocket.manager import ws_manager

logger = logging.getLogger("APIRoutes")
router = APIRouter()
active_jobs: Dict[UUID, DeepResearchWorkflowExecutor] = {}

async def build_status_callback(session_id: UUID):
    async def callback(agent: str, progress: float, output: str):
        logger.info(f"[{session_id}] {agent} | {progress}% | {output}")
        await ws_manager.send_research_update(session_id, agent, progress, output)
    return callback

async def run_background_workflow(session_id: UUID, executor: DeepResearchWorkflowExecutor):
    try:
        await executor.execute()
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(ResearchSession).where(ResearchSession.id == str(session_id)))
            db_session = result.scalar_one_or_none()
            if db_session:
                db_session.status = "completed"
                db_session.final_report = executor.final_report
                db_session.confidence_score = executor.confidence_score
                db_session.sources = executor.sources
                db_session.contradictions = executor.contradictions
                await db.commit()
    except Exception as e:
        logger.error(f"Execution failed: {str(e)}")
    finally:
        if session_id in active_jobs:
            del active_jobs[session_id]

async def run_simulation_workflow(session_id: UUID, query: str, context: str):
    async def sim_callback(payload: dict):
        await ws_manager.send_simulation_update(session_id, payload)
        
    engine = FutureSimulationEngine(ResilientLLMClient(), query, context, sim_callback)
    report, outcomes, transcript = await engine.run_simulation()
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(ResearchSession).where(ResearchSession.id == str(session_id)))
        db_session = result.scalar_one_or_none()
        if db_session:
            db_session.future_report = report
            db_session.future_outcomes = outcomes
            db_session.debate_transcript = transcript
            await db.commit()
            
    await ws_manager.send_simulation_update(session_id, {"type": "complete"})

@router.post("/research/start", response_model=Dict[str, Any])
async def start_research(payload: ResearchRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session_id = uuid4()
    cb = await build_status_callback(session_id)
    new_db_session = ResearchSession(id=str(session_id), user_id=current_user.id, query=payload.query, status="running")
    db.add(new_db_session)
    await db.commit()
    
    executor = DeepResearchWorkflowExecutor(session_id=session_id, query=payload.query, depth=payload.depth.value, max_iterations=payload.max_iterations, update_callback=cb)
    active_jobs[session_id] = executor
    background_tasks.add_task(run_background_workflow, session_id, executor)
    return {"research_id": session_id}

@router.post("/research/simulate/{id}")
async def trigger_simulation(id: UUID, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ResearchSession).where(ResearchSession.id == str(id)))
    db_session = result.scalar_one_or_none()
    if not db_session or not db_session.final_report:
        raise HTTPException(status_code=400, detail="Research not complete or missing context.")
    
    background_tasks.add_task(run_simulation_workflow, id, db_session.query, db_session.final_report)
    return {"status": "Simulation initiated"}

@router.get("/research/history")
async def get_user_history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(ResearchSession).where(ResearchSession.user_id == current_user.id).order_by(desc(ResearchSession.created_at))
    result = await db.execute(query)
    sessions = result.scalars().all()
    return [{"id": s.id, "query": s.query, "status": s.status, "created_at": s.created_at, "has_report": bool(s.final_report)} for s in sessions]

@router.get("/research/status/{id}")
async def get_status(id: UUID, db: AsyncSession = Depends(get_db)):
    if id in active_jobs:
        job = active_jobs[id]
        is_complete = job.current_agent == "Complete"
        return {"research_id": id, "status": "completed" if is_complete else "running", "current_agent": job.current_agent, "progress_percentage": 100.0 if is_complete else (job.current_iteration / job.max_iterations) * 100}
    
    result = await db.execute(select(ResearchSession).where(ResearchSession.id == str(id)))
    db_session = result.scalar_one_or_none()
    if not db_session:
        raise HTTPException(status_code=404, detail="Missing.")
    return {"research_id": id, "status": db_session.status, "current_agent": "Complete" if db_session.status == "completed" else "Unknown", "progress_percentage": 100.0 if db_session.status == "completed" else 0.0}

@router.get("/research/final/{id}", response_model=FinalReportResponse)
async def get_final_report(id: UUID, db: AsyncSession = Depends(get_db)):
    if id in active_jobs:
        job = active_jobs[id]
        return FinalReportResponse(
            research_id=id, 
            markdown_content=job.final_report, 
            sources=job.sources, 
            contradiction_map=job.contradictions,
            confidence_score=job.confidence_score, 
            future_report_markdown=job.future_report, 
            future_outcomes=job.future_outcomes, 
            debate_transcript=job.debate_transcript
        )
    
    result = await db.execute(select(ResearchSession).where(ResearchSession.id == str(id)))
    db_session = result.scalar_one_or_none()
    if not db_session or not db_session.final_report:
        raise HTTPException(status_code=404, detail="Not found.")
        
    return FinalReportResponse(
        research_id=id, 
        markdown_content=db_session.final_report, 
        sources=db_session.sources or [], 
        contradiction_map=db_session.contradictions or [],
        confidence_score=db_session.confidence_score or 1.0, 
        future_report_markdown=db_session.future_report, 
        future_outcomes=db_session.future_outcomes or [], 
        debate_transcript=db_session.debate_transcript or []
    )

@router.websocket("/ws/research/{id}")
async def websocket_research_endpoint(websocket: WebSocket, id: UUID):
    await ws_manager.connect(websocket, id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "PING":
                await websocket.send_text("PONG")
    except WebSocketDisconnect:
        ws_manager.disconnect(id)