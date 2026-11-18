"use client";

import { IdCard, X } from "lucide-react";

export default function CodingForKidsIcardDialog({ open, student, onClose, onSelect }) {
  if (!open) return null;
  return (
    <div className="cfk-template-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="cfk-template-dialog" role="dialog" aria-modal="true" aria-labelledby="cfk-template-title">
        <header className="cfk-template-heading">
          <div className="cfk-template-icon"><IdCard size={21}/></div>
          <div><h2 id="cfk-template-title">Choose I-Card Template</h2><p>Select a template for {student?.applicantName || "this student"}</p></div>
          <button type="button" className="cfk-template-close" aria-label="Close" onClick={onClose}><X size={20}/></button>
        </header>
        <button type="button" className="cfk-template-option" onClick={onSelect}>
          <img src="/assets/template I card.png" alt="RCLD Coding for Kids I-card template preview"/>
          <span><strong>Template I Card.png</strong><small>RCLD Coding for Kids • Portrait</small></span>
          <span className="cfk-template-select">Use template</span>
        </button>
      </section>
    </div>
  );
}
