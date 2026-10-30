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

# Weights for Job-Specific Candidate Top-5 Ranking Model
RANKING_WEIGHTS = {
    "resume_match": 0.30,       # 30% Resume semantic & experience fit
    "interview_score": 0.50,    # 50% Comprehensive interview assessment
    "required_skills": 0.20     # 20% Hard requirement coverage
}

def calculate_interview_composite_score(scores: dict) -> float:
    """
    Computes overall score from individual dimension ratings (each 0 - 100).
    """
    total = 0.0
    for key, spec in INTERVIEW_RUBRIC.items():
        val = float(scores.get(key, 0.0))
        total += val * spec["weight"]
    return round(total, 1)

def calculate_composite_rank_score(resume_match: float, interview_score: float, required_skills: float) -> float:
    """
    Computes overall ranking score (0 - 100).
    """
    score = (
        (resume_match * RANKING_WEIGHTS["resume_match"]) +
        (interview_score * RANKING_WEIGHTS["interview_score"]) +
        (required_skills * RANKING_WEIGHTS["required_skills"])
    )
    return round(min(100.0, max(0.0, score)), 1)
