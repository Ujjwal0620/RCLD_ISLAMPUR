"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, IdCard, LoaderCircle, X } from "lucide-react";
import {
  getRecommendedIcardTemplate,
  renderStudentIcardCanvas,
} from "@/features/students/print/renderStudentIcardCanvas";

const titleFor = name => name.replace(/\.(jpe?g|png)$/i, "").replace(/\bsem-(\d+)/i, "Semester $1");

export default function CodingForKidsIcardDialog({
  open,
  student,
  students,
  mode = "print",
  onClose,
  onSelect,
}) {
  const records = useMemo(() => (Array.isArray(students) && students.length ? students : student ? [student] : []), [students, student]);
  const previewStudent = records[0] || null;
  const previewCanvasRef = useRef(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/icard-templates", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load templates.");
        if (cancelled) return;
        const available = data.templates || [];
        setTemplates(available);
        setSelectedTemplate(getRecommendedIcardTemplate(previewStudent, available));
      })
      .catch(requestError => {
        if (!cancelled) setError(requestError.message || "Unable to load templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, previewStudent]);

  useEffect(() => {
    if (!open || !selectedTemplate || !previewStudent || !previewCanvasRef.current) return;
    let cancelled = false;
    setPreviewLoading(true);
    setError("");
    renderStudentIcardCanvas(previewStudent, selectedTemplate)
      .then(source => {
        if (cancelled || !previewCanvasRef.current) return;
        const target = previewCanvasRef.current;
        target.width = source.width;
        target.height = source.height;
        const context = target.getContext("2d");
        context.clearRect(0, 0, target.width, target.height);
        context.drawImage(source, 0, 0);
      })
      .catch(renderError => {
        if (!cancelled) setError(renderError.message || "Unable to render the preview.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, selectedTemplate, previewStudent]);

  if (!open) return null;

  async function confirmSelection() {
    if (!selectedTemplate || !records.length || confirming) return;
    setConfirming(true);
    try {
      await onSelect?.(selectedTemplate, records, mode);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="cfk-template-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !confirming) onClose();
    }}>
      <section className="cfk-template-dialog icard-template-workspace" role="dialog" aria-modal="true" aria-labelledby="cfk-template-title">
        <header className="cfk-template-heading">
          <div className="cfk-template-icon"><IdCard size={21}/></div>
          <div>
            <h2 id="cfk-template-title">Select ID Card Template</h2>
            <p>{records.length > 1 ? `Preparing ${records.length} student ID cards` : `Preview for ${previewStudent?.applicantName || "this student"}`}</p>
          </div>
          <button type="button" className="cfk-template-close" aria-label="Close" disabled={confirming} onClick={onClose}><X size={20}/></button>
        </header>

        {error && <p role="alert" className="error-text icard-template-error">{error}</p>}
        {loading ? <p role="status" className="icard-template-loading"><LoaderCircle size={17}/> Loading templates…</p> : (
          <div className="icard-template-layout">
            <aside className="icard-template-sidebar">
              <div className="icard-template-section-title">
                <strong>Available templates</strong>
                <span>{templates.length} found</span>
              </div>
              <div className="icard-template-grid">
                {templates.map(template => (
                  <button
                    type="button"
                    className={`cfk-template-option icard-template-option ${selectedTemplate === template ? "is-selected" : ""}`}
                    key={template}
                    aria-pressed={selectedTemplate === template}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <img src={`/api/icard-templates/${encodeURIComponent(template)}`} alt={`${titleFor(template)} preview`} loading="lazy"/>
                    <span className="cfk-template-option-copy">
                      <strong>{titleFor(template)}</strong>
                      <small>{template}</small>
                    </span>
                    <span className="icard-template-check">{selectedTemplate === template ? <Check size={16}/> : "Select"}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="icard-live-preview">
              <div className="icard-preview-heading">
                <div><strong>Live ID card preview</strong><span>{selectedTemplate || "Choose a template"}</span></div>
                {previewLoading && <span className="icard-preview-progress"><LoaderCircle size={15}/> Rendering</span>}
              </div>
              <div className="icard-preview-stage">
                <canvas ref={previewCanvasRef} aria-label="Live student ID card preview"/>
                {!selectedTemplate && !loading && <p>Select a template to preview the card.</p>}
              </div>
              {records.length > 1 && <p className="icard-bulk-note">Previewing {previewStudent?.applicantName || "the first selected student"}. The selected template and layout will be applied to all {records.length} students.</p>}
              <div className="icard-preview-actions">
                <button type="button" className="ghost-btn" onClick={onClose} disabled={confirming}>Cancel</button>
                <button type="button" className="primary-btn" onClick={confirmSelection} disabled={!selectedTemplate || loading || previewLoading || confirming}>
                  {confirming ? <><LoaderCircle size={16}/> Preparing…</> : mode === "jpg" ? "Confirm Download" : "Print ID Card"}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
      <style jsx>{`
        .icard-template-workspace{width:min(1120px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:hidden;display:flex;flex-direction:column}
        .icard-template-layout{display:grid;grid-template-columns:minmax(300px,1fr) minmax(280px,.92fr);gap:22px;min-height:0;overflow:hidden}
        .icard-template-sidebar{min-height:0;overflow:auto;padding:2px 4px 8px 0}
        .icard-template-section-title,.icard-preview-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
        .icard-template-section-title span,.icard-preview-heading span{font-size:12px;color:var(--muted,#77808d)}
        .icard-template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
        .icard-template-option{position:relative;text-align:left;border:1px solid var(--border,#dce1e8);border-radius:12px;padding:8px;background:var(--surface,#fff);min-width:0;transition:border-color .15s,box-shadow .15s}
        .icard-template-option.is-selected{border:2px solid var(--primary,#315efb);padding:7px;box-shadow:0 0 0 3px color-mix(in srgb,var(--primary,#315efb) 12%,transparent)}
        .icard-template-option img{display:block;width:100%;height:138px;object-fit:contain;background:#f1f3f5;border-radius:7px}
        .icard-template-option-copy{display:flex;flex-direction:column;gap:3px;padding:8px 2px 3px;min-width:0}
        .icard-template-option-copy strong,.icard-template-option-copy small{overflow-wrap:anywhere}
        .icard-template-option-copy strong{font-size:12px;color:var(--text,#252b33)}
        .icard-template-option-copy small{font-size:10px;color:var(--muted,#77808d)}
        .icard-template-check{position:absolute;right:12px;top:12px;border-radius:20px;background:var(--primary,#315efb);color:white;padding:4px 7px;font-size:10px;font-weight:700}
        .icard-live-preview{min-height:0;display:flex;flex-direction:column;border:1px solid var(--border,#e1e5eb);border-radius:14px;padding:14px;background:var(--surface-subtle,#f8f9fb)}
        .icard-preview-heading{margin-bottom:8px}.icard-preview-heading div{display:flex;flex-direction:column;gap:3px}
        .icard-preview-stage{flex:1;min-height:280px;max-height:65vh;display:flex;align-items:center;justify-content:center;overflow:auto;background:#e9edf2;border-radius:10px;padding:12px}
        .icard-preview-stage canvas{display:block;width:auto;height:auto;max-width:100%;max-height:58vh;object-fit:contain;box-shadow:0 4px 18px #0002}
        .icard-preview-stage p{font-size:13px;color:var(--muted,#77808d)}
        .icard-preview-progress,.icard-template-loading{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted,#77808d)}
        .icard-bulk-note{font-size:12px;line-height:1.5;color:var(--muted,#77808d);margin:10px 0 0}
        .icard-preview-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:14px}
        .icard-template-error{padding:10px 12px;background:#fff1f0;border-radius:8px}
        @media(max-width:760px){.icard-template-workspace{overflow:auto}.icard-template-layout{grid-template-columns:1fr;overflow:visible}.icard-template-sidebar{max-height:260px}.icard-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.icard-preview-stage{min-height:300px}.icard-preview-stage canvas{max-height:48vh}}
      `}</style>
    </div>
  );
}
