import json
import os
import re
from typing import Dict, List, Optional
import requests
from app.core.config import settings
from app.core.rubric import INTERVIEW_RUBRIC, calculate_interview_composite_score

SYSTEM_PROMPT = """You are Smart Recruit AI, an objective, rigorous, and supportive technical and behavioral interview assessor.
You conduct realistic mock and technical interviews grounded strictly in the job requirements and candidate profile.
Evaluate answers purely on demonstrated competency, technical correctness, problem-solving, and communication clarity without artificial inflation.
"""

def generate_interview_questions(job_title: str, job_description: str, required_skills: List[str], experience_level: str = "Mid-Level", count: int = 5) -> List[Dict]:
    """
    Generates tailored, structured interview questions spanning technical correctness,
    problem solving, skills application, and behavioral / project experience.
    Uses Gemini API when configured; otherwise uses deterministic dynamic generation.
    """
    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            skills_str = ", ".join(required_skills) if required_skills else "General software engineering skills"
            prompt = f"""Generate {count} distinct, professional interview questions for the role: '{job_title}' ({experience_level}).
Required skills: {skills_str}
Role Description: {job_description[:300]}

Format as a strict JSON list of objects:
[
  {{"question_index": 0, "question_text": "...", "category": "technical", "difficulty": "intermediate"}},
  ...
]
Categories should cover: 'technical', 'problem_solving', 'architecture', 'behavioral', 'project'.
Return ONLY valid JSON.
"""
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            res = requests.post(url, json=payload, timeout=12)
            if res.status_code == 200:
                data = res.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                clean_json = re.search(r'\[.*\]', raw_text, re.DOTALL)
                if clean_json:
                    questions = json.loads(clean_json.group(0))
                    if isinstance(questions, list) and len(questions) > 0:
                        return questions[:count]
        except Exception as e:
            print(f"Notice: Gemini API question generation skipped ({e}), falling back to heuristic engine.")

    # High quality, role-specific fallback questions
    skills_slice = required_skills[:3] if required_skills else ["Python", "System Design", "Databases"]
    s1 = skills_slice[0] if len(skills_slice) > 0 else "core technology"
    s2 = skills_slice[1] if len(skills_slice) > 1 else "data architecture"
    s3 = skills_slice[2] if len(skills_slice) > 2 else "cloud deployment"

    return [
        {
            "question_index": 0,
            "question_text": f"Welcome to your interview for {job_title}. To start, could you introduce your experience with {s1} and describe a high-impact production challenge you resolved?",
            "category": "technical",
            "difficulty": "medium"
        },
        {
            "question_index": 1,
            "question_text": f"In {s2}, how do you approach performance bottlenecks, caching, and database query optimization under concurrent load?",
            "category": "problem_solving",
            "difficulty": "medium"
        },
        {
            "question_index": 2,
            "question_text": f"Walk us through how you apply {s3} or related modern workflows to ensure zero-downtime releases and resilient fault-tolerance.",
            "category": "architecture",
            "difficulty": "hard"
        },
        {
            "question_index": 3,
            "question_text": "Tell me about a time you encountered a serious architectural disagreement with an engineering lead or stakeholder. How did you advocate your perspective and reach consensus?",
            "category": "behavioral",
            "difficulty": "medium"
        },
        {
            "question_index": 4,
            "question_text": "Looking back at the most complex project on your resume, what trade-offs did you make in design or technical debt, and what would you build differently today?",
            "category": "project",
            "difficulty": "hard"
        }
    ]

def evaluate_single_answer(question_text: str, candidate_answer: str, category: str, required_skills: List[str]) -> Dict:
    """
    Evaluates turn-by-turn answer evidence using multi-metric NLP semantic verification.
    Guards against gibberish, filler repetition, and non-responsive answers:
    - Cosine TF-IDF semantic relevance check against the question & target domain.
    - Repetition / lexical diversity analysis (TTR - Type-Token Ratio).
    - Hard penalty (0% - 15%) for non-responsive, evasive, or repetitive answers.
    """
    answer_text = candidate_answer.strip()
    words = answer_text.split()
    word_count = len(words)
    
    # 1. Length guard
    if word_count < 6:
        return {
            "technical_score": 0.0,
            "problem_solving_score": 0.0,
            "skills_score": 0.0,
            "communication_score": 10.0,
            "project_score": 0.0,
            "composite_score": 1.0,
            "feedback": "Answer was too brief to evaluate. No technical or problem-solving evidence provided."
        }

    # 2. Lexical diversity check (catches 'hello hello hello ii my my my')
    unique_words = set(w.lower() for w in words)
    lexical_diversity = len(unique_words) / max(word_count, 1)

    # 3. NLP Semantic Relevance: Question-Answer Cosine Similarity
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        vec = TfidfVectorizer(stop_words='english')
        # Combine question with domain skills
        context_text = f"{question_text} {' '.join(required_skills)}"
        tfidf_mat = vec.fit_transform([context_text, answer_text])
        semantic_relevance = float(cosine_similarity(tfidf_mat[0:1], tfidf_mat[1:2])[0][0])
    except Exception:
        semantic_relevance = 0.1

    # 4. Keyword & Competency Spotting
    ans_lower = answer_text.lower()
    tech_hits = sum(1 for sk in required_skills if sk.lower() in ans_lower)
    
    architecture_terms = [
        "scalable", "latency", "throughput", "cache", "redis", "database", "index", 
        "async", "concurrency", "test", "docker", "pipeline", "trade-off", "microservice",
        "kubernetes", "sql", "api", "rest", "schema", "query", "optimization"
    ]
    arch_hits = sum(1 for term in architecture_terms if term in ans_lower)

    star_terms = [
        "situation", "task", "action", "result", "because", "impact", "resolved",
        "improved", "optimized", "collaborated", "engineered", "implemented", "designed"
    ]
    star_hits = sum(1 for term in star_terms if term in ans_lower)

    # 5. Gibberish / Repetition / Evasion Detection Rule
    is_gibberish_or_evasion = (
        (lexical_diversity < 0.45 and word_count > 10) or
        (semantic_relevance < 0.02 and tech_hits == 0 and arch_hits == 0) or
        ("don't know" in ans_lower and word_count < 20) or
        ("dont know" in ans_lower and word_count < 20)
    )

    if is_gibberish_or_evasion:
        return {
            "technical_score": 0.0,
            "problem_solving_score": 0.0,
            "skills_score": 0.0,
            "communication_score": 5.0,
            "project_score": 0.0,
            "composite_score": 0.5,
            "feedback": "Answer failed relevance check. Repeated filler words or evasive phrases do not demonstrate engineering competence."
        }

    # 6. Genuine evidence-based score computation (0 - 100)
    # Grounded on actual technical hits, architecture principles, and semantic alignment
    relevance_multiplier = 1.0 if (tech_hits >= 2 or arch_hits >= 2) else min(1.0, max(0.3, semantic_relevance * 5.0))
    
    base_tech = min(95.0, (tech_hits * 22.0) + (min(arch_hits, 4) * 10.0) + (semantic_relevance * 30.0) + (min(word_count, 120) / 8.0)) * relevance_multiplier
    base_problem = min(95.0, (min(arch_hits, 5) * 14.0) + (min(star_hits, 4) * 10.0) + (semantic_relevance * 25.0) + (min(word_count, 120) / 8.0)) * relevance_multiplier
    base_skills = min(95.0, (tech_hits * 26.0) + (min(arch_hits, 3) * 10.0) + (semantic_relevance * 25.0)) * relevance_multiplier
    base_comm = min(95.0, (lexical_diversity * 50.0) + (min(star_hits, 4) * 8.0) + (min(word_count, 100) / 8.0))
    base_proj = min(95.0, (min(arch_hits, 4) * 12.0) + (min(star_hits, 4) * 10.0) + (semantic_relevance * 25.0)) * relevance_multiplier

    scores = {
        "technical_correctness": round(max(0.0, base_tech), 1),
        "problem_solving": round(max(0.0, base_problem), 1),
        "job_skills_application": round(max(0.0, base_skills), 1),
        "communication_clarity": round(max(0.0, base_comm), 1),
        "project_experience_depth": round(max(0.0, base_proj), 1)
    }
    composite = calculate_interview_composite_score(scores)

    feedback_points = []
    if tech_hits > 0:
        feedback_points.append("Successfully highlighted relevant stack competencies.")
    if arch_hits >= 2:
        feedback_points.append("Demonstrated solid grasp of system architecture and engineering trade-offs.")
    if semantic_relevance > 0.15:
        feedback_points.append("Strong contextual relevance directly answering the core problem prompt.")
    if not feedback_points:
        feedback_points.append("Response lacks concrete technical specifics. Elaborate with architecture details and real metrics.")

    return {
        "technical_score": scores["technical_correctness"],
        "problem_solving_score": scores["problem_solving"],
        "skills_score": scores["job_skills_application"],
        "communication_score": scores["communication_clarity"],
        "project_score": scores["project_experience_depth"],
        "composite_score": composite,
        "feedback": " ".join(feedback_points)
    }

def generate_final_interview_report(session_answers: List[Dict], job_title: str) -> Dict:
    """
    Compiles multi-turn answers into the comprehensive final assessment scorecard.
    """
    if not session_answers:
        return {
            "technical_rating": 50.0,
            "problem_solving_rating": 50.0,
            "skills_rating": 50.0,
            "communication_rating": 50.0,
            "project_rating": 50.0,
            "overall_score": 50.0,
            "rubric_version": "2026.1",
            "strengths": ["Completed session"],
            "weaknesses": ["Insufficient answer data"],
            "skill_gap_summary": "Incomplete evaluation due to missing responses.",
            "suggestions_for_improvement": "Provide comprehensive answers to all questions.",
            "candidate_visible_feedback": "Your interview session was recorded.",
            "recruiter_confidential_notes": "Session contains sparse data."
        }

    avg_tech = round(sum(a["technical_score"] for a in session_answers) / len(session_answers), 1)
    avg_prob = round(sum(a["problem_solving_score"] for a in session_answers) / len(session_answers), 1)
    avg_skill = round(sum(a["skills_score"] for a in session_answers) / len(session_answers), 1)
    avg_comm = round(sum(a["communication_score"] for a in session_answers) / len(session_answers), 1)
    avg_proj = round(sum(a["project_score"] for a in session_answers) / len(session_answers), 1)

    overall = calculate_interview_composite_score({
        "technical_correctness": avg_tech,
        "problem_solving": avg_prob,
        "job_skills_application": avg_skill,
        "communication_clarity": avg_comm,
        "project_experience_depth": avg_proj
    })

    strengths = []
    if avg_tech >= 75.0:
        strengths.append(f"Demonstrated solid technical grasp of core principles for {job_title}.")
    if avg_prob >= 75.0:
        strengths.append("Structured methodical approach to edge cases and debugging.")
    if avg_comm >= 80.0:
        strengths.append("Clear, concise articulation of concepts and trade-offs.")
    if avg_proj >= 75.0:
        strengths.append("High contextual depth regarding past implementation projects.")
    
    if overall < 35.0:
        strengths = ["Completed attendance and audio input verification."]
    elif not strengths:
        strengths.append("Demonstrated foundational familiarity with modern development workflows.")

    weaknesses = []
    if overall < 40.0:
        weaknesses.append("Answers lacked substantive domain content or repeatedly failed relevance checks.")
        weaknesses.append("Severe deficit in demonstrated core technical and problem-solving skills.")
        weaknesses.append("Unable to verify hands-on production engineering experience.")
    else:
        if avg_tech < 70.0:
            weaknesses.append("Could deepen precision in advanced architectural algorithms.")
        if avg_prob < 70.0:
            weaknesses.append("Opportunity to articulate more structured trade-off evaluations.")
        if avg_comm < 70.0:
            weaknesses.append("Answers would benefit from structured STAR-format storytelling.")
    
    if not weaknesses:
        weaknesses.append("Minor opportunities to incorporate quantitative production metrics.")

    if overall < 35.0:
        gap_summary = (
            f"Candidate scored an overall interview performance of {overall}/100. "
            "Responses were non-responsive, repetitive, or lacked technical substance."
        )
        suggestions = (
            "Prepare concrete, detailed technical explanations. Avoid monosyllabic or filler phrases. "
            "Study foundational algorithms, data architectures, and role-specific tech stacks before re-interviewing."
        )
        recruiter_notes = (
            f"AI Assessment Warning: Extremely low performance ({overall}%). "
            "Candidate submitted answers that failed NLP semantic relevance checks. Recommendation: Do Not Proceed."
        )
    else:
        gap_summary = (
            f"Candidate scored an overall interview performance of {overall}/100. "
            f"Strongest domain was {'Technical Competence' if avg_tech >= avg_prob else 'Problem Solving'}, "
            f"with communication clarity measured at {avg_comm}/100."
        )
        suggestions = (
            "Focus on providing specific quantitative metrics (e.g., latency reduction %, TPS handled) "
            "when discussing production wins. Practice structured whiteboarding for distributed system bottlenecks."
        )
        recruiter_notes = (
            f"AI Assessment Summary: Overall {overall}%. Candidate demonstrated verifiable skills. "
            "Recommendation: Review candidate's system design depth during live HR round."
        )

    return {
        "technical_rating": avg_tech,
        "problem_solving_rating": avg_prob,
        "skills_rating": avg_skill,
        "communication_rating": avg_comm,
        "project_rating": avg_proj,
        "overall_score": overall,
        "rubric_version": "2026.1",
        "strengths": strengths,
        "weaknesses": weaknesses,
        "skill_gap_summary": gap_summary,
        "suggestions_for_improvement": suggestions,
        "transparency_breakdown": {
            "technical_weight": "35%",
            "problem_solving_weight": "25%",
            "skills_weight": "20%",
            "communication_weight": "10%",
            "project_weight": "10%"
        },
        "candidate_visible_feedback": gap_summary + " " + suggestions,
        "recruiter_confidential_notes": recruiter_notes
    }
