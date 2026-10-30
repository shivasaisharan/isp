# Smart Recruit — Commercial-Grade AI Recruitment SaaS Platform

An enterprise-grade, multi-tenant AI recruitment platform that automates initial candidate screening and technical interviews while strictly maintaining exclusive hiring authority with human HR recruiters.

---

## 📌 Architecture & Division of Responsibility

```
[ Candidate Applies ] ➔ [ AI Resume Parsing ] ➔ [ AI Turn-by-Turn Interview ] ➔ [ AI Top-5 Board ] ➔ [ HR Final Hiring Decision ]
```

* **AI Responsibility:** Objective competency evaluation, turn-by-turn interactive interviews, and explainable Top-5 candidate recommendations.
* **HR Responsibility:** Exclusive legal and operational authority over candidate selection, job offers, and final rejection determinations with mandatory audit rationales.

---

## 🚀 Quickstart Commands

### 1. Prerequisites
* **Python 3.10+** (tested on Python 3.13)
* **Node.js 18+** & **npm**

---

### 2. Run the Backend API Server

Open a terminal in the project root:

```bash
# Navigate to backend directory
cd backend

# If not already activated, activate the existing virtual environment:
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# (Optional) If running for the first time in a fresh environment:
# pip install -r requirements.txt

# Start the FastAPI server:
python run.py
```
> The API server starts on **`http://localhost:8000`**.  
> Interactive Swagger API Documentation is accessible at **`http://localhost:8000/api/v1/docs`**.

---

### 3. Run the Frontend Client

Open a second terminal in the project root:

```bash
# Navigate to frontend directory
cd frontend

# (Optional) If running for the first time in a fresh environment:
# npm install

# Start Vite development server:
npm run dev
```
> The React client starts on **`http://localhost:5173`**.

---

### 4. Run the Automated Test Suite

Open a terminal in the project root:

```bash
# Execute the full automated pytest suite:
.\backend\venv\Scripts\pytest.exe .\backend\tests -v
```

All 9 automated tests verify:
- Candidate registration and independent login
- HR recruiter registration and organizational onboarding
- Strict portal and API role isolation (403 forbidden on cross-portal access)
- Blocked candidate attempts to trigger hiring decisions
- Candidate data, applications, and activity history persistence
- Complete end-to-end recruitment lifecycle (Job creation ➔ Application ➔ Interview ➔ Scoring ➔ Top-5 Board ➔ HR Selection)

---

## 🔑 Pre-Seeded Demo Accounts

The database seeds automatically upon server boot with realistic production records:

| Portal | Email | Password | Role / Details |
|---|---|---|---|
| **HR Recruiter Portal** | `hr@smartrecruit.io` | `recruiter123` | HR Admin at *Global Tech Solutions* |
| **Candidate Portal** | `alex.chen@example.com` | `candidate123` | Senior AI Engineer (Rank #1) |
| **Candidate Portal** | `elena.rostova@example.com` | `candidate123` | Full Stack Cloud Architect |
| **Candidate Portal** | `marcus.vance@example.com` | `candidate123` | Distributed Systems Engineer |

---

## 🛡️ Security & Multi-Tenant Isolation

1. **Dedicated Independent Portals:** Separate login endpoints (`/candidate/login` vs `/hr/login`). Role switching buttons are strictly prohibited.
2. **Backend Role Enforcement:** Fastapi dependencies verify JWT claims (`require_candidate` and `require_hr`). Client-side state manipulation cannot bypass access controls.
3. **Tenant Segregation:** All job postings, applicant records, and deliberations are scoped by `organization_id`. Recruiters from Tenant A cannot access Tenant B.
4. **Blind Screening Mode:** Masks candidate names and demographics into randomized aliases (`Candidate #401`) to eliminate unconscious screening bias.

---

## 📊 Scoring Rubric & Ranking Model

### Turn-by-Turn AI Interview Dimensions
* **Technical Correctness & Competence:** 35%
* **Problem-Solving & Analytical Reasoning:** 25%
* **Job-Related Application of Skills:** 20%
* **Communication Clarity & Articulation:** 10%
* **Project & Experience Relevance:** 10%

### Top-5 Candidate Ranking Formula
$$\text{Composite Score} = (0.30 \times \text{Resume Match}) + (0.50 \times \text{Interview Score}) + (0.20 \times \text{Required Skills Coverage})$$

* If fewer than 5 eligible candidates exist for an opening, Smart Recruit displays the available pool without fabricating records.

---

## 🐳 Docker Production Deployment

To run with PostgreSQL in containerized production:

```bash
docker-compose up --build -d
```
* **Frontend:** `http://localhost:5173`
* **Backend API:** `http://localhost:8000`
* **PostgreSQL Database:** `localhost:5432`

