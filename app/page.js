"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, Monitor, Sparkles } from "lucide-react";
import RCLDLogo from "@/components/RCLDLogo";

const money = (value) => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/courses", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load the course catalogue.");
        if (active) setCourses(data.courses || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load courses right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="public-home">
      <header className="public-nav">
        <a className="public-brand" href="#home" aria-label="RCLD Islampur home">
          <RCLDLogo className="public-brand-logo" />
          <span><strong>RCLD</strong><small>Islampur</small></span>
        </a>
        <nav aria-label="Public navigation">
          <a href="#courses">Courses</a>
          <a href="#learning">Learning approach</a>
          <a href="#about">About RCLD</a>
        </nav>
        <a className="public-nav-cta" href="#courses">Explore courses <ArrowRight size={15} /></a>
      </header>

      <section className="public-hero" id="home">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><Sparkles size={14} /> RCLD ISLAMPUR · COMPUTER EDUCATION</span>
          <h1>Build practical computer skills. <em>Open new possibilities.</em></h1>
          <p>Learn with structured computer courses designed to help students grow their digital confidence, strengthen practical skills and prepare for the next step.</p>
          <div className="public-hero-actions">
            <a className="public-primary-cta" href="#courses">Explore our courses <ArrowRight size={17} /></a>
            <a className="public-secondary-cta" href="#about">Discover RCLD</a>
          </div>
          <div className="public-hero-points">
            <span><CheckCircle2 size={15} /> Practical computer learning</span>
            <span><CheckCircle2 size={15} /> Structured course pathways</span>
          </div>
        </div>
        <div className="public-hero-visual" aria-label="Illustration of a computer learning workspace">
          <div className="public-visual-glow" />
          <div className="public-floating-chip public-chip-top"><Monitor size={16} /> Digital skills</div>
          <div className="public-screen-card">
            <div className="public-screen-top"><span /><span /><span /><b>RCLD Learning</b></div>
            <div className="public-screen-body">
              <div className="public-screen-sidebar"><i /><i /><i /><i /></div>
              <div className="public-screen-content">
                <span className="public-screen-kicker">YOUR NEXT STEP</span>
                <strong>Learn. Practise. Progress.</strong>
                <div className="public-screen-course"><span><BookOpen size={16} /></span><div><b>Computer Applications</b><small>Build your foundation</small></div><ArrowRight size={15} /></div>
                <div className="public-screen-progress"><span /><span /><span /></div>
                <small className="public-screen-caption">A clear path from fundamentals to confidence.</small>
              </div>
            </div>
          </div>
          <div className="public-floating-chip public-chip-bottom"><GraduationCap size={17} /><span><b>Learn with purpose</b><small>One skill at a time</small></span></div>
        </div>
      </section>

      <section className="public-highlights" aria-label="RCLD learning highlights">
        <div><span className="public-highlight-icon"><Monitor size={18} /></span><span><strong>Computer education</strong><small>Skills for a digital world</small></span></div>
        <div><span className="public-highlight-icon"><BookOpen size={18} /></span><span><strong>Course pathways</strong><small>Clear learning progression</small></span></div>
        <div><span className="public-highlight-icon"><CalendarDays size={18} /></span><span><strong>Structured batches</strong><small>Organised class schedules</small></span></div>
      </section>

      <section className="public-section public-courses" id="courses">
        <div className="public-section-heading">
          <div><span className="public-eyebrow">COURSE CATALOGUE</span><h2>Find the course that moves you forward.</h2><p>Explore the active courses currently listed by RCLD Islampur.</p></div>
          <span className="public-course-count">{loading ? "Loading courses" : courses.length + " courses listed"}</span>
        </div>
        {error ? <div className="public-state public-error">{error}</div> : loading ? <div className="public-state">Loading course catalogue…</div> : courses.length === 0 ? <div className="public-state">No courses are published at the moment. Please check back soon.</div> : (
          <div className="public-course-grid">
            {courses.map((course) => (
              <article className="public-course-card" key={course._id || course.code}>
                <div className="public-course-card-top"><span>{course.code}</span><span>{course.category || "Computer course"}</span></div>
                <h3>{course.name}</h3>
                <p>{course.description || "Build practical knowledge through a structured computer education pathway."}</p>
                <div className="public-course-meta">
                  <span><Clock3 size={14} /> {course.durationMonths} months</span>
                  <span><CalendarDays size={14} /> {course.classesPerWeek} classes / week</span>
                </div>
                <div className="public-course-footer"><strong>{money(course.fee)} <small>course fee</small></strong><a href="#contact" aria-label={"Enquire about " + course.name}>Enquire <ArrowRight size={14} /></a></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="public-learning" id="learning">
        <div className="public-learning-copy">
          <span className="public-eyebrow">A PRACTICAL APPROACH</span>
          <h2>Learning should lead to confidence, not just a certificate.</h2>
          <p>RCLD focuses on computer education through clear course structures and a learning journey that helps students understand concepts and build useful skills.</p>
        </div>
        <div className="public-learning-list">
          <article><span>01</span><div><strong>Start with the right foundation</strong><p>Choose a course aligned with your current level and learning goals.</p></div></article>
          <article><span>02</span><div><strong>Build skills step by step</strong><p>Follow a structured programme with regular classes and practical learning.</p></div></article>
          <article><span>03</span><div><strong>Keep progressing</strong><p>Develop confidence as you complete topics and move through your course.</p></div></article>
        </div>
      </section>

      <section className="public-about" id="about">
        <div className="public-about-mark"><RCLDLogo className="public-about-logo" /></div>
        <div><span className="public-eyebrow">ABOUT RCLD ISLAMPUR</span><h2>Computer education for the next generation of learners.</h2><p>Rashtriya Computer Literacy Drive (RCLD), Islampur provides computer-related courses for learners who want to build digital knowledge and practical computer skills.</p></div>
        <a className="public-about-link" href="#courses">View course options <ArrowRight size={16} /></a>
      </section>

      <section className="public-contact" id="contact">
        <div><span className="public-eyebrow">TAKE THE NEXT STEP</span><h2>Ready to begin your learning journey?</h2><p>Explore the current course catalogue and connect with the RCLD Islampur centre for course and batch information.</p></div>
        <a className="public-primary-cta" href="#courses">Explore courses <ArrowRight size={17} /></a>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="#home"><RCLDLogo className="public-brand-logo" /><span><strong>RCLD</strong><small>Islampur</small></span></a>
        <span>© {new Date().getFullYear()} Rashtriya Computer Literacy Drive · Islampur</span>
        <a href="/dashboard/login">ERP Login</a>
      </footer>
    </main>
  );
}
