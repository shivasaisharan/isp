# Smart Recruit — Architecture & Implementation Status
**Last Updated:** October 30, 2026  
**Platform Status:** Operational (FastAPI + React 19 + Faster-Whisper + S-BERT + SQLite/PostgreSQL)  
**Core Directive:** **AI Recommends. HR Decides.**

---

## 1. System Architecture Matrix

```
[ Public Marketing Website ] (Landing, Features, How It Works, Pricing, Terms)
              │
              ├── [ Candidate Portal ]
              │       ├── Auth & Blind Profile (Candidate #XXXX alias)
              │       ├── PDF Resume Parsing & Taxonomy Extraction
              │       ├── Match Analysis & Fit Test (>50% Hard Filter)
              │       ├── Adaptive AI Voice Interview (Faster-Whisper STT)
              │       ├── Real-time Speech-to-Text with Zero Stutter/Repetition
              │       ├── Transparent Rubric Scorecard & Radar Chart
              │       └── Full Application Timeline & Status History
              │
              ├── [ HR Recruiter Portal ]
              │       ├── Multi-tenant Organization & Team Management
              │       ├── Job Description Builder with Skill Weights
              │       ├── Applicant Tracking System (ATS Pipeline)
              │       ├── Explainable Top-5 Candidate Recommendation Board
              │       ├── Side-by-Side Candidate Comparison (Radar & Matrix)
              │       ├── Full Answer Evidence & Question-Wise Review
              │       ├── Human Hiring Decision Workflow (Hire / Reject / Next Round)
              │       ├── Mandatory HR Audit Logging & Notes
              │       └── Recruitment Conversion Analytics & Funnel Charts
              │
              └── [ Super Admin Portal ]
                      ├── Organization Tenancy Supervision
                      ├── User Account & Subscription Plan Management
                      └── Global Security & Audit Event Logs
```

---

## 2. Phase-by-Phase Roadmap & Delivery Verification

| Phase | Milestone | Features & Components | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Foundation** | FastAPI + React 19 + SQLAlchemy + JWT Auth + RBAC | **COMPLETED** |
| **Phase 2** | **Jobs & Portals** | Multi-tenant Org isolation, Job publishing, Candidate apply | **COMPLETED** |
| **Phase 3** | **Resume Intelligence** | PDF extraction, 50+ Skill Taxonomy, TF-IDF / S-BERT fit | **COMPLETED** |
| **Phase 4** | **Interview Engine** | Dynamic question generator, Audio playback, 15m timer | **COMPLETED** |
| **Phase 5** | **Faster-Whisper STT** | CTranslate2 + PyAV 16kHz audio decoding, zero repetition | **COMPLETED** |
| **Phase 6** | **Strict NLP Scoring** | Type-Token Ratio, Cosine similarity, Anti-gibberish filter | **COMPLETED** |
| **Phase 7** | **HR Intelligence** | Top-5 ranking board, Candidate compare, Human decision | **COMPLETED** |
| **Phase 8** | **Analytics & Admin** | Radar competency charts, Audit trails, System telemetry | **COMPLETED** |
| **Phase 9** | **Secure Full-Screen Proctoring** | Full-screen enforcement, 3-strike violation policy, HR security audit report | **COMPLETED** |
| **Phase 10** | **Scorecard & Score Unification** | View Score in HR, dedicated `HrCandidateScorecard.jsx`, authoritative composite fit formula (40/40/20) | **COMPLETED** |

---

## 3. Discrepancy Investigation & Mathematical Resolution

### The Problem Identified:
- **Candidate Portal:** Displayed `0.8%` (or `40.5%`) with the header mistakenly labeled `"Overall Fit Score"`.
- **HR Portal:** Displayed `18.2%` under `"Overall Fit"`.

### Root Cause Analysis:
1. **Interview Assessment Score:**
   The AI Interview Room scores 5 technical dimensions on a 0-100 scale:
   $$\text{Interview Score} = (\text{Technical} \times 0.35) + (\text{Problem Solving} \times 0.25) + (\text{Job Skills} \times 0.20) + (\text{Communication} \times 0.10) + (\text{Project Depth} \times 0.10)$$
   When a candidate only articulates foundational communication ($8.0\%$) with other dimensions at zero:
   $$(0 \times 0.35) + (0 \times 0.25) + (0 \times 0.20) + (8.0 \times 0.10) + (0 \times 0.10) = 0.8\%$$
   This was the candidate's **Interview Assessment Score**, but the UI banner erroneously labeled it "Overall Fit Score".

2. **Legacy Ranking Weights:**
   The legacy `rubric.py` previously evaluated composite rank using $30\%$ resume, $50\%$ interview, and $20\%$ skills:
   $$(31.6 \times 0.30) + (0.8 \times 0.50) + (41.7 \times 0.20) = 9.48 + 0.40 + 8.34 = 18.22\% \rightarrow \mathbf{18.2\%}$$

### Authoritative Resolution:
The system now enforces one authoritative formula across all candidate and HR interfaces:
$$\mathbf{\text{Overall Candidate Fit} = (\text{Resume Match} \times 0.40) + (\text{Interview Assessment} \times 0.40) + (\text{Verified Skills} \times 0.20)}$$

Applying the verified formula to candidate data:
$$(31.6 \times 0.40) + (0.8 \times 0.40) + (41.7 \times 0.20) = 12.64 + 0.32 + 8.34 = \mathbf{21.3\%}$$

Both interfaces now clearly distinguish:
- **Interview Assessment Score:** Candidate voice interview performance ($0.8\%$ or $40.5\%$).
- **Overall Candidate Fit Score:** Multi-signal composite ranking ($21.3\%$).

---

## 3. Automated Test Verification

All 10 backend integration and security test suites are passing (`10 passed in 8.17s`):
- `test_health_check` (API operational)
- `test_candidate_registration_and_login`
- `test_hr_registration_and_login`
- `test_cross_portal_login_rejection` (Strict RBAC isolation)
- `test_candidate_data_persistence`
- `test_candidate_resume_deletion`
- `test_unauthenticated_request_rejected`
- `test_candidate_cannot_access_hr_endpoints`
- `test_candidate_cannot_submit_hiring_decision` (Enforces *AI Recommends, HR Decides*)
- `test_full_recruitment_lifecycle` (Job -> Apply -> Interview -> Scoring -> Ranking -> Decision)

---

## 4. Live Localhost Access

| Service | Port | Local URL |
| :--- | :---: | :--- |
| **Frontend Web App** | `5173` | **[http://localhost:5173](http://localhost:5173)** |
| **Candidate Portal** | `5173` | **[http://localhost:5173/candidate/login](http://localhost:5173/candidate/login)** |
| **HR Recruiter Portal** | `5173` | **[http://localhost:5173/hr/login](http://localhost:5173/hr/login)** |
| **Backend REST API** | `8000` | **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)** |
| **GitHub Repository** | Git | **[https://github.com/shivasaisharan/isp.git](https://github.com/shivasaisharan/isp.git)** |

---

## 5. Phase 12: HR Confirmed Hiring Decisions & Complete Decision History

### A. Root Cause Analysis
Prior to this release, rejected candidates and historical decision trails were not properly displayed in the Confirmed Hiring Decisions dashboard due to:
1. **Model Limitations:** The legacy `HiringDecision` model enforced a 1-to-1 unique application constraint without preserving historical event chronologies.
2. **Missing Decision History Pipeline:** Earlier rejection transitions updated the application status directly without creating dedicated immutable decision records.
3. **Data Display Discrepancies:** The frontend only recognized `selected` and omitted candidate demographics, reviewer identities, and position metadata.

### B. Architecture & Resolution
- **Dedicated Table (`hr_decision_history`):** Added `HrDecisionHistory` with foreign keys, indexes, and immutable audit fields (`id`, `organization_id`, `application_id`, `candidate_id`, `job_id`, `reviewer_id`, `decision`, `decision_notes`, `previous_status`, `new_status`, `decided_at`).
- **Transactional Decision Engine:** Implemented `record_hr_decision_workflow` ensuring that updating application status, inserting into `hr_decision_history`, writing audit logs, notifying candidates, and upserting legacy records succeed atomically.
- **Idempotent Historical Recovery Migration:** Implemented `recover_historical_decisions` that automatically backfills pre-existing accepted/selected/rejected applications into `hr_decision_history` without duplicating records or fabricating data.
- **REST APIs:** Implemented `/api/v1/hr/decisions`, `/api/v1/hr/decisions/summary`, `/api/v1/hr/decisions/{id}`, and `/api/v1/hr/decisions/export`.
- **Comprehensive HR Dashboard (`HrDecisions.jsx`):**
  - Live summary cards: Total Decisions, Total Accepted, Total Rejected, Decisions This Month.
  - Multi-criteria filtering: Decision outcome tabs (All, Accepted, Rejected), candidate search, job title search, reviewer selector, and date range filters.
  - Interactive history table with color-coded decision badges (Green ACCEPTED / Red REJECTED).
  - "View Details" modal surfacing candidate credentials, position, reviewer details, status transitions, full decision notes, and fit metrics.
  - Audit CSV export and page refresh capabilities.
- **Automated Verification:** Added `tests/test_hr_decision_history.py` covering all 12 validation scenarios. 15 of 15 backend tests pass.

---

## 6. Phase 13: Dynamic HR Reviewer Filter & Database-Driven Reviewer Intelligence

### A. Architectural Enhancements
- **Dynamic Reviewer Discovery (`get_organization_reviewers_list`):** Replaced static/hardcoded values with database queries against `OrganizationMembership` and `User` models scoped to the authenticated HR recruiter's organization.
- **Role & Designation Resolution:** Maps internal organization roles (`admin`, `owner`, `lead`, `recruiter`) into professional designations (`Recruiter Admin`, `Senior Recruiter`, `HR Recruiter`) alongside actual historical decision counts.
- **Dual API Access:** Implemented both `GET /api/v1/hr/reviewers` and `GET /api/v1/hr/decisions/reviewers` with organization-level tenancy enforcement.
- **Reviewer-Specific Filtering:** Enables filtering by internal reviewer user ID (UUID) combined with outcome (`ACCEPTED`, `REJECTED`), candidate search, position search, date range, and sorting.
- **Enhanced UI Reviewer Selector (`HrDecisions.jsx`):**
  - Dropdown populated dynamically: `{name} – {designation} ({email})` with internal `value={user.id}`.
  - Active filter indicator badge with one-click clear button (`×`).
  - Loading, empty ("No HR reviewers found for this organization"), and error fallback states.
- **Automated Test Coverage:** Verified dynamic reviewer endpoints, tenant isolation, and multi-criteria composite filtering in `backend/tests/test_hr_decision_history.py` (15/15 tests passing).

---

## 7. Phase 14: Candidate Activity History Cleanup & Recruitment Event Tracking

### A. Problem Statement
The Candidate Portal's Activity History previously displayed repetitive authentication/session noise (e.g., hundreds of `LOGIN` and `LOGOUT` entries) and lacked structured recruitment event tracking, giving candidates no meaningful visibility into their application lifecycle.

### B. Architecture & Resolution
- **Auth Noise Filtered (Without Audit Log Loss):** Excluded `login`, `logout`, `session_created`, `session_expired`, `token_refreshed`, `page_visit`, `dashboard_opened`, `navigation_event`, and `browser_focus` from candidate-facing feeds while preserving all raw audit logs for system security and administrative compliance.
- **Dedicated Table (`candidate_recruitment_activities`):** Added `CandidateRecruitmentActivity` model with UUID primary keys, relationships to `User`, `Application`, `Job`, and `Organization`, JSON metadata, and timestamps.
- **14 Essential Recruitment Events Across 4 Categories:**
  1. *Resume:* `RESUME_UPLOADED`, `RESUME_UPDATED`, `RESUME_ANALYZED`, `RESUME_DELETED`
  2. *Job Applications:* `APPLICATION_SUBMITTED`, `APPLICATION_STATUS_UPDATED`, `APPLICATION_WITHDRAWN`
  3. *AI Interviews:* `INTERVIEW_SCHEDULED`, `INTERVIEW_STARTED`, `INTERVIEW_COMPLETED`, `ASSESSMENT_GENERATED`
  4. *Hiring Decisions:* `APPLICATION_ACCEPTED`, `APPLICATION_REJECTED`, `NEXT_ROUND`
- **Automatic Event Hooks:** Seamlessly integrated into backend business operations:
  - `apply_for_job()` generates `APPLICATION_SUBMITTED` with company and role metadata.
  - Resume upload/analyze/delete operations emit `RESUME_UPLOADED`, `RESUME_ANALYZED`, and `RESUME_DELETED`.
  - Interview start/complete emit `INTERVIEW_STARTED` and `INTERVIEW_COMPLETED` with score summaries.
  - HR decision workflow records `APPLICATION_ACCEPTED` and `APPLICATION_REJECTED`.
- **Idempotent Historical Recovery Migration:** `backfill_historical_recruitment_activities` automatically runs on startup, safely converting existing resumes, applications, and completed interviews into recruitment activity records without duplication.
- **REST APIs:**
  - `GET /api/v1/candidate/activities`: Paginated, multi-filter endpoint (`category`, `company_name`, `job_title`, `start_date`, `end_date`, `sort_order`, `page`, `page_size`).
  - `GET /api/v1/candidate/activities/summary`: Real-time candidate metrics (Resumes Uploaded, Jobs Applied, Interviews Completed, Applications Accepted).
  - Cleaned up legacy `GET /api/v1/activity`.
- **Candidate UI Redesign (`CandidateActivity.jsx`):**
  - Modern heading: **Candidate Activity** with subtitle: *"Track your recruitment journey, resume updates, job applications, AI interviews and hiring decisions in one place."*
  - 4 Summary metric cards with distinct accent colors and icons.
  - Category filter pills: All Activities, Resume Activities, Job Applications, AI Interviews, Hiring Decisions.
  - Search input (company & job title), date range pickers, sort order toggle, and filter reset.
  - Rich timeline items displaying event icons, formatted titles, company/job tags, human-readable relative/exact timestamps, status badges, and `APP-XXXXXX` reference badges.
  - Pagination controls and empty states with "Explore Open Jobs" action.
- **Supabase Migration:** Created `supabase/migrations/20261031_candidate_recruitment_activities.sql` with table definitions and Row Level Security (RLS) policies ensuring candidates only access their own recruitment milestones.
- **Automated Verification:** Added `backend/tests/test_candidate_activities.py`. All 19 backend tests across all test suites pass with 100% success; frontend production build passes cleanly.

---

## 8. Phase 15: Professional Immutable Responsible AI Compliance Audit Trail Redesign

### A. Problem Statement
The HR Portal's **Immutable Responsible AI Compliance Audit Trail** (`HrAnalytics.jsx`) previously displayed raw database UUIDs (e.g. `candidate_id: 5d8f191b...`, `job_id: 79dc53a0...`), unformatted JSON blobs, and technical event codes. This prevented recruiters and compliance officers from understanding who performed the action, which candidate and job were involved, and what decision explanation was recorded.

### B. Architecture & Resolution
- **Dynamic Relationship Resolution Service (`app.services.audit_service`):**
  - Resolves `candidate_id` → Candidate full name, reference (`CAND-XXXXXX`), and email.
  - Resolves `job_id` → Job position/title, department, reference (`JOB-XXXXXX`), and Organization name.
  - Resolves `actor_id` → HR recruiter name, employee reference (`HR-XXXXXX`), and designation (`Recruiter Admin`, `Senior Recruiter`, `HR Recruiter`) derived from `OrganizationMembership`.
  - Resolves status transitions (`previous_status` → `new_status`) and decision rationale notes.
  - Safe fallbacks for deleted or general organizational events ("General Organization Action", "Smart Recruit Enterprise").
- **Centralized Event Type Mapping:** Maps database actions to human-readable labels (`candidate_accepted` → "Candidate Accepted", `FINAL_HIRING_DECISION` → "Final Hiring Decision Recorded", `APPLICATION_STATUS_UPDATED` → "Application Status Updated", `INTERVIEW_VIOLATION` → "Interview Security Event Recorded", etc.) across 6 distinct categories.
- **Strict Immutability Enforced:** Zero historical records modified or deleted; display data is resolved dynamically at query time while preserving the original `details_json` and timestamps.
- **REST APIs:**
  - `GET /api/v1/hr/audit-trail`: Paginated, multi-filter endpoint (`category`, `event_type`, `search`, `reviewer_id`, `candidate_id`, `job_id`, `start_date`, `end_date`, `sort_order`, `page`, `page_size`).
  - `GET /api/v1/hr/audit-trail/summary`: Real-time audit metrics across categories (Total Events, Hiring Decisions, Applications, Interviews, Resumes, Security).
  - `GET /api/v1/hr/audit-trail/export`: Official compliance CSV download with human-readable headers and resolved candidate/job/performer details.
  - Updated legacy `GET /api/v1/analytics/audit-logs` for backward compatibility.
- **Redesigned Audit Interface (`HrAnalytics.jsx`):**
  - 6 Top summary cards with distinct accent colors and icons.
  - Category tabs: All Events, Hiring Decisions, Candidate Applications, Interview Events, Resume Events, Security Events, Job Management.
  - Search input, dynamic HR Reviewer dropdown, date range pickers, sort order selector, and reset button.
  - Enterprise dark navy & slate audit cards with action icon, title, category badge, date/time + relative time, candidate block, job/company block, performer block, status transition badges, and decision quote block.
  - Expandable technical audit inspector with raw JSON viewer and copy-to-clipboard functionality.
  - "Inspect Record" full modal dialog displaying verified audit details, transition timeline, and immutable audit certificate hash.
  - CSV export capability and responsive pagination bar.
- **Supabase Migration:** Created `supabase/migrations/20261031_immutable_compliance_audit_trail.sql` with table definitions, performance indexes, and strict Row Level Security (RLS) rules blocking updates and deletes.
- **Automated Verification:** Added `backend/tests/test_compliance_audit_trail.py` (5 tests covering resolution, summary metrics, composite filtering, CSV export, and organization isolation). All 24 backend tests pass; frontend build passes cleanly.





