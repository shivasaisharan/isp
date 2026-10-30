import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

def create_resume_pdf(filename=r"C:\Users\pshiv\OneDrive\Desktop\a\Bharath_Simha_Reddy_Optimized_Resume.pdf"):
    # Margins: 26 pt to ensure all content fits comfortably on exactly 1 page
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=28,
        rightMargin=28,
        topMargin=24,
        bottomMargin=24
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0f2942")     # Deep professional executive navy
    secondary_color = colors.HexColor("#334155")   # Slate gray
    dark_neutral = colors.HexColor("#0f172a")      # Off-black
    accent_bar = colors.HexColor("#2563eb")        # Royal blue
    light_line = colors.HexColor("#cbd5e1")        # Light gray line

    name_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=21,
        textColor=primary_color,
        alignment=1 # Center
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=accent_bar,
        alignment=1
    )

    contact_style = ParagraphStyle(
        'ContactLine',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=secondary_color,
        alignment=1
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.8,
        leading=12.5,
        textColor=primary_color,
        spaceAfter=1
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.3,
        leading=11.3,
        textColor=dark_neutral
    )

    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.1,
        leading=11.1,
        textColor=dark_neutral,
        leftIndent=11,
        firstLineIndent=-8,
        spaceAfter=1.8
    )

    item_title_left = ParagraphStyle(
        'ItemTitleLeft',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.6,
        leading=11.5,
        textColor=dark_neutral
    )

    item_title_right = ParagraphStyle(
        'ItemTitleRight',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.4,
        leading=11.2,
        textColor=secondary_color,
        alignment=2 # Right
    )

    item_sub_left = ParagraphStyle(
        'ItemSubLeft',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        textColor=secondary_color
    )

    item_sub_right = ParagraphStyle(
        'ItemSubRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        textColor=secondary_color,
        alignment=2
    )

    story = []

    # --- HEADER ---
    story.append(Paragraph("C. BHARATH SIMHA REDDY", name_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("FULL STACK SOFTWARE ENGINEER | AI & CLOUD SYSTEMS DEVELOPER", subtitle_style))
    story.append(Spacer(1, 3))
    
    contact_text = (
        "Email: <b>bharathsimhar5793@gmail.com</b> &nbsp;|&nbsp; "
        "Phone: <b>+91 6302309698</b> &nbsp;|&nbsp; "
        "GitHub: <b>github.com/bharathsimha01</b> &nbsp;|&nbsp; "
        "LinkedIn: <b>linkedin.com/in/bharath-simha-reddy-37742b2ab</b>"
    )
    story.append(Paragraph(contact_text, contact_style))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.2, color=accent_bar, spaceAfter=4, spaceBefore=1))

    # --- PROFESSIONAL SUMMARY ---
    story.append(Paragraph("PROFESSIONAL SUMMARY", section_heading))
    story.append(HRFlowable(width="100%", thickness=0.5, color=light_line, spaceAfter=3, spaceBefore=1))
    summary_text = (
        "High-impact <b>Full Stack Software Engineer</b> and <b>AI Systems Developer</b> with core expertise in "
        "<b>Python</b>, <b>React.js</b>, <b>FastAPI</b>, <b>PyTorch</b>, and cloud containerization. Proven track record in "
        "architecting low-latency <b>REST APIs</b>, integrating <b>Transformers</b> and <b>Large Language Models</b> (LLMs), "
        "and deploying scalable microservices with <b>Docker</b>. Skilled in database optimization across <b>PostgreSQL</b>, "
        "<b>SQL</b>, and <b>MongoDB</b> with rigorous CI/CD workflows, agile delivery, and algorithmic problem solving."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 4))

    # --- TECHNICAL SKILLS ---
    story.append(Paragraph("TECHNICAL SKILLS & TAXONOMY COMPETENCIES", section_heading))
    story.append(HRFlowable(width="100%", thickness=0.5, color=light_line, spaceAfter=3, spaceBefore=1))
    
    skills_data = [
        [
            Paragraph("<b>Languages & Core:</b>", item_title_left),
            Paragraph("Python, JavaScript (ES6+), TypeScript, SQL, HTML5, CSS3, C/C++", body_style)
        ],
        [
            Paragraph("<b>Frontend Engineering:</b>", item_title_left),
            Paragraph("React, React.js, Vite, Tailwind CSS, Redux, Responsive UI, State Management", body_style)
        ],
        [
            Paragraph("<b>Backend & APIs:</b>", item_title_left),
            Paragraph("FastAPI, REST API, Node.js, Express.js, Microservices, JWT Auth, System Design", body_style)
        ],
        [
            Paragraph("<b>Databases & Caching:</b>", item_title_left),
            Paragraph("PostgreSQL, MongoDB, SQL, SQLite, Redis, Database Optimization & Indexing", body_style)
        ],
        [
            Paragraph("<b>AI, ML & NLP:</b>", item_title_left),
            Paragraph("Machine Learning, Deep Learning, PyTorch, Transformers, LLM (Gemini), NLP, Scikit-Learn, Pandas", body_style)
        ],
        [
            Paragraph("<b>Cloud & DevOps:</b>", item_title_left),
            Paragraph("Docker, Kubernetes, Git, GitHub Actions, CI/CD, Linux, AWS, Unit Testing (PyTest)", body_style)
        ]
    ]

    skills_table = Table(skills_data, colWidths=[120, 436])
    skills_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.2),
        ('TOPPADDING', (0,0), (-1,-1), 1.2),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(skills_table)
    story.append(Spacer(1, 4))

    # --- KEY PROJECTS ---
    story.append(Paragraph("FEATURED ENGINEERING PROJECTS", section_heading))
    story.append(HRFlowable(width="100%", thickness=0.5, color=light_line, spaceAfter=3, spaceBefore=1))

    # Project 1: AI Healthcare Guide
    proj1_header = [
        [
            Paragraph("<b>AI-Powered Healthcare & Wellness Guide</b> | <i>React.js, FastAPI, Python, PyTorch, Gemini LLM, Tailwind CSS</i>", item_title_left),
            Paragraph("Dec 2025 - Present", item_title_right)
        ]
    ]
    p1_table = Table(proj1_header, colWidths=[434, 122])
    p1_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5)
    ]))
    story.append(p1_table)
    story.append(Paragraph("• Architected an intelligent medical advisory web platform featuring conversational NLP triage powered by Gemini AI and Python.", bullet_style))
    story.append(Paragraph("• Designed high-performance asynchronous <b>REST API</b> endpoints in <b>FastAPI</b> with &lt;180ms response latency and defensive prompt engineering.", bullet_style))
    story.append(Paragraph("• Developed responsive frontend in <b>React.js</b> with <b>Tailwind CSS</b>, dynamic state caching, and automated session persistence.", bullet_style))
    story.append(Paragraph("• Experimented with <b>PyTorch</b> and <b>Transformers</b> embeddings to cluster clinical intents and streamline diagnostic guidance.", bullet_style))
    story.append(Spacer(1, 2.5))

    # Project 2: E-Commerce Web Application
    proj2_header = [
        [
            Paragraph("<b>Scalable Cloud E-Commerce Platform</b> | <i>React.js, Node.js, Python, PostgreSQL, MongoDB, Docker</i>", item_title_left),
            Paragraph("Sep 2025 - Nov 2025", item_title_right)
        ]
    ]
    p2_table = Table(proj2_header, colWidths=[434, 122])
    p2_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5)
    ]))
    story.append(p2_table)
    story.append(Paragraph("• Engineered a full-stack SaaS storefront featuring dynamic cataloging, inventory checkout, and secure JWT authentication.", bullet_style))
    story.append(Paragraph("• Designed hybrid database schemas utilizing <b>PostgreSQL</b> for relational orders and <b>MongoDB</b> for high-volume product metadata.", bullet_style))
    story.append(Paragraph("• Containerized services using <b>Docker</b> and built automated <b>CI/CD</b> testing pipelines via <b>Git</b> and GitHub Actions.", bullet_style))
    story.append(Paragraph("• Structured modular backend microservices delivering high availability, parameterized queries, and defensive input sanitization.", bullet_style))
    story.append(Spacer(1, 2.5))

    # Project 3: Automated ML Pipeline
    proj3_header = [
        [
            Paragraph("<b>Automated ML Inference & Classification System</b> | <i>Python, Scikit-Learn, PyTorch, Transformers, Pandas</i>", item_title_left),
            Paragraph("May 2025 - Aug 2025", item_title_right)
        ]
    ]
    p3_table = Table(proj3_header, colWidths=[434, 122])
    p3_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.5)
    ]))
    story.append(p3_table)
    story.append(Paragraph("• Built an end-to-end Machine Learning pipeline in Python for automated data preprocessing, transformation, and feature extraction.", bullet_style))
    story.append(Paragraph("• Trained predictive classification models with <b>Scikit-Learn</b> and evaluated neural architectures in <b>PyTorch</b>, reaching 89% accuracy.", bullet_style))
    story.append(Paragraph("• Deployed model serving endpoints via <b>FastAPI</b> microservices, reducing batch processing execution time by 40%.", bullet_style))
    story.append(Spacer(1, 4))

    # --- EDUCATION ---
    story.append(Paragraph("EDUCATION", section_heading))
    story.append(HRFlowable(width="100%", thickness=0.5, color=light_line, spaceAfter=3, spaceBefore=1))

    edu_data = [
        [
            Paragraph("<b>B.Tech in Computer Science and Engineering</b>", item_title_left),
            Paragraph("2023 - Present", item_title_right)
        ],
        [
            Paragraph("Kalasalingam Academy of Research and Education | <i>CGPA: 6.42</i>", item_sub_left),
            Paragraph("Tamil Nadu, India", item_sub_right)
        ],
        [
            Paragraph("<b>Intermediate (MPC)</b> — Narayana Junior College | <i>Score: 89.8%</i>", item_sub_left),
            Paragraph("2021 - 2023", item_sub_right)
        ],
        [
            Paragraph("<b>Secondary School Certificate (SSC)</b> — Montessori High School | <i>Score: 99.5%</i>", item_sub_left),
            Paragraph("2020 - 2021", item_sub_right)
        ]
    ]
    edu_table = Table(edu_data, colWidths=[424, 132])
    edu_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1.2)
    ]))
    story.append(edu_table)
    story.append(Spacer(1, 4))

    # --- CERTIFICATIONS & ACHIEVEMENTS ---
    story.append(Paragraph("CERTIFICATIONS & ENGINEERING ACHIEVEMENTS", section_heading))
    story.append(HRFlowable(width="100%", thickness=0.5, color=light_line, spaceAfter=3, spaceBefore=1))
    story.append(Paragraph("• <b>Full Stack Web Development & Python Engineering:</b> Certified in modern web architectures and microservices design.", bullet_style))
    story.append(Paragraph("• <b>Data Structures & Algorithms:</b> Solved 150+ coding challenges across LeetCode & HackerRank focusing on tree, graph, and dynamic programming.", bullet_style))
    story.append(Paragraph("• <b>Open-Source Engineering:</b> Active GitHub contributor maintaining clean modular code, comprehensive READMEs, and test suites.", bullet_style))

    doc.build(story)
    print(f"Resume PDF successfully compiled to {os.path.abspath(filename)}")

if __name__ == "__main__":
    create_resume_pdf()
