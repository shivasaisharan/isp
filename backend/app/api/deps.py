from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.models import User, Organization, OrganizationMembership

security = HTTPBearer(auto_error=False)

def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject identifier",
        )
        
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user and email:
        user = db.query(User).filter(User.email == email.lower(), User.is_active == True).first()
        
    # Auto-provision profile if authenticated by Supabase Auth but not yet in PostgreSQL
    if not user and email:
        meta = payload.get("user_metadata", {}) or {}
        role = (meta.get("role") or payload.get("role", "candidate")).lower()
        if role in ["hr", "org_admin"]:
            role = "hr"
        else:
            role = "candidate"
            
        full_name = meta.get("full_name") or email.split("@")[0].capitalize()
        user = User(
            id=user_id,
            email=email.lower(),
            hashed_password="[SUPABASE_MANAGED_AUTH]",
            full_name=full_name,
            phone=meta.get("phone"),
            role=role,
            is_active=True
        )
        db.add(user)
        db.flush()
        
        if role == "candidate":
            from app.models.models import CandidateProfile
            from app.services.resume_service import generate_anonymized_alias
            profile = CandidateProfile(
                user_id=user.id,
                headline="Candidate Profile",
                skills=[],
                anonymized_alias=generate_anonymized_alias()
            )
            db.add(profile)
        elif role == "hr":
            from app.models.models import Organization, OrganizationMembership
            import re
            org = db.query(Organization).first()
            if not org:
                base_slug = re.sub(r'[^a-z0-9]+', '-', user.full_name.lower()).strip('-') or "default-org"
                org = Organization(
                    name=f"{user.full_name}'s Organization",
                    slug=f"{base_slug}-{user.id[:8]}",
                    plan="professional"
                )
                db.add(org)
                db.flush()
            membership = OrganizationMembership(
                organization_id=org.id,
                user_id=user.id,
                role="admin"
            )
            db.add(membership)
            
        db.commit()
        db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists or is disabled",
        )
    return user

def require_candidate(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Candidate portal permission required"
        )
    return current_user

def require_hr(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: HR Recruiter portal permission required"
        )
    return current_user

def get_current_hr_membership(
    hr_user: User = Depends(require_hr),
    db: Session = Depends(get_db)
) -> OrganizationMembership:
    membership = (
        db.query(OrganizationMembership)
        .filter(OrganizationMembership.user_id == hr_user.id)
        .first()
    )
    if not membership:
        from app.models.models import Organization
        import re
        org = db.query(Organization).first()
        if not org:
            base_slug = re.sub(r'[^a-z0-9]+', '-', hr_user.full_name.lower()).strip('-') or "default-org"
            org = Organization(
                name=f"{hr_user.full_name}'s Organization",
                slug=f"{base_slug}-{hr_user.id[:8]}",
                plan="professional"
            )
            db.add(org)
            db.flush()
        membership = OrganizationMembership(
            organization_id=org.id,
            user_id=hr_user.id,
            role="admin"
        )
        db.add(membership)
        db.commit()
        db.refresh(membership)
    return membership
