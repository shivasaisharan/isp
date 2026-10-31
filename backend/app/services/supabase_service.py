import os
from typing import Optional
from pathlib import Path
from app.core.config import settings

_supabase_client = None

def get_supabase_client():
    """
    Returns an initialized Supabase Python client using service role key
    for privileged backend operations (storage, auth admin, RLS bypass).
    Returns None if Supabase is not configured.
    """
    global _supabase_client
    if not settings.is_supabase_enabled:
        return None
    
    if _supabase_client is None:
        try:
            from supabase import create_client, Client
            _supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY
            )
        except Exception as e:
            print(f"[Supabase Warning] Could not initialize Supabase client: {e}")
            return None
            
    return _supabase_client

class SupabaseStorageService:
    BUCKET_RESUMES = "candidate-resumes"
    BUCKET_AUDIO = "interview-audio"
    BUCKET_REPORTS = "assessment-reports"
    BUCKET_ORG_ASSETS = "organization-assets"

    @classmethod
    def upload_file(cls, bucket: str, path: str, file_bytes: bytes, content_type: str = "application/pdf") -> Optional[str]:
        """
        Uploads a binary file to a private Supabase Storage bucket.
        Returns the storage path or None if Supabase is disabled/fails.
        """
        client = get_supabase_client()
        if not client:
            return None
        try:
            res = client.storage.from_(bucket).upload(
                path=path,
                file=file_bytes,
                file_options={"content-type": content_type, "upsert": "true"}
            )
            return path
        except Exception as e:
            print(f"[Supabase Storage Error] Failed to upload {path} to {bucket}: {e}")
            return None

    @classmethod
    def get_signed_url(cls, bucket: str, path: str, expires_in: int = 3600) -> Optional[str]:
        """
        Generates a secure, time-limited signed URL for a private storage object.
        """
        client = get_supabase_client()
        if not client:
            return None
        try:
            res = client.storage.from_(bucket).create_signed_url(path, expires_in)
            return res.get("signedURL") or res.get("signedUrl")
        except Exception as e:
            print(f"[Supabase Storage Error] Failed to generate signed URL for {path}: {e}")
            return None

    @classmethod
    def delete_file(cls, bucket: str, path: str) -> bool:
        """
        Deletes a file from Supabase storage.
        """
        client = get_supabase_client()
        if not client:
            return False
        try:
            client.storage.from_(bucket).remove([path])
            return True
        except Exception as e:
            print(f"[Supabase Storage Error] Failed to delete {path} from {bucket}: {e}")
            return False
