"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FolderOpen, ImagePlus, LoaderCircle, Upload, X } from "lucide-react";

const allowed = /\.(?:jpe?g|png|webp)$/i;

export default function BulkStudentPhotoUploadDialog({ open, onClose, onComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const selectedCount = useMemo(() => files.length, [files]);

  if (!open) return null;

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(file => allowed.test(file.name));
    setFiles(current => {
      const combined = [...current, ...incoming];
      const unique = new Map(combined.map(file => [(file.webkitRelativePath || file.name) + "|" + file.size + "|" + file.lastModified, file]));
      return [...unique.values()];
    });
    setSummary(null);
  }

  async function uploadAll() {
    if (!files.length || uploading) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    const result = { mapped: 0, matchedAndUpdated: 0, unmatchedFilenames: [], failedFiles: [], updated: [] };
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const form = new FormData();
        form.append("files", file, file.name);
        try {
          const response = await fetch("/api/students/bulk-photos", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Upload failed.");
          result.mapped += Number(data.mapped ?? data.matchedAndUpdated ?? 0);\n          result.matchedAndUpdated = result.mapped;
          result.unmatchedFilenames.push(...(data.unmatchedFilenames || []));
          result.failedFiles.push(...(data.failedFiles || []));
          result.updated.push(...(data.updated || []));
        } catch (error) {
          result.failedFiles.push({ filename: file.name, reason: error.message || "Upload failed." });
        }
        setProgress({ done: index + 1, total: files.length });
      }
      setSummary(result);
      setFiles([]);
      onComplete?.();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bulk-photo-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !uploading) onClose();
    }}>
      <section className="bulk-photo-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-photo-title">
        <header>
          <div className="bulk-photo-title-icon"><ImagePlus size={20}/></div>
          <div><h2 id="bulk-photo-title">Bulk Upload Student Photos</h2><p>Match each image to a student using the registration number in its filename.</p></div>
          <button type="button" aria-label="Close" disabled={uploading} onClick={onClose}><X size={19}/></button>
        </header>

        {!summary ? <>
          <div className="bulk-photo-pickers">
            <label className="bulk-photo-picker">
              <Upload size={21}/>
              <strong>Select multiple photos</strong>
              <span>JPG, JPEG, PNG or WebP</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={event => { addFiles(event.target.files); event.target.value = ""; }}/>
            </label>
            <label className="bulk-photo-picker">
              <FolderOpen size={21}/>
              <strong>Select a photo folder</strong>
              <span>Choose your local “id card coding images” folder</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple webkitdirectory="" directory="" disabled={uploading} onChange={event => { addFiles(event.target.files); event.target.value = ""; }}/>
            </label>
          </div>
          <div className="bulk-photo-guidance">
            <strong>Supported filename examples</strong>
            <span>21693.jpg</span><span>SOUPTIK DUTTA_21693.jpg</span><span>IMG_21693.png</span>
            <small>The final 4-or-more digit number in the filename is matched against Regn_No. Photos are stored in Cloudinary and linked to the student record.</small>
          </div>
          {files.length > 0 && <div className="bulk-photo-file-list">
            <div><strong>{selectedCount} image{selectedCount === 1 ? "" : "s"} selected</strong><button type="button" onClick={() => setFiles([])} disabled={uploading}>Clear</button></div>
            <ul>{files.slice(0, 8).map((file, index) => <li key={file.name + file.lastModified + index}>{file.webkitRelativePath || file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></li>)}</ul>
            {files.length > 8 && <small>And {files.length - 8} more files…</small>}
          </div>}
          {uploading && <div className="bulk-photo-progress"><LoaderCircle size={16}/> Uploading {progress.done} of {progress.total}…</div>}
          <footer><button type="button" className="ghost-btn" onClick={onClose} disabled={uploading}>Cancel</button><button type="button" className="primary-btn" onClick={uploadAll} disabled={!files.length || uploading}>{uploading ? "Uploading…" : `Upload ${files.length} photo${files.length === 1 ? "" : "s"}`}</button></footer>
        </> : <>
          <div className="bulk-photo-summary">
            <CheckCircle2 size={24}/>
            <strong>Photo upload completed</strong>
            <div><span>Mapped to student records</span><b>{summary.mapped ?? summary.matchedAndUpdated}</b></div>
            <div><span>Unmatched filenames</span><b>{summary.unmatchedFilenames.length}</b></div>
            <div><span>Failed files</span><b>{summary.failedFiles.length}</b></div>
          </div>
          {summary.unmatchedFilenames.length > 0 && <section className="bulk-photo-result-list"><h3>Unmatched filenames</h3><ul>{summary.unmatchedFilenames.map((name,index)=><li key={name+index}>{name}</li>)}</ul></section>}
          {summary.updated?.length > 0 && <section className="bulk-photo-result-list"><h3>Successfully mapped photos</h3><ul>{summary.updated.map((item,index)=><li key={item.regnNo+index}>{item.regnNo}{item.studentName ? " — "+item.studentName : ""} <small>({item.linkedStudentRecords || 0} student record(s))</small></li>)}</ul></section>}
          {summary.failedFiles.length > 0 && <section className="bulk-photo-result-list"><h3>Failed files</h3><ul>{summary.failedFiles.map((item,index)=><li key={item.filename+index}>{item.filename} — {item.reason}</li>)}</ul></section>}
          <footer><button type="button" className="ghost-btn" onClick={() => { setSummary(null); setFiles([]); }}>Upload more</button><button type="button" className="primary-btn" onClick={onClose}>Done</button></footer>
        </>}
      </section>
      <style jsx>{`
        .bulk-photo-backdrop{position:fixed;inset:0;z-index:1200;background:#10182899;display:grid;place-items:center;padding:16px}
        .bulk-photo-dialog{width:min(700px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--surface,#fff);color:var(--text,#222);border:1px solid var(--border,#e1e5eb);border-radius:16px;padding:22px;box-shadow:0 24px 80px #0003}
        header{display:flex;align-items:center;gap:12px;margin-bottom:20px}header h2{font-size:19px;margin:0 0 4px}header p{font-size:12px;color:var(--muted,#748094);margin:0}header>button{margin-left:auto;border:0;background:transparent;padding:7px;cursor:pointer;color:inherit}
        .bulk-photo-title-icon{width:40px;height:40px;border-radius:12px;background:#eaf0ff;color:#315efb;display:grid;place-items:center;flex-shrink:0}
        .bulk-photo-pickers{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .bulk-photo-picker{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:150px;border:1px dashed var(--border,#ccd4df);border-radius:12px;background:var(--surface-subtle,#f8fafc);cursor:pointer;text-align:center;padding:18px}
        .bulk-photo-picker svg{color:var(--primary,#315efb)}.bulk-photo-picker strong{font-size:13px}.bulk-photo-picker span{font-size:11px;color:var(--muted,#77808d)}.bulk-photo-picker input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
        .bulk-photo-guidance{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:16px 0;padding:12px;border-radius:10px;background:var(--surface-subtle,#f6f8fb);font-size:11px}.bulk-photo-guidance strong{width:100%;font-size:12px}.bulk-photo-guidance span{padding:4px 7px;border-radius:6px;background:var(--surface,#fff);font-family:monospace}.bulk-photo-guidance small{width:100%;color:var(--muted,#77808d);line-height:1.5}
        .bulk-photo-file-list{border:1px solid var(--border,#e1e5eb);border-radius:10px;padding:12px}.bulk-photo-file-list>div{display:flex;justify-content:space-between}.bulk-photo-file-list button{border:0;background:transparent;color:var(--primary,#315efb);cursor:pointer}.bulk-photo-file-list ul,.bulk-photo-result-list ul{list-style:none;padding:0;margin:10px 0 0;max-height:150px;overflow:auto}.bulk-photo-file-list li,.bulk-photo-result-list li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid var(--border,#edf0f4);font-size:11px;overflow-wrap:anywhere}.bulk-photo-file-list li small{flex-shrink:0;color:var(--muted,#77808d)}
        .bulk-photo-progress{display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--muted,#77808d);font-size:12px}.bulk-photo-summary{display:grid;grid-template-columns:1fr;gap:9px;padding:18px;border-radius:12px;background:var(--surface-subtle,#f7f9fc);text-align:center}.bulk-photo-summary>svg{margin:auto;color:#16a36a}.bulk-photo-summary>strong{font-size:16px}.bulk-photo-summary>div{display:flex;justify-content:space-between;border-top:1px solid var(--border,#e4e8ee);padding-top:8px;font-size:13px}.bulk-photo-result-list{margin-top:14px}.bulk-photo-result-list h3{font-size:13px;margin:0}.bulk-photo-result-list li{display:block}
        footer{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
        @media(max-width:540px){.bulk-photo-pickers{grid-template-columns:1fr}.bulk-photo-dialog{padding:16px}}
      `}</style>
    </div>
  );
}
