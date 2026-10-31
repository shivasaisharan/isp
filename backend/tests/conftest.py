import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.services.seed_service import seed_database
from app.models.models import Organization

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    for org in db.query(Organization).all():
        org.active_jobs_limit = 10000
    db.commit()
    db.close()
    yield

@pytest.fixture
def client():
    return TestClient(app)
