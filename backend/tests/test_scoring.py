import pytest
from app.core.rubric import calculate_composite_rank_score, calculate_interview_composite_score, RANKING_WEIGHTS, INTERVIEW_RUBRIC

def test_overall_candidate_fit_formula():
    """
    Validates the authoritative composite ranking formula:
    Overall Candidate Fit = (Resume Match * 0.40) + (Interview Assessment * 0.40) + (Verified Skills * 0.20)
    
    Required test case:
    Resume Match = 31.6
    Interview Assessment = 0.8
    Verified Skills = 41.7
    Expected Result: 21.3%
    """
    resume_match = 31.6
    interview_score = 0.8
    verified_skills = 41.7
    
    fit_score = calculate_composite_rank_score(
        resume_match=resume_match,
        interview_score=interview_score,
        required_skills=verified_skills
    )
    
    assert fit_score == 21.3, f"Expected 21.3%, but got {fit_score}%"

def test_interview_dimension_weights():
    """
    Validates the 5-dimensional interview evaluation formula:
    Interview Score = (Technical * 0.35) + (Problem Solving * 0.25) + (Job Skills * 0.20) + (Communication * 0.10) + (Project Depth * 0.10)
    """
    # Test case matching candidate with 8% communication only
    scores = {
        "technical_correctness": 0.0,
        "problem_solving": 0.0,
        "job_skills_application": 0.0,
        "communication_clarity": 8.0,
        "project_experience_depth": 0.0
    }
    interview_score = calculate_interview_composite_score(scores)
    assert interview_score == 0.8, f"Expected 0.8%, but got {interview_score}%"

def test_interview_dimension_weights_full_stack():
    """
    Validates realistic technical interview dimension breakdown
    """
    scores = {
        "technical_correctness": 41.4,
        "problem_solving": 38.8,
        "job_skills_application": 37.4,
        "communication_clarity": 46.7,
        "project_experience_depth": 41.4
    }
    # (41.4 * 0.35) + (38.8 * 0.25) + (37.4 * 0.20) + (46.7 * 0.10) + (41.4 * 0.10)
    # = 14.49 + 9.7 + 7.48 + 4.67 + 4.14 = 40.48 -> 40.5
    interview_score = calculate_interview_composite_score(scores)
    assert interview_score == 40.5, f"Expected 40.5%, but got {interview_score}%"

def test_score_boundaries():
    """Ensure scores clamp between 0.0 and 100.0 without overflow"""
    assert calculate_composite_rank_score(0, 0, 0) == 0.0
    assert calculate_composite_rank_score(100, 100, 100) == 100.0
    assert calculate_composite_rank_score(150, 200, 100) == 100.0

