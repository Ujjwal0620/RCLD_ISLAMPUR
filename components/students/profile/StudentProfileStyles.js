export default function StudentProfileStyles() {
  return (
          <style jsx global>{`
            .cfk-dialog-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,20,35,.62);backdrop-filter:blur(5px)}
            .cfk-dialog{width:min(100%,460px);background:var(--panel-bg,#fff);color:var(--text-primary,#172033);border:1px solid var(--border-color,#e3e8ef);border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
            .cfk-dialog-heading{display:flex;align-items:center;gap:13px;position:relative;padding-right:25px}
            .cfk-dialog-icon{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:rgba(37,99,235,.1);color:#2563eb;flex:none}
            .cfk-dialog-heading h2{margin:0;font-size:19px;font-weight:750}.cfk-dialog-heading p{margin:5px 0 0;font-size:13px;opacity:.72}
            .cfk-dialog-close{position:absolute;right:-8px;top:-8px;border:0;background:transparent;font-size:27px;line-height:1;cursor:pointer;color:inherit}
            .cfk-dialog-student{display:flex;justify-content:space-between;gap:12px;margin:22px 0 18px;padding:12px 14px;border:1px solid var(--border-color,#e3e8ef);border-radius:11px;background:rgba(127,127,127,.045);font-size:13px}
            .cfk-dialog-student span{opacity:.7;text-align:right}.cfk-dialog-current-semester{display:flex;flex-direction:column;gap:5px;padding:14px 16px;border:1px solid var(--border-color,#d7deea);border-radius:12px;background:var(--panel-bg,#f8f9fc)}.cfk-dialog-current-semester>span{font-size:12px;opacity:.7}.cfk-dialog-current-semester strong{font-size:22px}.cfk-dialog-current-semester small{font-size:12px;opacity:.75}
            .cfk-dialog-note{margin-top:12px;font-size:12px;line-height:1.5;opacity:.7}
            .cfk-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}
            @media(max-width:520px){.cfk-dialog{padding:19px}.cfk-dialog-student{flex-direction:column;gap:4px}.cfk-dialog-student span{text-align:left}}
          `}</style>
  );
}
