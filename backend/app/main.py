import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.services.seed_service import seed_database
from app.services.decision_service import recover_historical_decisions

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.candidate import router as candidate_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.applications import router as applications_router
from app.api.v1.interviews import router as interviews_router
from app.api.v1.reports import router as reports_router
from app.api.v1.rankings import router as rankings_router
from app.api.v1.decisions import router as decisions_router
from app.api.v1.hr_decisions import router as hr_decisions_router
from app.api.v1.activity import router as activity_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.organization import router as organization_router
from app.api.v1.analytics import router as analytics_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist & seed demo data
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        recovered = recover_historical_decisions(db)
        if recovered > 0:
            print(f"[Decision History Migration] Successfully recovered {recovered} historical decision records.")
    finally:
        db.close()
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Commercial-grade AI Recruitment & Interview SaaS Platform",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount upload directory
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

# Include API v1 routers
prefix = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=prefix)
app.include_router(candidate_router, prefix=prefix)
app.include_router(jobs_router, prefix=prefix)
app.include_router(applications_router, prefix=prefix)
app.include_router(interviews_router, prefix=prefix)
app.include_router(reports_router, prefix=prefix)
app.include_router(rankings_router, prefix=prefix)
app.include_router(decisions_router, prefix=prefix)
app.include_router(hr_decisions_router, prefix=prefix)
app.include_router(activity_router, prefix=prefix)
app.include_router(notifications_router, prefix=prefix)
app.include_router(organization_router, prefix=prefix)
app.include_router(analytics_router, prefix=prefix)

@app.get("/")
def root():
    return {
        "status": "online",
        "product": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_v1": f"{settings.API_V1_PREFIX}/docs",
        "modules": [
            "Candidate Portal & Profiles",
            "HR Recruiter Portal & Job Catalogs",
            "Resume Parsing & Blind Screening",
            "Turn-by-turn AI Interview Engine",
            "Explainable Top-5 Candidate Ranking",
            "Human-Controlled Hiring Decisions",
            "Candidate Activity History",
            "Persistent Multi-Tenant Database"
        ]
    }
