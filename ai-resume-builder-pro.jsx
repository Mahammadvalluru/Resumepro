import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// CONSTANTS & DATA
// ============================================================
const TEMPLATES = {
  professional: {
    name: "Professional",
    desc: "Clean corporate design",
    accent: "#1a365d",
    bg: "#f8fafc",
    font: "'Georgia', serif",
  },
  minimal: {
    name: "Minimal",
    desc: "Sleek modern layout",
    accent: "#18181b",
    bg: "#ffffff",
    font: "'Helvetica Neue', sans-serif",
  },
  creative: {
    name: "Creative",
    desc: "Bold & distinctive",
    accent: "#7c3aed",
    bg: "#faf5ff",
    font: "'Trebuchet MS', sans-serif",
  },
  tech: {
    name: "Tech",
    desc: "Developer focused",
    accent: "#059669",
    bg: "#f0fdf4",
    font: "'Courier New', monospace",
  },
  executive: {
    name: "Executive",
    desc: "Premium leadership",
    accent: "#92400e",
    bg: "#fffbeb",
    font: "'Palatino', serif",
  },
};

const ACTION_VERBS = [
  "Architected","Accelerated","Amplified","Built","Boosted","Collaborated",
  "Created","Delivered","Designed","Developed","Drove","Engineered",
  "Enhanced","Executed","Generated","Implemented","Improved","Increased",
  "Launched","Led","Managed","Optimized","Orchestrated","Pioneered",
  "Reduced","Scaled","Shipped","Spearheaded","Streamlined","Transformed",
];

const SKILL_SUGGESTIONS = {
  engineering: ["React","TypeScript","Node.js","Python","AWS","Docker","Kubernetes","GraphQL","PostgreSQL","Redis"],
  design: ["Figma","Adobe XD","Sketch","Illustrator","Photoshop","UI/UX","Prototyping","Design Systems"],
  marketing: ["SEO","Google Analytics","HubSpot","Content Strategy","A/B Testing","Copywriting","Campaign Management"],
  data: ["Python","SQL","Tableau","Power BI","Machine Learning","TensorFlow","Data Visualization","Statistics"],
  management: ["Agile","Scrum","JIRA","OKRs","Stakeholder Management","P&L","Strategic Planning","Team Leadership"],
};

const SAMPLE_RESUME = {
  name: "Alex Chen",
  title: "Senior Software Engineer",
  email: "alex.chen@example.com",
  phone: "(415) 555-0192",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/alexchen",
  github: "github.com/alexchen",
  summary: "Results-driven software engineer with 6+ years building scalable distributed systems. Passionate about developer experience, open-source, and shipping products that delight users.",
  experience: [
    {
      id: 1,
      company: "Stripe",
      role: "Senior Software Engineer",
      period: "2021 – Present",
      bullets: [
        "Architected a real-time payment processing pipeline handling 2M+ transactions/day with 99.99% uptime",
        "Led migration of legacy monolith to microservices, reducing deployment time by 70%",
        "Mentored 4 junior engineers and established team-wide coding standards",
      ],
    },
    {
      id: 2,
      company: "Airbnb",
      role: "Software Engineer II",
      period: "2018 – 2021",
      bullets: [
        "Built search ranking system improving booking conversion by 18% using ML-based personalization",
        "Reduced API latency by 40% through Redis caching and query optimization",
        "Delivered new host onboarding flow used by 500K+ hosts globally",
      ],
    },
  ],
  education: [
    {
      id: 1,
      school: "UC Berkeley",
      degree: "B.S. Computer Science",
      period: "2014 – 2018",
      gpa: "3.8",
    },
  ],
  skills: ["React","TypeScript","Node.js","Python","Go","AWS","Kubernetes","PostgreSQL","Redis","GraphQL"],
  projects: [
    {
      id: 1,
      name: "OpenMetrics",
      desc: "Open-source observability platform with 2K+ GitHub stars. Built a distributed metrics collection system that aggregates data from 500+ endpoints. Implemented real-time alerting with sub-second latency.",
      tech: "Go, Prometheus, Grafana",
      url: "github.com/alexchen/openmetrics",
      period: "2022 – Present",
    },
  ],
};

// ============================================================
// UTILITY: Call Claude API
// ============================================================
async function callClaude(prompt, systemPrompt = "") {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt || "You are an expert resume writer and career coach. Be concise and professional.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ============================================================
// ATS SCORING ALGORITHM
// ============================================================
function computeATSScore(resume, jobDescription) {
  if (!jobDescription.trim()) return null;

  const jd = jobDescription.toLowerCase();
  const resumeText = [
    resume.summary,
    ...resume.experience.flatMap((e) => [e.role, e.company, ...e.bullets]),
    ...resume.skills,
    ...resume.projects.map((p) => p.desc),
  ].join(" ").toLowerCase();

  // Extract keywords from JD (words 4+ chars, not stopwords)
  const stopwords = new Set(["with","that","this","have","from","they","will","been","were","their","which","when","than","into","your","would","could","should","about","there"]);
  const jdWords = [...new Set(jd.match(/\b[a-z]{4,}\b/g) || [])].filter((w) => !stopwords.has(w));

  const matched = jdWords.filter((w) => resumeText.includes(w));
  const missing = jdWords.filter((w) => !resumeText.includes(w)).slice(0, 12);
  const keywordScore = Math.min(100, Math.round((matched.length / Math.max(jdWords.length, 1)) * 100));

  // Formatting score
  const hasEmail = !!resume.email;
  const hasPhone = !!resume.phone;
  const hasLinkedIn = !!resume.linkedin;
  const hasMultipleExp = resume.experience.length >= 2;
  const hasBullets = resume.experience.every((e) => e.bullets.length >= 2);
  const formattingScore = Math.round(
    ([hasEmail, hasPhone, hasLinkedIn, hasMultipleExp, hasBullets].filter(Boolean).length / 5) * 100
  );

  // Content strength: action verbs, numbers
  const bulletText = resume.experience.flatMap((e) => e.bullets).join(" ").toLowerCase();
  const usedVerbs = ACTION_VERBS.filter((v) => bulletText.includes(v.toLowerCase())).length;
  const hasNumbers = /\d+%|\d+x|\d+k|\$\d+|\d+ (users|engineers|teams|months|days)/i.test(bulletText);
  const contentScore = Math.min(100, usedVerbs * 12 + (hasNumbers ? 40 : 0));

  // Section completeness
  const sections = [resume.name, resume.summary, resume.experience.length, resume.education.length, resume.skills.length];
  const completeness = Math.round((sections.filter(Boolean).length / 5) * 100);

  // Readability
  const avgBulletLen = bulletText.split(".").filter(Boolean).reduce((a, b) => a + b.trim().length, 0) / Math.max(resume.experience.flatMap((e) => e.bullets).length, 1);
  const readability = avgBulletLen > 20 && avgBulletLen < 120 ? 90 : 60;

  const total = Math.round(
    keywordScore * 0.4 +
    formattingScore * 0.2 +
    contentScore * 0.2 +
    completeness * 0.1 +
    readability * 0.1
  );

  return {
    total,
    breakdown: {
      keyword: keywordScore,
      formatting: formattingScore,
      content: contentScore,
      completeness,
      readability,
    },
    matched: matched.slice(0, 15),
    missing,
    suggestions: [
      keywordScore < 60 && "Add more keywords from the job description to your bullets and skills",
      !hasNumbers && "Quantify achievements with numbers, percentages, or dollar amounts",
      usedVerbs < 3 && "Use stronger action verbs (Architected, Delivered, Scaled, etc.)",
      !resume.summary && "Add a professional summary section",
      resume.skills.length < 6 && "Expand your skills section to match job requirements",
    ].filter(Boolean),
  };
}

// ============================================================
// COMPONENTS
// ============================================================

// Animated score ring
function ScoreRing({ score, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", fill: color, fontWeight: 700, fontSize: size * 0.22 }}
      >
        {score}
      </text>
    </svg>
  );
}

// Pill tag
function Tag({ children, color = "#6366f1", onClick, removable }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: color + "18", color, border: `1px solid ${color}40`,
        borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 500,
        cursor: onClick ? "pointer" : "default", userSelect: "none",
      }}
    >
      {children}
      {removable && <span style={{ marginLeft: 2, fontWeight: 700, opacity: 0.7 }}>×</span>}
    </span>
  );
}

// Sidebar nav
function SideNav({ active, setActive, atsScore }) {
  const items = [
    { id: "landing", icon: "🏠", label: "Home" },
    { id: "builder", icon: "✏️", label: "Builder" },
    { id: "ats", icon: "📊", label: "ATS Analyzer" },
    { id: "templates", icon: "🎨", label: "Templates" },
    { id: "chat", icon: "🤖", label: "AI Assistant" },
    { id: "analytics", icon: "📈", label: "Analytics" },
  ];
  return (
    <nav style={{
      width: 220, minHeight: "100vh", background: "#0f172a",
      display: "flex", flexDirection: "column", padding: "24px 0",
      position: "fixed", left: 0, top: 0, zIndex: 100,
      boxShadow: "4px 0 24px #0002",
    }}>
      <div style={{ padding: "0 20px 28px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
          ⚡ ResumePro
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>AI-Powered Builder</div>
      </div>
      <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, border: "none",
              background: active === item.id ? "#6366f1" : "transparent",
              color: active === item.id ? "#fff" : "#94a3b8",
              cursor: "pointer", fontSize: 13, fontWeight: active === item.id ? 600 : 400,
              transition: "all 0.15s", textAlign: "left", width: "100%",
            }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
            {item.id === "ats" && atsScore !== null && (
              <span style={{
                marginLeft: "auto", fontSize: 11, fontWeight: 700,
                color: atsScore >= 75 ? "#22c55e" : atsScore >= 50 ? "#f59e0b" : "#ef4444",
                background: atsScore >= 75 ? "#22c55e18" : atsScore >= 50 ? "#f59e0b18" : "#ef444418",
                padding: "1px 6px", borderRadius: 8,
              }}>{atsScore}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ padding: "16px 20px", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
          <div>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>Alex Chen</div>
            <div style={{ color: "#475569", fontSize: 10 }}>Pro Plan</div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ============================================================
// LANDING PAGE
// ============================================================
function LandingPage({ onGetStarted }) {
  const features = [
    { icon: "🤖", title: "AI-Powered Writing", desc: "Generate professional bullet points and descriptions in seconds" },
    { icon: "📊", title: "ATS Score Checker", desc: "Real-time compatibility scoring against any job description" },
    { icon: "✨", title: "Smart Optimization", desc: "AI rewrites your resume for clarity, impact, and keywords" },
    { icon: "🎨", title: "5 ATS Templates", desc: "Professional, Minimal, Creative, Tech, and Executive designs" },
    { icon: "💬", title: "AI Chat Assistant", desc: "Get personalized advice and improvements from your AI coach" },
    { icon: "📥", title: "Export Anywhere", desc: "Download as PDF, DOCX, or JSON with one click" },
  ];
  const stats = [
    { n: "50K+", label: "Resumes Created" },
    { n: "3.2×", label: "More Interviews" },
    { n: "94%", label: "User Satisfaction" },
    { n: "2 min", label: "Avg. Build Time" },
  ];
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", color: "#0f172a" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
        padding: "80px 60px 100px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, #6366f130 0%, transparent 50%), radial-gradient(circle at 80% 20%, #8b5cf630 0%, transparent 50%)",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#6366f120", border: "1px solid #6366f140",
            borderRadius: 20, padding: "6px 16px", marginBottom: 24, color: "#a5b4fc", fontSize: 13,
          }}>
            ⚡ AI-Powered Resume Builder — Now with GPT-4
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 20, letterSpacing: -1.5 }}>
            Build a Resume That<br />
            <span style={{ background: "linear-gradient(90deg, #6366f1, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Gets You Hired
            </span>
          </h1>
          <p style={{ fontSize: 18, color: "#94a3b8", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
            Create ATS-optimized resumes in minutes with AI assistance. Beat the algorithms, impress recruiters, land more interviews.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={onGetStarted}
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px",
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 24px #6366f150",
              }}
            >
              Build My Resume Free →
            </button>
            <button
              onClick={() => {}}
              style={{
                background: "transparent", color: "#e2e8f0",
                border: "1px solid #334155", borderRadius: 12, padding: "14px 32px",
                fontSize: 16, fontWeight: 600, cursor: "pointer",
              }}
            >
              ▶ Watch Demo
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: "#f8fafc", padding: "40px 60px", display: "flex", justifyContent: "center", gap: 60, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0" }}>
        {stats.map((s) => (
          <div key={s.n} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#6366f1" }}>{s.n}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ padding: "80px 60px", maxWidth: 1000, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: -0.5 }}>
          Everything you need to land the job
        </h2>
        <p style={{ textAlign: "center", color: "#64748b", marginBottom: 56, fontSize: 16 }}>
          AI does the heavy lifting — you just fill in your story
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
              padding: 28, transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.title}</div>
              <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "60px", textAlign: "center" }}>
        <h2 style={{ color: "#fff", fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Ready to get hired faster?</h2>
        <p style={{ color: "#c4b5fd", marginBottom: 32, fontSize: 16 }}>Join 50,000+ professionals who built their dream career with ResumePro</p>
        <button
          onClick={onGetStarted}
          style={{
            background: "#fff", color: "#6366f1", border: "none", borderRadius: 12,
            padding: "14px 40px", fontSize: 16, fontWeight: 800, cursor: "pointer",
          }}
        >
          Get Started Free →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// RESUME PREVIEW
// ============================================================
function ResumePreview({ resume, template }) {
  const t = TEMPLATES[template] || TEMPLATES.professional;
  const s = {
    wrap: { fontFamily: t.font, background: t.bg, padding: "36px 40px", minHeight: 800, fontSize: 12, lineHeight: 1.5, color: "#1a1a1a" },
    header: { borderBottom: `3px solid ${t.accent}`, paddingBottom: 16, marginBottom: 20 },
    name: { fontSize: 26, fontWeight: 800, color: t.accent, marginBottom: 4, letterSpacing: -0.5 },
    title: { fontSize: 14, color: "#475569", marginBottom: 8 },
    contact: { fontSize: 11, color: "#64748b", display: "flex", flexWrap: "wrap", gap: "0 16px" },
    sectionTitle: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: t.accent, borderBottom: `1px solid ${t.accent}30`, paddingBottom: 4, marginBottom: 12, marginTop: 20 },
    expTitle: { fontWeight: 700, fontSize: 13 },
    expSub: { fontSize: 11, color: "#64748b", display: "flex", justifyContent: "space-between" },
    bullet: { fontSize: 11.5, marginLeft: 14, marginBottom: 3, color: "#1e293b" },
    skillGrid: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
    skill: { background: t.accent + "18", color: t.accent, border: `1px solid ${t.accent}30`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 500 },
  };
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.name}>{resume.name || "Your Name"}</div>
        <div style={s.title}>{resume.title || "Professional Title"}</div>
        <div style={s.contact}>
          {resume.email && <span>✉ {resume.email}</span>}
          {resume.phone && <span>📞 {resume.phone}</span>}
          {resume.location && <span>📍 {resume.location}</span>}
          {resume.linkedin && <span>🔗 {resume.linkedin}</span>}
          {resume.github && <span>💻 {resume.github}</span>}
        </div>
      </div>

      {resume.summary && (
        <>
          <div style={s.sectionTitle}>Summary</div>
          <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.7, marginBottom: 4 }}>{resume.summary}</p>
        </>
      )}

      {resume.experience.length > 0 && (
        <>
          <div style={s.sectionTitle}>Experience</div>
          {resume.experience.map((exp) => (
            <div key={exp.id} style={{ marginBottom: 14 }}>
              <div style={s.expTitle}>{exp.role}</div>
              <div style={s.expSub}><span>{exp.company}</span><span>{exp.period}</span></div>
              {exp.bullets.map((b, i) => <div key={i} style={s.bullet}>• {b}</div>)}
            </div>
          ))}
        </>
      )}

      {resume.education.length > 0 && (
        <>
          <div style={s.sectionTitle}>Education</div>
          {resume.education.map((ed) => (
            <div key={ed.id} style={{ marginBottom: 10 }}>
              <div style={s.expTitle}>{ed.degree}</div>
              <div style={s.expSub}><span>{ed.school}</span><span>{ed.period}</span></div>
              {ed.gpa && <div style={{ fontSize: 11, color: "#64748b" }}>GPA: {ed.gpa}</div>}
            </div>
          ))}
        </>
      )}

      {resume.skills.length > 0 && (
        <>
          <div style={s.sectionTitle}>Skills</div>
          <div style={s.skillGrid}>
            {resume.skills.map((sk) => <span key={sk} style={s.skill}>{sk}</span>)}
          </div>
        </>
      )}

      {resume.projects.length > 0 && (
        <>
          <div style={s.sectionTitle}>Projects</div>
          {resume.projects.map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={s.expTitle}>{p.name} <span style={{ fontWeight: 400, color: "#64748b" }}>— {p.tech}</span></div>
                {p.period && <span style={{ fontSize: 11, color: "#64748b" }}>{p.period}</span>}
              </div>
              {p.url && <div style={{ fontSize: 11, color: "#6366f1", marginBottom: 2 }}><a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1", textDecoration: "none" }}>🔗 {p.url}</a></div>}
              {p.desc && <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.6 }}>{p.desc}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ============================================================
// BUILDER PAGE
// ============================================================
function BuilderPage({ resume, setResume, template, setTemplate }) {
  const [tab, setTab] = useState("basics");
  const [loading, setLoading] = useState({});
  const [newSkill, setNewSkill] = useState("");

  const setLoad = (key, val) => setLoading((p) => ({ ...p, [key]: val }));

  const updateResume = (key, val) => setResume((p) => ({ ...p, [key]: val }));

  const aiImprove = async (type, index) => {
    const key = index !== undefined ? `${type}-${index}` : type;
    setLoad(key, true);
    try {
      if (type === "bullet") {
        const exp = resume.experience[index];
        const bullets = exp.bullets.join("\n");
        const result = await callClaude(
          `Rewrite these resume bullet points to be more impactful, use strong action verbs, and include measurable outcomes. Role: ${exp.role} at ${exp.company}.\n\nBullets:\n${bullets}\n\nReturn ONLY the improved bullets, one per line, starting with "•"`,
          "You are an expert resume writer. Return only bullet points, no explanation."
        );
        const newBullets = result.split("\n").filter((l) => l.trim()).map((l) => l.replace(/^[•\-*]\s*/, ""));
        setResume((p) => ({
          ...p,
          experience: p.experience.map((e, i) => i === index ? { ...e, bullets: newBullets } : e),
        }));
      } else if (type === "summary") {
        const result = await callClaude(
          `Rewrite this professional summary to be more compelling, concise, and impact-focused for a ${resume.title}.\n\nCurrent: ${resume.summary}\n\nReturn only the improved summary (2-3 sentences).`
        );
        updateResume("summary", result.trim());
      } else if (type === "project-desc") {
        const project = resume.projects[index];
        const safeName = (project.name || "").replace(/[^\w\s\-.,()]/g, "").slice(0, 100);
        const safeTech = (project.tech || "not specified").replace(/[^\w\s\-.,()]/g, "").slice(0, 100);
        const result = await callClaude(
          `Write a compelling 2-3 sentence project description for a resume. Project: "${safeName}". Tech stack: ${safeTech}.\n\nFocus on the problem solved, technologies used, and measurable impact. Return only the description text.`,
          "You are an expert resume writer. Return only the project description, no explanation."
        );
        setResume((p) => ({
          ...p,
          projects: p.projects.map((proj, i) => i === index ? { ...proj, desc: result.trim() } : proj),
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoad(key, false);
  };

  const generateBullets = async (index) => {
    const exp = resume.experience[index];
    setLoad(`gen-${index}`, true);
    try {
      const result = await callClaude(
        `Generate 3 strong resume bullet points for this role: ${exp.role} at ${exp.company}.\nMake them specific, measurable, and impactful. Use strong action verbs.\nReturn only 3 bullet points, one per line.`
      );
      const bullets = result.split("\n").filter((l) => l.trim()).slice(0, 3).map((l) => l.replace(/^[•\-*\d.]\s*/, ""));
      setResume((p) => ({
        ...p,
        experience: p.experience.map((e, i) => i === index ? { ...e, bullets } : e),
      }));
    } catch (e) {}
    setLoad(`gen-${index}`, false);
  };

  const addExperience = () => {
    setResume((p) => ({
      ...p,
      experience: [...p.experience, { id: Date.now(), company: "", role: "", period: "", bullets: [""] }],
    }));
  };

  const removeExperience = (id) => {
    setResume((p) => ({ ...p, experience: p.experience.filter((e) => e.id !== id) }));
  };

  const updateExp = (id, key, val) => {
    setResume((p) => ({
      ...p,
      experience: p.experience.map((e) => e.id === id ? { ...e, [key]: val } : e),
    }));
  };

  const updateBullet = (expId, bi, val) => {
    setResume((p) => ({
      ...p,
      experience: p.experience.map((e) => e.id === expId ? { ...e, bullets: e.bullets.map((b, i) => i === bi ? val : b) } : e),
    }));
  };

  const addBullet = (expId) => {
    setResume((p) => ({
      ...p,
      experience: p.experience.map((e) => e.id === expId ? { ...e, bullets: [...e.bullets, ""] } : e),
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !resume.skills.includes(newSkill.trim())) {
      updateResume("skills", [...resume.skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const tabs = ["basics", "experience", "education", "skills", "projects"];

  const inputStyle = {
    width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0",
    borderRadius: 8, fontSize: 13, outline: "none", background: "#fff",
    fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, display: "block" };
  const aiBtnStyle = (loading) => ({
    background: loading ? "#e2e8f0" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
    color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: 8,
    padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: loading ? "default" : "pointer",
    display: "flex", alignItems: "center", gap: 5,
  });

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Left: Editor */}
      <div style={{ width: "50%", overflowY: "auto", background: "#f8fafc", borderRight: "1px solid #e2e8f0" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Resume Editor</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "5px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600,
                  background: tab === t ? "#6366f1" : "#f1f5f9", color: tab === t ? "#fff" : "#475569",
                  cursor: "pointer", textTransform: "capitalize",
                }}
              >{t}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {tab === "basics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Full Name", "name"], ["Professional Title", "title"], ["Email", "email"], ["Phone", "phone"], ["Location", "location"], ["LinkedIn URL", "linkedin"], ["GitHub URL", "github"]].map(([label, key]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input style={inputStyle} value={resume[key]} onChange={(e) => updateResume(key, e.target.value)} placeholder={label} />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={labelStyle}>Professional Summary</label>
                  <button style={aiBtnStyle(loading["summary"])} onClick={() => aiImprove("summary")}>
                    {loading["summary"] ? "⏳" : "✨"} AI Improve
                  </button>
                </div>
                <textarea
                  style={{ ...inputStyle, height: 100, resize: "vertical" }}
                  value={resume.summary}
                  onChange={(e) => updateResume("summary", e.target.value)}
                  placeholder="Write a 2-3 sentence professional summary..."
                />
              </div>
            </div>
          )}

          {tab === "experience" && (
            <div>
              {resume.experience.map((exp, idx) => (
                <div key={exp.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Position {idx + 1}</span>
                    <button onClick={() => removeExperience(exp.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    {[["Company", "company"], ["Job Title", "role"], ["Time Period", "period"]].map(([label, key]) => (
                      <div key={key}>
                        <label style={labelStyle}>{label}</label>
                        <input style={inputStyle} value={exp[key]} onChange={(e) => updateExp(exp.id, key, e.target.value)} placeholder={label} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={labelStyle}>Bullet Points</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={aiBtnStyle(loading[`gen-${idx}`])} onClick={() => generateBullets(idx)}>
                        {loading[`gen-${idx}`] ? "⏳" : "🤖"} Generate
                      </button>
                      <button style={aiBtnStyle(loading[`bullet-${idx}`])} onClick={() => aiImprove("bullet", idx)}>
                        {loading[`bullet-${idx}`] ? "⏳" : "✨"} Improve
                      </button>
                    </div>
                  </div>
                  {exp.bullets.map((b, bi) => (
                    <input
                      key={bi} style={{ ...inputStyle, marginBottom: 6 }}
                      value={b}
                      onChange={(e) => updateBullet(exp.id, bi, e.target.value)}
                      placeholder="• Describe an achievement with measurable impact..."
                    />
                  ))}
                  <button onClick={() => addBullet(exp.id)} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>
                    + Add bullet
                  </button>
                </div>
              ))}
              <button onClick={addExperience} style={{ width: "100%", padding: 12, border: "2px dashed #cbd5e1", background: "none", borderRadius: 10, color: "#6366f1", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                + Add Experience
              </button>
            </div>
          )}

          {tab === "education" && (
            <div>
              {resume.education.map((ed) => (
                <div key={ed.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[["School", "school"], ["Degree", "degree"], ["Period", "period"], ["GPA (Optional)", "gpa"]].map(([label, key]) => (
                      <div key={key}>
                        <label style={labelStyle}>{label}</label>
                        <input style={inputStyle} value={ed[key] || ""} onChange={(e) => setResume((p) => ({ ...p, education: p.education.map((x) => x.id === ed.id ? { ...x, [key]: e.target.value } : x) }))} placeholder={label} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => setResume((p) => ({ ...p, education: [...p.education, { id: Date.now(), school: "", degree: "", period: "", gpa: "" }] }))} style={{ width: "100%", padding: 12, border: "2px dashed #cbd5e1", background: "none", borderRadius: 10, color: "#6366f1", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                + Add Education
              </button>
            </div>
          )}

          {tab === "skills" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Your Skills</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 12, minHeight: 60 }}>
                  {resume.skills.map((sk) => (
                    <Tag key={sk} color="#6366f1" removable onClick={() => updateResume("skills", resume.skills.filter((s) => s !== sk))}>{sk}</Tag>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSkill()} placeholder="Type a skill and press Enter..." />
                  <button onClick={addSkill} style={{ padding: "9px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Add</button>
                </div>
              </div>
              {Object.entries(SKILL_SUGGESTIONS).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "capitalize", marginBottom: 8 }}>{cat} Skills</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {skills.filter((s) => !resume.skills.includes(s)).map((sk) => (
                      <button key={sk} onClick={() => updateResume("skills", [...resume.skills, sk])} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569" }}>
                        + {sk}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>💡 Strong Action Verbs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ACTION_VERBS.slice(0, 15).map((v) => (
                    <span key={v} style={{ padding: "3px 8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, fontSize: 11, color: "#059669" }}>{v}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "projects" && (
            <div>
              {resume.projects.map((p, idx) => (
                <div key={p.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Project {idx + 1}</span>
                    <button onClick={() => setResume((r) => ({ ...r, projects: r.projects.filter((x) => x.id !== p.id) }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                    {[["Project Name", "name"], ["Tech Stack", "tech"], ["Project URL", "url"], ["Time Period", "period"]].map(([label, key]) => (
                      <div key={key}>
                        <label style={labelStyle}>{label}</label>
                        <input style={inputStyle} value={p[key] || ""} onChange={(e) => setResume((r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, [key]: e.target.value } : x) }))} placeholder={label} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={labelStyle}>Description</label>
                      <button style={aiBtnStyle(loading[`project-desc-${idx}`])} onClick={() => aiImprove("project-desc", idx)}>
                        {loading[`project-desc-${idx}`] ? "⏳" : "🤖"} Generate
                      </button>
                    </div>
                    <textarea
                      style={{ ...inputStyle, height: 90, resize: "vertical" }}
                      value={p.desc || ""}
                      onChange={(e) => setResume((r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, desc: e.target.value } : x) }))}
                      placeholder="Describe the project, technologies used, and measurable impact..."
                    />
                  </div>
                </div>
              ))}
              <button onClick={() => setResume((r) => ({ ...r, projects: [...r.projects, { id: Date.now(), name: "", tech: "", desc: "", url: "", period: "" }] }))} style={{ width: "100%", padding: 12, border: "2px dashed #cbd5e1", background: "none", borderRadius: 10, color: "#6366f1", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                + Add Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ width: "50%", overflowY: "auto", background: "#e2e8f0" }}>
        <div style={{ padding: "12px 20px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Live Preview</span>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                title={t.name}
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: t.accent, border: template === key ? "3px solid #6366f1" : "2px solid transparent",
                  cursor: "pointer", outline: "none",
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px #0001" }}>
            <ResumePreview resume={resume} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ATS ANALYZER PAGE
// ============================================================
function ATSPage({ resume, atsResult, setAtsResult }) {
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const analyze = () => {
    if (!jd.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const result = computeATSScore(resume, jd);
      setAtsResult(result);
      setLoading(false);
    }, 800);
  };

  const getAISuggestions = async () => {
    if (!atsResult) return;
    setAiLoading(true);
    try {
      const result = await callClaude(
        `I have a resume for ${resume.name} (${resume.title}) and a job description. The ATS score is ${atsResult.total}/100.\n\nMissing keywords: ${atsResult.missing.join(", ")}\n\nProvide 5 specific, actionable suggestions to improve the ATS score. Be concise and practical.`,
        "You are an expert ATS optimization consultant. Give specific, actionable advice."
      );
      setAiSuggestions(result);
    } catch (e) {}
    setAiLoading(false);
  };

  const breakdownItems = atsResult ? [
    { label: "Keyword Match", value: atsResult.breakdown.keyword, weight: "40%" },
    { label: "Formatting", value: atsResult.breakdown.formatting, weight: "20%" },
    { label: "Content Strength", value: atsResult.breakdown.content, weight: "20%" },
    { label: "Completeness", value: atsResult.breakdown.completeness, weight: "10%" },
    { label: "Readability", value: atsResult.breakdown.readability, weight: "10%" },
  ] : [];

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>ATS Score Analyzer</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>Paste a job description to analyze your resume's ATS compatibility</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 10 }}>📋 Job Description</label>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here..."
          style={{ width: "100%", height: 180, padding: 14, border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }}
        />
        <button
          onClick={analyze}
          disabled={!jd.trim() || loading}
          style={{
            marginTop: 12, padding: "12px 28px", background: loading ? "#e2e8f0" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: loading ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "⏳ Analyzing..." : "🔍 Analyze Resume"}
        </button>
      </div>

      {atsResult && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Score */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#374151" }}>Overall ATS Score</div>
            <ScoreRing score={atsResult.total} size={140} stroke={12} />
            <div style={{ marginTop: 16, fontSize: 13, color: atsResult.total >= 75 ? "#22c55e" : atsResult.total >= 50 ? "#f59e0b" : "#ef4444", fontWeight: 700 }}>
              {atsResult.total >= 75 ? "✅ Excellent" : atsResult.total >= 50 ? "⚠️ Needs Work" : "❌ Poor Match"}
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Score Breakdown</div>
            {breakdownItems.map((item) => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{item.label} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({item.weight})</span></span>
                  <span style={{ fontWeight: 700, color: item.value >= 75 ? "#22c55e" : item.value >= 50 ? "#f59e0b" : "#ef4444" }}>{item.value}%</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${item.value}%`, borderRadius: 3, background: item.value >= 75 ? "#22c55e" : item.value >= 50 ? "#f59e0b" : "#ef4444", transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Keywords */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>✅ Matched Keywords ({atsResult.matched.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {atsResult.matched.map((w) => <Tag key={w} color="#059669">{w}</Tag>)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 18, marginBottom: 12 }}>❌ Missing Keywords ({atsResult.missing.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {atsResult.missing.map((w) => <Tag key={w} color="#ef4444">{w}</Tag>)}
            </div>
          </div>

          {/* Suggestions */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💡 Improvement Suggestions</div>
            {atsResult.suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: 13, color: "#374151" }}>
                <span style={{ color: "#f59e0b", flexShrink: 0 }}>→</span> {s}
              </div>
            ))}
            <button
              onClick={getAISuggestions}
              disabled={aiLoading}
              style={{
                marginTop: 12, padding: "10px 20px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%",
              }}
            >
              {aiLoading ? "⏳ Getting AI Advice..." : "🤖 Get Detailed AI Suggestions"}
            </button>
            {aiSuggestions && (
              <div style={{ marginTop: 14, padding: 14, background: "#f5f3ff", borderRadius: 10, fontSize: 12, lineHeight: 1.8, color: "#374151" }}>
                {aiSuggestions}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TEMPLATE GALLERY
// ============================================================
function TemplatesPage({ template, setTemplate, resume }) {
  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Resume Templates</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>All templates are ATS-friendly and professionally designed</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
        {Object.entries(TEMPLATES).map(([key, t]) => (
          <div
            key={key}
            onClick={() => setTemplate(key)}
            style={{
              border: `2px solid ${template === key ? "#6366f1" : "#e2e8f0"}`,
              borderRadius: 16, overflow: "hidden", cursor: "pointer",
              boxShadow: template === key ? "0 0 0 4px #6366f120" : "none",
              transition: "all 0.2s",
            }}
          >
            <div style={{ height: 300, overflow: "hidden", transform: "scale(0.6)", transformOrigin: "top left", width: "166%", pointerEvents: "none" }}>
              <ResumePreview resume={resume} template={key} />
            </div>
            <div style={{ padding: "14px 18px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{t.desc}</div>
              </div>
              {template === key ? (
                <span style={{ background: "#6366f1", color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>✓ Active</span>
              ) : (
                <button style={{ background: "#f1f5f9", color: "#6366f1", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Select</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// AI CHAT ASSISTANT
// ============================================================
function ChatPage({ resume }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "👋 Hi! I'm your AI Resume Coach. I can help you improve bullet points, suggest skills, tailor your resume for specific roles, and more. What would you like help with?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const quickPrompts = [
    "Improve my top bullet points",
    "Suggest skills for a senior role",
    "Tailor my resume for a startup",
    "How can I make my summary stronger?",
    "What keywords should I add?",
  ];

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const context = `Resume context: ${resume.name}, ${resume.title}. Skills: ${resume.skills.join(", ")}. Experience: ${resume.experience.map((e) => `${e.role} at ${e.company}`).join(", ")}.`;
      const reply = await callClaude(
        `${context}\n\nUser question: ${msg}`,
        "You are an expert resume coach and career advisor. Give specific, actionable, encouraging advice. Keep responses concise (2-4 paragraphs max)."
      );
      setMessages((p) => [...p, { role: "assistant", text: reply }]);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", text: "Sorry, I couldn't connect. Please try again." }]);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>
      <div style={{ padding: "20px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>🤖 AI Resume Assistant</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Powered by Claude — your personal career coach</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "75%", padding: "12px 16px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.role === "user" ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#fff",
              color: m.role === "user" ? "#fff" : "#1e293b",
              border: m.role === "assistant" ? "1px solid #e2e8f0" : "none",
              fontSize: 13, lineHeight: 1.7,
              boxShadow: "0 2px 8px #0001",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px", background: "#fff", borderRadius: 16, width: 70, border: "1px solid #e2e8f0" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div style={{ padding: "8px 24px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, overflowX: "auto" }}>
        {quickPrompts.map((p) => (
          <button key={p} onClick={() => send(p)} style={{ whiteSpace: "nowrap", padding: "6px 14px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 20, color: "#6366f1", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{p}</button>
        ))}
      </div>

      <div style={{ padding: "14px 24px", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask your AI coach anything about your resume..."
          style={{ flex: 1, padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ padding: "12px 20px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 16 }}
        >
          ↑
        </button>
      </div>

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }`}</style>
    </div>
  );
}

// ============================================================
// ANALYTICS DASHBOARD
// ============================================================
function AnalyticsPage({ atsResult, resume }) {
  const mockHistory = [
    { date: "Mar 1", score: 42 }, { date: "Mar 4", score: 55 }, { date: "Mar 7", score: 63 },
    { date: "Mar 10", score: 71 }, { date: "Mar 12", score: atsResult?.total || 78 },
  ];
  const maxScore = 100;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Analytics Dashboard</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Track your resume improvement over time</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Current ATS Score", value: atsResult?.total || "--", color: "#6366f1" },
          { label: "Skills Listed", value: resume.skills.length, color: "#059669" },
          { label: "Experience Items", value: resume.experience.length, color: "#f59e0b" },
          { label: "Resume Sections", value: [resume.summary, resume.experience.length, resume.education.length, resume.skills.length, resume.projects.length].filter(Boolean).length, color: "#8b5cf6" },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ATS Trend chart */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📈 ATS Score Trend</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160 }}>
          {mockHistory.map((d) => (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.score >= 75 ? "#22c55e" : d.score >= 50 ? "#f59e0b" : "#ef4444" }}>{d.score}</div>
              <div style={{
                width: "100%", borderRadius: "6px 6px 0 0",
                height: `${(d.score / maxScore) * 120}px`,
                background: d.score >= 75 ? "linear-gradient(#22c55e,#4ade80)" : d.score >= 50 ? "linear-gradient(#f59e0b,#fcd34d)" : "linear-gradient(#ef4444,#fca5a5)",
                transition: "height 0.5s",
              }} />
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement checklist */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>✅ Resume Checklist</div>
        {[
          { label: "Professional summary added", done: !!resume.summary },
          { label: "At least 2 experience entries", done: resume.experience.length >= 2 },
          { label: "Bullet points use action verbs", done: resume.experience.some((e) => e.bullets.some((b) => ACTION_VERBS.some((v) => b.toLowerCase().includes(v.toLowerCase())))) },
          { label: "Quantified achievements (numbers/metrics)", done: /\d+%|\d+x|\$\d+/.test(resume.experience.flatMap((e) => e.bullets).join(" ")) },
          { label: "10+ skills listed", done: resume.skills.length >= 10 },
          { label: "Education section complete", done: resume.education.length > 0 && !!resume.education[0].school },
          { label: "LinkedIn URL provided", done: !!resume.linkedin },
          { label: "Projects section added", done: resume.projects.length > 0 },
          { label: "ATS score above 75", done: (atsResult?.total || 0) >= 75 },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f8fafc" }}>
            <span style={{ fontSize: 16 }}>{item.done ? "✅" : "⬜"}</span>
            <span style={{ fontSize: 13, color: item.done ? "#1e293b" : "#94a3b8", textDecoration: item.done ? "none" : "none" }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// EXPORT MODAL
// ============================================================
function ExportModal({ resume, template, onClose }) {
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${resume.name.replace(" ", "_")}_resume.json`; a.click();
  };

  const exportHTML = () => {
    const t = TEMPLATES[template];
    const html = `<!DOCTYPE html><html><head><title>${resume.name} - Resume</title><style>body{font-family:${t.font};background:${t.bg};padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}h1{color:${t.accent}}h2{color:${t.accent};border-bottom:2px solid ${t.accent}30;padding-bottom:4px;font-size:14px;text-transform:uppercase;letter-spacing:1px}.contact{color:#64748b;font-size:13px}@media print{body{padding:0}}</style></head><body><h1>${resume.name}</h1><p>${resume.title}</p><p class="contact">${[resume.email,resume.phone,resume.location,resume.linkedin].filter(Boolean).join(" | ")}</p>${resume.summary ? `<h2>Summary</h2><p>${resume.summary}</p>` : ""}${resume.experience.length ? `<h2>Experience</h2>${resume.experience.map(e=>`<div><strong>${e.role}</strong> — ${e.company} (${e.period})<ul>${e.bullets.map(b=>`<li>${b}</li>`).join("")}</ul></div>`).join("")}` : ""}${resume.skills.length ? `<h2>Skills</h2><p>${resume.skills.join(", ")}</p>` : ""}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${resume.name.replace(" ", "_")}_resume.html`; a.click();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 36, minWidth: 380, boxShadow: "0 20px 60px #0002" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Export Resume</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>Download your resume in your preferred format</div>
        {[
          { icon: "📄", label: "PDF (Print-Ready)", sub: "Best for job applications", action: () => { alert("PDF export: In production, this uses Puppeteer/wkhtmltopdf on the server."); }, color: "#ef4444" },
          { icon: "📝", label: "HTML (Web)", sub: "Edit and print from browser", action: exportHTML, color: "#3b82f6" },
          { icon: "{ }", label: "JSON Resume", sub: "Machine-readable format", action: exportJSON, color: "#6366f1" },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={opt.action}
            style={{
              width: "100%", padding: "14px 18px", marginBottom: 10, border: "1px solid #e2e8f0", borderRadius: 12,
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 28 }}>{opt.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: opt.color }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{opt.sub}</div>
            </div>
          </button>
        ))}
        <button onClick={onClose} style={{ width: "100%", padding: 12, background: "#f1f5f9", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569", marginTop: 6 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("landing");
  const [resume, setResume] = useState(SAMPLE_RESUME);
  const [template, setTemplate] = useState("professional");
  const [atsResult, setAtsResult] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const atsScore = atsResult?.total ?? null;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {page === "landing" ? (
        <LandingPage onGetStarted={() => setPage("builder")} />
      ) : (
        <div style={{ display: "flex" }}>
          <SideNav active={page} setActive={setPage} atsScore={atsScore} />
          <div style={{ marginLeft: 220, flex: 1, minHeight: "100vh", background: "#f8fafc" }}>
            {/* Top bar */}
            <div style={{
              position: "sticky", top: 0, zIndex: 50, background: "#fff",
              borderBottom: "1px solid #e2e8f0", padding: "12px 24px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 14, color: "#64748b" }}>
                <span style={{ color: "#6366f1", fontWeight: 700 }}>{resume.name || "Your Resume"}</span>
                {" "} · Last saved just now
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {atsScore !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#f5f3ff", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#6366f1" }}>
                    ATS Score: <span style={{ color: atsScore >= 75 ? "#22c55e" : atsScore >= 50 ? "#f59e0b" : "#ef4444" }}>{atsScore}/100</span>
                  </div>
                )}
                <button
                  onClick={() => setShowExport(true)}
                  style={{ padding: "8px 18px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  📥 Export
                </button>
              </div>
            </div>

            {page === "builder" && <BuilderPage resume={resume} setResume={setResume} template={template} setTemplate={setTemplate} />}
            {page === "ats" && <ATSPage resume={resume} atsResult={atsResult} setAtsResult={setAtsResult} />}
            {page === "templates" && <TemplatesPage template={template} setTemplate={setTemplate} resume={resume} />}
            {page === "chat" && <ChatPage resume={resume} />}
            {page === "analytics" && <AnalyticsPage atsResult={atsResult} resume={resume} />}
          </div>
        </div>
      )}

      {showExport && <ExportModal resume={resume} template={template} onClose={() => setShowExport(false)} />}
    </div>
  );
}
