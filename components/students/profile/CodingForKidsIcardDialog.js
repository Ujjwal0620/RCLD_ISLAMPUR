"use client";

import { IdCard, X } from "lucide-react";

const templates = [
  "ID Card Diploma.jpg",
  "ID Card Robotics 1st year.jpg",
  "ID Card Robotics 2nd year.jpg",
  "ID Card Robotics 3rd year.jpg",
  "ID Card School Course.jpg",
  "ID Card Sem-1.jpg",
  "ID Card Sem-2.jpg",
  "ID Card Sem-3.jpg",
  "ID Card Sem-4.jpg",
  "ID Card Sem-5.jpg",
  "ID Card Sem-6.jpg",
];

const titleFor = (name) => name.replace(/\.jpg$/i, "").replace(/\bsem-(\d+)/i, "Semester $1");

export default function CodingForKidsIcardDialog({ open, student, onClose, onSelect }) {
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
