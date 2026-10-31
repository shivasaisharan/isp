"""
Rubric & Scoring Models for Smart Recruit AI
Configurable, transparent, explainable weights.
"""

RUBRIC_VERSION = "2026.1"

# Dimension weights for Turn-by-Turn & Overall AI Interview Evaluation
INTERVIEW_RUBRIC = {
    "technical_correctness": {
        "weight": 0.35,
        "label": "Technical Correctness & Competence",
        "description": "Accuracy of technical answers, concept mastery, and domain depth."
    },
    "problem_solving": {
        "weight": 0.25,
        "label": "Problem-Solving & Analytical Reasoning",
        "description": "Approach to resolving blockers, edge-case consideration, algorithmic logic."
    },
    "job_skills_application": {
        "weight": 0.20,
        "label": "Job-Related Application of Skills",
        "description": "Practical application of required technologies and tools to target role scenarios."
    },
    "communication_clarity": {
        "weight": 0.10,
        "label": "Communication Clarity & Articulation",
        "description": "Conciseness, structured thought progression, active listening, and precision."
    },
    "project_experience_depth": {
        "weight": 0.10,
        "label": "Project & Experience Relevance",
        "description": "Direct evidence of real-world impact, ownership, and architectural depth."
    }
}

# Weights for Job-Specific Candidate Top-5 Ranking Model & Overall Candidate Fit
# Standardized across HR applicant table, top-five candidate board, and candidate comparison:
# Overall Candidate Fit = (Resume Match * 0.40) + (Interview Assessment * 0.40) + (Verified Skills * 0.20)
RANKING_WEIGHTS = {
    "resume_match": 0.40,       # 40% Resume semantic & experience fit
    "interview_score": 0.40,    # 40% Comprehensive AI interview assessment
    "required_skills": 0.20     # 20% Hard requirement & verified skills coverage
}

def calculate_interview_composite_score(scores: dict) -> float:
    """
    Computes overall interview assessment score from 5 individual dimension ratings (each 0 - 100):
    Interview Score = (Technical * 0.35) + (Problem Solving * 0.25) + (Job Skills * 0.20) + (Communication * 0.10) + (Project Depth * 0.10)
    """
    total = 0.0
    for key, spec in INTERVIEW_RUBRIC.items():
        val = float(scores.get(key, 0.0))
        total += val * spec["weight"]
    return round(total, 1)

def calculate_composite_rank_score(resume_match: float, interview_score: float, required_skills: float) -> float:
    """
    Authoritative composite ranking formula for Smart Recruit:
    Overall Candidate Fit = (Resume Match * 0.40) + (Interview Assessment * 0.40) + (Verified Skills * 0.20)
    All inputs normalized to 0-100 scale.
    Example: (31.6 * 0.40) + (0.8 * 0.40) + (41.7 * 0.20) = 12.64 + 0.32 + 8.34 = 21.3%
    """
    rm = max(0.0, min(100.0, float(resume_match or 0.0)))
    iv = max(0.0, min(100.0, float(interview_score or 0.0)))
    sk = max(0.0, min(100.0, float(required_skills or 0.0)))

    score = (
        (rm * RANKING_WEIGHTS["resume_match"]) +
        (iv * RANKING_WEIGHTS["interview_score"]) +
        (sk * RANKING_WEIGHTS["required_skills"])
    )
    return round(min(100.0, max(0.0, score)), 1)
