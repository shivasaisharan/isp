from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import verify_password, hash_password, create_access_token
from app.models.models import User, CandidateProfile, Organization, OrganizationMembership, UserActivityEvent
from app.schemas.schemas import UserCreateCandidate, UserCreateHR, UserLogin, Token, UserOut
from app.services.resume_service import generate_anonymized_alias
from app.services.notification_service import record_user_activity, record_audit_log

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/candidate/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_candidate(user_in: UserCreateCandidate, db: Session = Depends(get_db)):
    """Registers a new candidate user with an isolated candidate profile."""
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )
    
    new_user = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        role="candidate",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initialize candidate profile
    profile = CandidateProfile(
        user_id=new_user.id,
        headline="Aspiring Professional",
        summary="Looking for exciting technical opportunities.",
        skills=[],
        anonymized_alias=generate_anonymized_alias()
    )
    db.add(profile)

    # Record account created activity
    record_user_activity(
        db=db,
        user_id=new_user.id,
        event_type="account_created",
        description="Candidate account registered and initialized."
    )

    access_token = create_access_token(subject=new_user.id, role="candidate")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role
        }
    }

@router.post("/candidate/login", response_model=Token)
def login_candidate(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticates candidate credentials. Rejects non-candidate accounts."""
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect candidate email or password"
        )
    if user.role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This email belongs to an HR Recruiter account. Please sign in via the HR Portal."
        )

    record_user_activity(
        db=db,
        user_id=user.id,
        event_type="login",
        description="Candidate signed into the Candidate Portal."
    )

    access_token = create_access_token(subject=user.id, role="candidate")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "avatar_url": user.avatar_url
        }
    }

@router.post("/hr/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_hr(user_in: UserCreateHR, db: Session = Depends(get_db)):
    """Registers an HR recruiter along with their dedicated organizational tenant."""
    existing_user = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    slug = user_in.organization_name.lower().replace(" ", "-").replace(".", "")
    existing_org = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_org:
        org = existing_org
    else:
        org = Organization(
            name=user_in.organization_name,
            slug=slug,
            plan="professional",
            active_jobs_limit=25,
            monthly_interview_allowance=250
        )
        db.add(org)
        db.commit()
        db.refresh(org)

    new_hr = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        role="hr",
        is_active=True
    )
    db.add(new_hr)
    db.commit()
    db.refresh(new_hr)

    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=new_hr.id,
        role="admin"
    )
    db.add(membership)
    db.commit()

    record_audit_log(
        db=db,
        organization_id=org.id,
        actor_id=new_hr.id,
        actor_role="hr",
        action="HR_REGISTERED",
        details_json={"organization": org.name, "email": new_hr.email}
    )

    access_token = create_access_token(subject=new_hr.id, role="hr")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_hr.id,
            "email": new_hr.email,
            "full_name": new_hr.full_name,
            "role": new_hr.role,
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan": org.plan
            }
        }
    }

@router.post("/hr/login", response_model=Token)
def login_hr(credentials: UserLogin, db: Session = Depends(get_db)):
    """Authenticates HR recruiter credentials. Rejects non-HR accounts."""
    user = db.query(User).filter(User.email == credentials.email.lower()).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect HR recruiter email or password"
        )
    if user.role != "hr":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has Candidate privileges. Please sign in through the Candidate Portal."
        )

    membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == user.id).first()
    org_dict = None
    if membership and membership.organization:
        org_dict = {
            "id": membership.organization.id,
            "name": membership.organization.name,
            "slug": membership.organization.slug,
            "plan": membership.organization.plan
        }

    access_token = create_access_token(subject=user.id, role="hr")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "organization": org_dict
        }
    }

@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns authenticated user profile along with role tenancy details."""
    user_data = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at
    }
    if user.role == "hr":
        membership = db.query(OrganizationMembership).filter(OrganizationMembership.user_id == user.id).first()
        if membership and membership.organization:
            user_data["organization"] = {
                "id": membership.organization.id,
                "name": membership.organization.name,
                "slug": membership.organization.slug,
                "plan": membership.organization.plan,
                "membership_role": membership.role
            }
    elif user.role == "candidate":
        if user.candidate_profile:
            user_data["candidate_profile"] = {
                "id": user.candidate_profile.id,
                "headline": user.candidate_profile.headline,
                "summary": user.candidate_profile.summary,
                "education": user.candidate_profile.education,
                "experience_years": user.candidate_profile.experience_years,
                "skills": user.candidate_profile.skills,
                "location": user.candidate_profile.location,
                "anonymized_alias": user.candidate_profile.anonymized_alias
            }
    return user_data

@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    """Session invalidation confirmation endpoint."""
    return {"message": "Successfully logged out. Please clear client-side authorization headers."}
