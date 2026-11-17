export function getStudentIcardStyles(cardHeight = "88mm") {
  return `
    @page { size: 55mm ${cardHeight}; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 55mm;
      height: ${cardHeight};
      background: #fff;
      font-family: Arial, Helvetica, sans-serif;
    }
    .photo-img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }
    .photo-ph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: #999;
      font-size: 2mm;
      background: #f3f4f6;
    }
    .ic { display:inline-block;width:1.6mm;height:1.6mm;vertical-align:middle;margin-right:.35mm;flex:none; }
    .ic-circle { display:inline-block;width:1.7mm;height:1.7mm;vertical-align:middle;margin-right:.35mm;flex:none; }
    .std-ic { display:inline-block;width:2mm;height:2mm;vertical-align:middle;margin:0 .3mm;flex:none; }
    .scribble { display:block;width:9.2mm;height:3.6mm;margin:0 auto; }
    .one-line { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }

    /* ================ CODING FOR KIDS: 55mm x 85mm ================ */
    .icard-page.cfk-card {
      position: relative;
      width: 55mm;
      height: 85mm;
      overflow: hidden;
      background: #fff;
      user-select: none;
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
    }
    .cfk-bg-svg {
      position: absolute;
      inset: 0;
      width: 55mm;
      height: 85mm;
      z-index: 1;
      pointer-events: none;
    }
    .cfk-header {
      position: relative;
      z-index: 3;
      padding-top: 1.8mm;
      text-align: center;
      color: #fff;
    }
    .cfk-brand-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.4mm;
      line-height: 1;
    }
    .cfk-logo {
      width: 5.8mm;
      height: 5.8mm;
      object-fit: contain;
      border-radius: .6mm;
      background: #fff;
      padding: .2mm;
    }
    .cfk-title {
      font-family: "Arial Black", Impact, sans-serif;
      font-size: 7.1mm;
      font-weight: 900;
      letter-spacing: .45mm;
      color: #fff;
      line-height: .9;
    }
    .cfk-subtitle {
      margin-top: .7mm;
      font-size: 1.72mm;
      font-weight: 700;
      letter-spacing: .14mm;
      color: #fff;
    }
    .cfk-encouraged {
      margin-top: .5mm;
      font-size: 1.42mm;
      font-weight: 400;
      color: #f0f0f0;
    }
    .cfk-govt {
      margin-top: .35mm;
      font-size: 1.85mm;
      font-weight: 700;
      color: #fff;
    }
    .cfk-photo-wrap {
      position: absolute;
      top: 15.8mm;
      left: 50%;
      transform: translateX(-50%);
      width: 25.8mm;
      height: 25.8mm;
      border-radius: 50%;
      background: #fff;
      padding: .5mm;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cfk-photo-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cfk-photo-inner .photo-img { width:100%;height:100%;object-fit:cover;object-position:center top; }
    .cfk-photo-inner .photo-ph { font-size:2.5mm;font-weight:700;color:#888; }
    .cfk-name-block {
      position: absolute;
      top: 41.8mm;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 4;
      padding: 0 1.5mm;
    }
    .cfk-student-name {
      font-size: 3.75mm;
      font-weight: 800;
      letter-spacing: .05mm;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cfk-fname { color: #464E56; }
    .cfk-lname { color: var(--theme-color); }
    .cfk-course-name {
      margin-top: 1.1mm;
      font-size: 1.95mm;
      font-weight: 600;
      letter-spacing: .12mm;
      color: #464E56;
      text-transform: uppercase;
    }
    .cfk-details {
      position: absolute;
      top: 52.0mm;
      left: 6.2mm;
      right: 2mm;
      z-index: 4;
      font-size: 1.75mm;
      line-height: 1.2;
    }
    .cfk-row { display:flex;align-items:baseline;margin-bottom:.25mm; }
    .cfk-lbl {
      width: 18mm;
      flex-shrink: 0;
      text-align: right;
      padding-right: .8mm;
      font-weight: 700;
      color: var(--label-color);
    }
    .cfk-val { flex:1;font-weight:700;color:#3B4248;word-break:break-word;min-width:0; }
    .cfk-id-val { font-size:1.95mm;font-weight:700; }
    .cfk-id-num { font-size:2.2mm;font-weight:800; }
    .cfk-addr-row { align-items:flex-start; }
    .cfk-addr-lines { font-size:1.65mm; }
    .cfk-addr-lines div { line-height:1.16; }
    .cfk-sem-badge {
      position: absolute;
      left: -1.8mm;
      top: 63.5mm;
      width: 10.8mm;
      height: 9.4mm;
      background: var(--theme-color);
      border-radius: 50%;
      transform: rotate(-22deg);
      box-shadow: .35mm .45mm 0 #262A2E;
      z-index: 5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-left: 1.1mm;
      color: #fff;
    }
    .cfk-sem-word {
      transform: rotate(22deg);
      font-family: Georgia, "Times New Roman", serif;
      font-size: 2.0mm;
      font-weight: 900;
      letter-spacing: .1mm;
      line-height: 1;
    }
    .cfk-sem-num {
      transform: rotate(22deg);
      font-size: 3.4mm;
      font-weight: 900;
      line-height: 1;
      margin-top: .3mm;
    }
    .cfk-sign-block {
      position: absolute;
      right: 3.2mm;
      top: 69.2mm;
      text-align: center;
      z-index: 5;
    }
    .cfk-sign-svg { height:2.8mm;display:flex;align-items:center;justify-content:center; }
    .cfk-sign-svg svg { height:2.8mm;width:auto; }
    .cfk-sign-text { font-size:1.55mm;font-style:italic;color:#464E56;margin-top:.15mm; }
    .cfk-contact-block {
      position: absolute;
      bottom: 6.2mm;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 5;
      padding: 0 2mm;
    }
    .cfk-aec-line {
      font-size: 1.78mm;
      font-weight: 700;
      color: #363C42;
      letter-spacing: .02mm;
      white-space: nowrap;
    }
    .cfk-contact-line {
      margin-top: .35mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.4mm;
      font-size: 1.65mm;
      font-weight: 700;
      color: #363C42;
    }
    .cfk-c-item { display:inline-flex;align-items:center;gap:.7mm; }
    .cfk-c-icon { color:#D32F2F;display:inline-flex;align-items:center;font-size:1.8mm; }
    .cfk-c-icon svg { width:1.8mm;height:1.8mm;fill:#D32F2F; }
    .cfk-footer-banner {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }
    .cfk-footer-title {
      color: #fff;
      font-size: 2.85mm;
      font-weight: 900;
      letter-spacing: .25mm;
      line-height: 1;
      display: inline-block;
      transform: scaleY(1.24);
      transform-origin: center;
    }

    /* ===================== STANDARD (OTHER COURSES - 55mm x 88mm) ===================== */
                .std{font-family:"Times New Roman",Times,Georgia,serif;color:#111;z-index:2}
        
                .std-id{left:1.8mm;top:3.8mm;width:18.5mm;text-align:center;z-index:3}
                .std-id .l{font-size:2.15mm;line-height:1.15;font-weight:700;color:#111}
                .std-id .p{font-size:2.05mm;line-height:1.2;font-weight:700;color:#111;word-break:break-all}
                .std-id .n{font-size:3.1mm;line-height:1.15;font-weight:800;color:#111;margin-top:.1mm}
        
                .std-logo{left:21.25mm;top:1.5mm;width:12.5mm;height:14.2mm;object-fit:contain;z-index:3}
        
                .std-session{right:1.8mm;top:3.8mm;width:18.5mm;text-align:center;z-index:3}
                .std-session .l{font-size:2.25mm;line-height:1.15;font-weight:700;color:#1B1F6B}
                .std-session .v{font-size:2.85mm;line-height:1.2;font-weight:800;color:#D32F2F;margin-top:.15mm}
        
                .std-rcld{left:0;right:0;top:15.5mm;text-align:center;font-family:"Arial Black",Impact,Arial,sans-serif;font-weight:900;font-size:8.6mm;line-height:1;letter-spacing:.35mm;color:#E31E24;transform:scaleX(1.06);z-index:3}
                .std-title{left:1mm;right:1mm;top:24.2mm;text-align:center;font-size:2.85mm;line-height:1.1;font-weight:700;color:#1B1F6B;white-space:nowrap;overflow:hidden;z-index:3}
                .std-mission{left:1mm;right:1mm;top:27.3mm;text-align:center;font-size:1.68mm;line-height:1.15;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;z-index:3}
        
                .std-photo{left:17.5mm;top:29.8mm;width:20.0mm;height:23.8mm;border:.55mm solid #1B1F6B;border-radius:1.6mm;overflow:hidden;background:#FFFFFF;z-index:3}
        
                .std-details{left:1.8mm;right:1.5mm;top:54.8mm;z-index:3;overflow:hidden}
                .std-details .r{display:grid;grid-template-columns:14.8mm minmax(0,1fr);column-gap:.8mm;align-items:baseline;margin-bottom:.55mm;line-height:2.45mm}
                .std-details b{font-size:2.05mm;font-weight:700;color:#1B1F6B;white-space:nowrap}
                .std-details span{font-size:1.8mm;font-weight:700;color:#111;min-width:0}
                .std-details .nm{font-weight:800;letter-spacing:.02mm}
                .std-details .ad{font-size:1.88mm;font-weight:700;line-height:2.35mm;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
                .std-details .crs{font-size:2.05mm;font-weight:700;line-height:2.3mm;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        
                .std-sign{right:1.8mm;top:70.2mm;width:13.5mm;text-align:center;z-index:3}
                .std-sign small{display:block;font-family:Arial,sans-serif;font-size:1.55mm;font-weight:700;color:#111;line-height:1.15;margin-top:.1mm;white-space:nowrap}
        
                .std-foot{left:0;right:0;top:75.5mm;height:7.3mm;border-top:.3mm solid #1B1F6B;padding:.45mm 1mm 0;text-align:center;font-family:"Times New Roman",Times,serif;font-weight:700;color:#111;z-index:3;overflow:hidden}
                .std-foot .f-line1{font-size:1.82mm;line-height:2.15mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .std-foot .f-line2{font-size:1.85mm;line-height:2.25mm;display:flex;justify-content:center;align-items:center;white-space:nowrap}
                .std-foot .f-line3{font-size:1.85mm;line-height:2.25mm;display:flex;justify-content:center;align-items:center;white-space:nowrap}
                .std-foot .sp{display:inline-block;width:1.4mm}
        
                .std-band{left:0;right:0;bottom:0;height:5.2mm;background:#1B2A78;color:#FFFFFF;font-family:"Times New Roman",Georgia,serif;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:3.8mm;letter-spacing:.25mm;z-index:3}
        
                

    @media screen {
      html, body { width:auto;height:auto;background:#e5e9f0; }
      body { display:flex;justify-content:center;padding:8mm 0;overflow:auto; }
      .card, .icard-page.cfk-card { flex:none;box-shadow:0 1px 10px rgba(0,0,0,.3); }
    }
    @media print {
      html, body { width:55mm;height:${cardHeight};margin:0!important;padding:0!important;overflow:hidden; }
      body { display:block; }
      .card, .icard-page.cfk-card { box-shadow:none; }
    }
  `;
}
