from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import Notification, UserActivityEvent, AuditEvent

def create_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None
) -> Notification:
    """Creates and persists an in-app notification for a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        is_read=False
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def record_user_activity(
    db: Session,
    user_id: str,
    event_type: str,
    description: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None
) -> UserActivityEvent:
    """Records an immutable candidate or HR activity event into the timeline."""
    event = UserActivityEvent(
        user_id=user_id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        metadata_json=metadata_json or {}
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def record_audit_log(
    db: Session,
    organization_id: Optional[str],
    actor_id: Optional[str],
    actor_role: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details_json: Optional[Dict[str, Any]] = None
) -> AuditEvent:
    """Records an audit trail event for compliance, ethics, and transparency."""
    audit = AuditEvent(
        organization_id=organization_id,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details_json=details_json or {}
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit
