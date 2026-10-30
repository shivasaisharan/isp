import re
import uuid
from pathlib import Path
from typing import Dict, List, Set, Tuple
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

TAXONOMY_SKILLS = [
    # Programming & Core
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin",
    # Frontend
    "react", "react.js", "next.js", "vue", "vue.js", "angular", "tailwind css", "html5", "css3", "redux", "vite",
    # Backend & API
    "fastapi", "flask", "django", "node.js", "express.js", "spring boot", "rest api", "graphql", "grpc", "microservices",
    # Databases & Cache
    "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite", "dynamodb", "cassandra",
    # AI / ML / Data
    "machine learning", "deep learning", "nlp", "transformers", "pytorch", "tensorflow", "scikit-learn",
    "pandas", "numpy", "spacy", "large language models", "llm", "rag", "computer vision", "opencv",
    # Cloud & DevOps
    "aws", "azure", "google cloud platform", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "git", "github actions", "linux",
    # System Architecture & Best Practices
    "system design", "distributed systems", "database optimization", "unit testing", "pytest", "agile", "scrum", "kanban",
    # Soft skills & Leadership
    "leadership", "communication", "team collaboration", "problem solving", "mentorship", "product delivery"
]

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts plain text from PDF using pypdf."""
    try:
        reader = PdfReader(pdf_path)
        extracted = []
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                extracted.append(txt)
        return "\n".join(extracted)
    except Exception as e:
        print(f"Error parsing PDF {pdf_path}: {e}")
        return ""

def extract_skills_from_text(text: str) -> List[str]:
    """Extracts known tech and engineering skills from raw text using boundary matching."""
    text_lower = f" {text.lower()} "
    found = set()
    for skill in TAXONOMY_SKILLS:
        pattern = r'(?<![a-zA-Z0-9_\-])' + re.escape(skill) + r'(?![a-zA-Z0-9_\-])'
        if re.search(pattern, text_lower):
            found.add(skill.title() if len(skill) > 4 else skill.upper())
    return sorted(list(found))

def calculate_text_similarity(text1: str, text2: str) -> float:
    """Calculates semantic/TF-IDF cosine similarity between two texts (0.0 to 1.0)."""
    if not text1.strip() or not text2.strip():
        return 0.0
    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        tfidf_matrix = vectorizer.fit_transform([text1, text2])
        sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return round(float(sim), 3)
    except Exception:
        return 0.5

def analyze_resume_against_job(resume_text: str, job_description: str, required_skills: List[str]) -> Dict:
    """
    Analyzes resume against job requirements.
    Calculates genuine match scores, identified competencies, and gaps.
    """
    extracted_skills = extract_skills_from_text(resume_text)
    lower_resume_skills = {s.lower() for s in extracted_skills}
    
    # Analyze required skills
    matched_req = []
    missing_req = []
    for req in required_skills:
        req_clean = req.strip()
        if any(req_clean.lower() in s or s in req_clean.lower() for s in lower_resume_skills):
            matched_req.append(req_clean)
        else:
            missing_req.append(req_clean)
            
    req_coverage = (len(matched_req) / max(len(required_skills), 1)) if required_skills else 0.8
    sbert_sim = calculate_text_similarity(resume_text, job_description)
    
    # Composite resume match score: 50% semantic similarity + 50% required skill overlap
    composite_match = round(min(100.0, max(15.0, (sbert_sim * 50.0) + (req_coverage * 50.0))), 1)
    
    # Assess experience years heuristics
    exp_matches = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience', resume_text, re.IGNORECASE)
    exp_years = float(exp_matches[0]) if exp_matches else 3.0
    
    strengths = []
    if matched_req:
        strengths.append(f"Demonstrated competency in key requirements: {', '.join(matched_req[:4])}")
    if sbert_sim > 0.4:
        strengths.append("Strong semantic alignment between background experience and role scope.")
    if exp_years >= 3.0:
        strengths.append(f"Relevant industry tenure (~{exp_years} years estimated).")

    recommendations = []
    if missing_req:
        recommendations.append(f"Focus technical interview validation on missing competencies: {', '.join(missing_req[:3])}")
    else:
        recommendations.append("Candidate demonstrates full prerequisite skill coverage for this opening.")

    return {
        "match_score": composite_match,
        "sbert_similarity": sbert_sim,
        "skills_score": round(req_coverage * 100.0, 1),
        "extracted_skills": extracted_skills,
        "matched_skills": matched_req,
        "missing_skills": missing_req,
        "experience_years": exp_years,
        "strengths": strengths,
        "recommendations": recommendations,
        "fit_status": "High Match" if composite_match >= 75 else ("Moderate Match" if composite_match >= 50 else "Potential Gap")
    }

def generate_anonymized_alias() -> str:
    """Generates a blind-screening identifier e.g. 'Candidate #4A9C'."""
    return f"Candidate #{uuid.uuid4().hex[:4].upper()}"
