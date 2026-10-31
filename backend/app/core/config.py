import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Recruit AI"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Secret Key for fallback JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-recruit-production-grade-jwt-secret-key-2026-secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    SUPABASE_JWT_ISSUER: str = os.getenv("SUPABASE_JWT_ISSUER", "")
    
    # Database: SQLite for local dev/testing; can be overridden via DATABASE_URL for PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'smart_recruit_prod.db'}")
    
    # File Uploads
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    
    # Gemini AI configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    @property
    def is_supabase_enabled(self) -> bool:
        return bool(
            self.SUPABASE_URL and 
            not self.SUPABASE_URL.startswith("https://your-project") and 
            self.SUPABASE_SERVICE_ROLE_KEY and
            not self.SUPABASE_SERVICE_ROLE_KEY.startswith("your-") and
            "YOUR_BACKEND_ONLY_SECRET" not in self.SUPABASE_SERVICE_ROLE_KEY
        )
    
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
