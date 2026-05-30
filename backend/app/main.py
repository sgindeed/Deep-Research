import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import our modular routers and DB initialization
from app.api.routes import router as research_router
from app.api.auth import router as auth_router
from app.db.database import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ResearchAPI")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database tables...")
    await init_db()
    logger.info("System ready.")
    yield

app = FastAPI(title="Deep Research Engine", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the modular routers
app.include_router(auth_router)
app.include_router(research_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)