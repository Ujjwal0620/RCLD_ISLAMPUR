export function getStudentIcardStyles(cardHeight) {
  return `
                /* Exact Card Dimensions: 5.5 cm wide x 8.8 cm tall (55mm x 88mm) */
                @page{size:55mm ${cardHeight};margin:0}
                *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
                html,body{width:55mm;height:${cardHeight};background:#fff;font-family:Arial,Helvetica,sans-serif}
                body{overflow:hidden}
                .card{position:relative;width:55mm;height:${cardHeight};overflow:hidden;background:#fff;break-after:avoid;page-break-after:avoid;break-inside:avoid}
                .card>*{position:absolute}
                .card .bg{left:0;top:0;width:55mm;height:${cardHeight};z-index:1}
                .photo-img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}
                .photo-ph{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#999;font-size:2mm;background:#fff}
                .ic{display:inline-block;width:1.6mm;height:1.6mm;vertical-align:middle;margin-right:.35mm;flex:none}
                .ic-circle{display:inline-block;width:1.7mm;height:1.7mm;vertical-align:middle;margin-right:.35mm;flex:none}
                .std-ic{display:inline-block;width:2.0mm;height:2.0mm;vertical-align:middle;margin:0 .3mm;flex:none}
                .scribble{display:block;width:9.2mm;height:3.6mm;margin:0 auto}
                .one-line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        
                /* ===================== CODING FOR KIDS (55mm x 88mm) ===================== */
                .cfk-header{top:2.0mm;left:1mm;right:1mm;text-align:center;color:#FFFFFF;z-index:2;overflow:hidden}
                .cfk-brand-row{display:flex;justify-content:center;align-items:center;gap:1.1mm}
                .cfk-logo{width:5.0mm;height:6.2mm;object-fit:contain;background:transparent;flex:none}
                .cfk-rcld{font-family:"Arial Black",Impact,Arial,sans-serif;font-weight:900;font-size:6.8mm;line-height:.88;letter-spacing:.3mm;color:#FFFFFF}
                .cfk-sub1{font-size:1.85mm;font-weight:700;letter-spacing:.06mm;margin-top:.5mm;line-height:1.15;white-space:nowrap}
                .cfk-sub2{font-size:1.55mm;font-weight:400;color:#E8ECEF;margin-top:.2mm;line-height:1.15;white-space:nowrap}
                .cfk-sub3{font-size:1.95mm;font-weight:700;margin-top:.15mm;line-height:1.15;white-space:nowrap}
        
                .cfk-photo{left:14.7mm;top:16.0mm;width:25.6mm;height:25.6mm;border-radius:50%;border:.65mm solid #FFFFFF;overflow:hidden;background:#FFFFFF;z-index:3}
        
                .cfk-name{left:1.5mm;right:1.5mm;top:42.5mm;text-align:center;font-weight:800;line-height:1.1;text-transform:uppercase;letter-spacing:-.05mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:3}
                .cfk-name .fname{color:var(--charcoal)}
                .cfk-name .lname{color:var(--sem)}
        
                .cfk-course{left:1.5mm;right:1.5mm;top:48.2mm;text-align:center;font-size:2.65mm;line-height:1;font-weight:800;letter-spacing:.06mm;color:var(--charcoal);text-transform:uppercase;white-space:nowrap;overflow:hidden;z-index:3}
        
                .cfk-info{left:1.2mm;right:1.5mm;top:52.8mm;font-size:2.15mm;line-height:3.05mm;z-index:3;overflow:hidden}
                .cfk-info .r{display:grid;grid-template-columns:22.2mm minmax(0,1fr);column-gap:1.2mm;align-items:baseline}
                .cfk-info b{text-align:right;white-space:nowrap;font-weight:700;color:var(--lbl);letter-spacing:-.03mm}
                .cfk-info span{font-weight:700;color:var(--charcoal);min-width:0;letter-spacing:-.03mm}
                .cfk-info .addr-lines{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:2.85mm;word-break:break-word}
                .cfk-info em{font-style:normal;font-size:2.7mm;font-weight:800;color:var(--charcoal);margin-left:.1mm}
        
                .cfk-badge{left:0;top:66.6mm;width:9.2mm;height:9.6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#FFFFFF;z-index:3}
                .cfk-badge .sem-label{font-family:"Times New Roman",Georgia,serif;font-size:2.45mm;font-weight:700;line-height:1}
                .cfk-badge .sem-num{font-family:"Arial Black",Impact,sans-serif;font-size:4.3mm;font-weight:900;line-height:1.05;margin-top:.15mm}
                .cfk-badge .robo{font-size:2.2mm;line-height:2.4mm;font-weight:800;text-align:center}
        
                .cfk-sign{right:2.5mm;top:71.2mm;width:14mm;text-align:center;z-index:3}
                .cfk-sign small{display:block;font-size:1.65mm;font-style:italic;color:var(--charcoal);line-height:1.15;margin-top:.1mm;white-space:nowrap}
        
                .cfk-foot1{left:1mm;right:1mm;top:77.4mm;text-align:center;font-size:1.92mm;line-height:1.15;font-weight:700;color:var(--charcoal);letter-spacing:-.04mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:3}
                .cfk-foot2{left:1mm;right:1mm;top:79.8mm;display:flex;justify-content:center;align-items:center;font-size:1.85mm;line-height:1.15;font-weight:700;color:var(--charcoal);white-space:nowrap;overflow:hidden;z-index:3}
                .cfk-foot2 i{display:inline-block;width:1.2mm;flex:none}
                .cfk-foot2 .cfk-phone{font-size:1.95mm;font-weight:800}
        
                .cfk-band{left:0;right:0;bottom:0;height:4.6mm;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-family:"Arial Black",Arial,sans-serif;font-size:2.85mm;font-weight:900;letter-spacing:.18mm;z-index:3}
        
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
                .std-details span{font-size:2.1mm;font-weight:700;color:#111;min-width:0}
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
        
                @media screen{
                  html,body{width:auto;height:auto;background:#e5e9f0}
                  body{display:flex;justify-content:center;padding:8mm 0;overflow:auto}
                  .card{flex:none;box-shadow:0 1px 10px rgba(0,0,0,.3)}
                }
                @media print{
                  html,body{width:55mm;height:${cardHeight};margin:0!important;padding:0!important;overflow:hidden}
                  body{display:block}
                  .card{box-shadow:none}
                }
    
  `;
}
