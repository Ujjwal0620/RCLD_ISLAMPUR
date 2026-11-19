"use client";

import { useEffect, useState } from "react";
import { IdCard, X } from "lucide-react";

const titleFor = (name) => name.replace(/\.(jpe?g|png)$/i, "").replace(/\bsem-(\d+)/i, "Semester $1");

export default function CodingForKidsIcardDialog({ open, student, onClose, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/icard-templates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load templates.");
        if (!cancelled) setTemplates(data.templates || []);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Unable to load templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="cfk-template-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="cfk-template-dialog" role="dialog" aria-modal="true" aria-labelledby="cfk-template-title">
        <header className="cfk-template-heading">
          <div className="cfk-template-icon"><IdCard size={21}/></div>
          <div>
            <h2 id="cfk-template-title">Choose I-Card Template</h2>
            <p>Select a background template for {student?.applicantName || "this student"}</p>
          </div>
          <button type="button" className="cfk-template-close" aria-label="Close" onClick={onClose}><X size={20}/></button>
        </header>
        {loading && <p role="status">Loading available templates…</p>}
        {error && <p role="alert" className="error-text">{error}</p>}
        {!loading && !error && templates.length === 0 && <p>No JPG or PNG templates were found in public/assets/icardtemplates.</p>}
        <div className="cfk-template-grid">
          {templates.map((template) => (
            <button type="button" className="cfk-template-option" key={template} onClick={() => onSelect(template)}>
              <img src={`/assets/icardtemplates/${encodeURIComponent(template)}`} alt={`${titleFor(template)} preview`}/>
              <span className="cfk-template-option-copy">
                <strong>{titleFor(template)}</strong>
                <small>{template}</small>
              </span>
              <span className="cfk-template-select">Select template</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
