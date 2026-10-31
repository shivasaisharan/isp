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

