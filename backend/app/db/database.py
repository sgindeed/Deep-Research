import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text

logger = logging.getLogger("Database")

DATABASE_URL = "sqlite+aiosqlite:///./research_engine.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    """FastAPI Dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Creates tables on startup and automatically applies missing columns (Auto-Migration)."""
    async with engine.begin() as conn:
        # 1. Create tables if they do not exist
        await conn.run_sync(Base.metadata.create_all)
        
        # 2. Production Auto-Migration: Dynamically check and add missing columns
        try:
            # Query SQLite for the existing columns in the research_sessions table
            result = await conn.execute(text("PRAGMA table_info(research_sessions)"))
            existing_columns = [row[1] for row in result.fetchall()]
            
            # Define the new columns introduced by the Microfish/Simulation update
            schema_updates = {
                "future_report": "TEXT",
                "future_outcomes": "JSON",
                "debate_transcript": "JSON"
            }
            
            # Compare and patch the schema on the fly
            for column_name, column_type in schema_updates.items():
                if column_name not in existing_columns:
                    logger.warning(f"Production Auto-Migration: Injecting missing column '{column_name}' into research_sessions")
                    await conn.execute(text(f"ALTER TABLE research_sessions ADD COLUMN {column_name} {column_type}"))
                    
        except Exception as e:
            logger.error(f"Schema auto-migration skipped or failed: {str(e)}")