"use client";

export default function StudentProfileStyles() {
  return (
          <style jsx global>{`
            .cfk-template-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,20,35,.68);backdrop-filter:blur(6px)}
            .cfk-template-dialog{width:min(100%,620px);padding:24px;border:1px solid var(--border-color,#e3e8ef);border-radius:18px;background:var(--panel-bg,#fff);color:var(--text-primary,#172033);box-shadow:0 24px 80px rgba(0,0,0,.3)}
            .cfk-template-heading{display:flex;align-items:center;gap:13px;margin-bottom:20px;position:relative;padding-right:30px}
            .cfk-template-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:rgba(37,99,235,.1);color:#2563eb}
            .cfk-template-heading h2{margin:0;font-size:19px;font-weight:750}.cfk-template-heading p{margin:5px 0 0;font-size:13px;opacity:.7}
            .cfk-template-close{position:absolute;right:0;top:0;border:0;background:transparent;color:inherit;cursor:pointer}
            .cfk-template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;max-height:min(68vh,650px);overflow:auto;padding:2px 4px 4px 2px}
            .cfk-template-option{min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:10px;padding:12px;border:1px solid var(--border-color,#dce3ee);border-radius:14px;background:rgba(127,127,127,.035);color:inherit;text-align:left;cursor:pointer;transition:border-color .18s,box-shadow .18s}
            .cfk-template-option:hover{border-color:#5677d8;box-shadow:0 8px 22px rgba(49,87,213,.12)}
            .cfk-template-option img{width:100%;height:230px;object-fit:contain;background:#f4f5f8;border-radius:8px}
            .cfk-template-option-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
            .cfk-template-option-copy strong{font-size:13px}.cfk-template-option-copy small{font-size:10px;opacity:.65;overflow-wrap:anywhere}
            .cfk-template-select{padding:9px 13px;border-radius:9px;background:#3157d5;color:white;font-size:12px;font-weight:700;text-align:center;white-space:nowrap}
            @media(max-width:560px){.cfk-template-dialog{padding:16px}.cfk-template-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.cfk-template-option{padding:8px}.cfk-template-option img{height:155px}.cfk-template-select{font-size:10px}}
      /* Student profile workspace refinement */
      .student-profile-page{width:100%;max-width:1320px;margin:22px auto 40px;gap:18px}
      .student-profile-page>.detail-section{overflow:hidden;transition:border-color .18s ease,box-shadow .18s ease}
      .student-profile-page>.detail-section:hover{border-color:#cbd7e8!important;box-shadow:0 8px 24px rgba(25,42,75,.065)!important}
      .student-profile-page .detail-section-title{min-height:58px;padding:15px 20px;gap:11px;background:linear-gradient(180deg,#fff,#fbfcff)}
      .student-profile-page .detail-section-title>svg{width:32px;height:32px;padding:8px;border-radius:9px;flex:none;background:#eaf2fb;color:#245b91}
      .student-profile-page .detail-section-title h3{font-size:14px;font-weight:750;letter-spacing:-.015em;color:#1d2b45}
      .student-profile-page .student-summary-grid{gap:13px}
      .student-profile-page .summary-card{min-width:0;border-radius:12px;padding:17px;gap:7px;box-shadow:0 3px 12px rgba(25,42,75,.035);transition:transform .18s ease,box-shadow .18s ease}
      .student-profile-page .summary-card:hover{transform:translateY(-2px);box-shadow:0 9px 20px rgba(25,42,75,.08)}
      .student-profile-page .summary-card strong{overflow-wrap:anywhere;letter-spacing:-.025em}
      .student-profile-page .student-detail-grid{padding:14px;gap:9px;grid-template-columns:repeat(4,minmax(0,1fr))}
      .student-profile-page .student-detail-field{min-width:0;padding:13px 14px;border:1px solid #e8edf4!important;border-left:3px solid #9bb2d1!important;border-radius:9px!important;background:#fbfcfe!important}
      .student-profile-page .student-detail-field span{font-size:9px;font-weight:750;letter-spacing:.075em;color:#8491a5}
      .student-profile-page .student-detail-field strong{font-size:12px;overflow-wrap:anywhere;color:#26364f}
      .student-profile-page .student-address{margin:0 14px 14px;padding:15px;border:1px solid #e8edf4;background:#f8faff;align-items:flex-start}
      .student-profile-page .student-address>svg{flex:none;margin-top:2px;color:#4568c9}
      .student-profile-page .student-address small{display:block;margin-top:4px;color:#718096;font-size:11px;line-height:1.6}
      .student-profile-page .operational-placeholder{border:1px dashed #d5deeb;background:#f8faff}
      .student-profile-page .inline-operation-form{background:#f8faff}
      .student-profile-page .table-wrap table{min-width:650px}
      .student-profile-page .table-wrap tbody tr:last-child td{border-bottom:0}
      .student-profile-page .student-fee-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:16px 18px 8px}
      .student-profile-page .fee-overview-card{min-width:0;border:1px solid #e7ecf4;border-radius:11px;padding:15px;background:#fbfcff}
      .student-profile-page .fee-overview-card span{font-size:11px;color:#718096}
      .student-profile-page .fee-overview-card strong{display:block;margin:6px 0;font-size:22px;letter-spacing:-.03em;overflow-wrap:anywhere}
      .student-profile-page .fee-overview-card small{font-size:10px;color:#8994a6;line-height:1.45}
      .student-profile-page .fee-overview-card.fee-paid strong{color:#16834e}
      .student-profile-page .fee-overview-card.fee-due strong{color:#c05b28}
      .student-profile-page .fee-workspace-launch{margin:12px 18px 18px;width:calc(100% - 36px);border:1px solid #dfe6f1;border-radius:12px;background:linear-gradient(110deg,#f7f9ff,#fff);transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease}
      .student-profile-page .fee-workspace-launch:hover{transform:translateY(-1px);border-color:#b9c8ee;box-shadow:0 8px 18px rgba(49,87,213,.08)}
      .student-profile-feedback{margin:0!important}
      .student-profile-loading,.student-profile-error{max-width:1320px;margin:22px auto}
      .student-profile-page button:focus-visible,.student-profile-page a:focus-visible{outline:3px solid rgba(49,87,213,.28);outline-offset:2px}
      @media(max-width:1050px){.student-profile-page .student-detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){
        .student-profile-page{margin:14px auto 28px;gap:13px}
        .student-profile-page .student-detail-grid{padding:10px;gap:7px}
        .student-profile-page .student-detail-field{padding:11px}
        .student-profile-page .student-summary-grid{gap:8px}
        .student-profile-page .summary-card{padding:13px}
        .student-profile-page .student-fee-overview{grid-template-columns:1fr;padding:12px}
        .student-profile-page .fee-workspace-launch{margin:8px 12px 14px;width:calc(100% - 24px)}
        .student-profile-page .student-address{margin:0 10px 10px}
      }
      @media(max-width:430px){.student-profile-page .student-detail-grid{grid-template-columns:1fr}.student-profile-page .student-summary-grid{grid-template-columns:1fr 1fr}}
      @media(prefers-reduced-motion:reduce){.student-profile-page *{transition:none!important}}

          `}</style>
  );
}
