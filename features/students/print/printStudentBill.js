"use client";

export function printStudentBill(student, fee, courses, selectedPayment = null) {
        if (!student || !fee) return;
        const esc = (v) =>
          String(v ?? "").replace(
            /[&<>"']/g,
            (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
          );
        const num = (v) => Number(v || 0);
        const money = (v) => "₹" + num(v).toLocaleString("en-IN");
        const payments = (fee.payments || [])
          .slice()
          .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
        const payment = selectedPayment || payments[payments.length - 1] || null;
        const courseFee = num(fee.courseFeeTotal ?? fee.totalFee);
        const discount = num(fee.discount);
        const payable = Math.max(0, num(fee.payable ?? courseFee - discount));
        const paid = num(fee.paid ?? payments.reduce((sum, p) => sum + (p.items?.length
          ? p.items.filter((item) => ["course fee", "admission fee", "installment", "tuition fee"].includes(String(item.purpose || item.type || "").toLowerCase())).reduce((total, item) => total + num(item.amount), 0)
          : num(p.amount)), 0));
        const due = Math.max(0, num(fee.due ?? payable - paid));
        const formatMonth = (value) => {
          if (!value) return "—";
          const match = String(value).match(/^(\d{4})-(\d{2})$/);
          if (!match) return String(value);
          return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        };
        const formatDate = (v) =>
          v ? new Date(String(v).slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB") : "—";
        const course = courses.find(
          (x) => String(x.code || "").toUpperCase() === String(student.courseCode || "").toUpperCase(),
        );
        const duration = student.courseDuration || course?.duration || course?.durationText || "";
        const dateKey = String(payment?.date || new Date().toISOString().slice(0, 10)).replace(
          /\D/g,
          "",
        );
        const idKey = String(payment?._id || student.enrollmentNo || student._id || "")
          .replace(/[^a-z0-9]/gi, "")
          .slice(-6)
          .toUpperCase();
        const receiptNo = payment?.receiptNo || `RCLD/${dateKey}/${idKey || "PENDING"}`;
        const noteItems = String(payment?.note || "").match(/Fee sections: (.*)$/)?.[1];
        const parsedNoteItems = noteItems
          ? noteItems
              .split(/;\s*/)
              .map((part) => {
                const match = part.match(/^(.*?):\s*₹([\d,.]+)(?:\s*\((.*?)\))?$/);
                return match
                  ? {
                      purpose: match[1],
                      amount: Number(match[2].replace(/,/g, "")),
                      installmentMonth: match[3] || "",
                    }
                  : null;
              })
              .filter(Boolean)
          : [];
        const items =
          Array.isArray(payment?.items) && payment.items.length
            ? payment.items
            : parsedNoteItems.length
              ? parsedNoteItems
              : [
                  {
                    purpose: payment?.paymentType || "Payment",
                    amount: payment?.amount,
                    installmentMonth: payment?.installmentMonth || "",
                  },
                ];
        const itemRows = items
          .map(
            (item) =>
              `<tr><td>${esc(item.purpose || item.type || "")}</td><td>${esc(formatMonth(item.installmentMonth))}</td><td class="right">${esc(money(item.amount))}</td></tr>`,
          )
          .join("");
        const type = String(
          payment?.paymentType || (items.length > 1 ? "Multiple Sections" : items[0]?.purpose) || "Payment",
        );
        const reference = payment?.utrNumber || payment?.reference || "—";
        const logoUrl = window.location.origin + "/assets/logo.png";
        const w = window.open("", "_blank");
        if (!w) {
          setMessage("Please allow pop-ups to print the fee receipt.");
          return;
        }
        const studentFields = [
          ["Student Name", student.applicantName],
          ["Father's / Guardian's Name", student.fatherName || student.guardianName],
          ["Enrolment No.", student.enrollmentNo || student.regnNo],
          ["Course Name", student.courseName || student.courseCode],
          ["Course Code", student.courseCode],
          ["Mobile No.", student.mobile || student.mobileNumber || student.phone],
          ["Address", student.address || student.presentAddress],
        ];
        const fieldHtml = studentFields
          .map(([label, value]) => `<div class="field"><b>${esc(label)}</b><span>${esc(value || "")}</span></div>`)
          .join("");
        const feeRows = [
          ["Course Fee Total (after discount)", payable],
          ["Total Course Fee Paid Till Date", paid],
          ["Course Fee Amount Due", due],
        ];
        const feeHtml = feeRows
          .map(
            ([label, value], i) =>
              `<div class="fee-row ${i === feeRows.length - 1 ? "grand" : ""}"><span>${esc(label)}</span><strong>${esc(money(value))}</strong></div>`,
          )
          .join("");
        const css = `
          @page{size:A5 landscape;margin:3.5mm}
          *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#17345e;font-family:Arial,Helvetica,sans-serif}
          body{font-size:7pt;line-height:1.12;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .receipt{width:203mm;height:140mm;margin:auto;padding:2.2mm;border:1px solid #173b78;display:flex;flex-direction:column;gap:1.4mm;overflow:hidden}
          .header{display:grid;grid-template-columns:17mm 1fr 39mm;align-items:center;border-bottom:1.4px solid #173b78;padding-bottom:1.2mm}.logo{width:15mm;height:13mm;object-fit:contain}.heading{text-align:center}.heading h1{font-size:13pt;margin:0;font-weight:900;letter-spacing:.02em}.heading h2{font-size:8pt;letter-spacing:.12em;margin:1mm 0 0}.receipt-meta{text-align:right;font-size:6.5pt;line-height:1.5}
          .org{display:flex;justify-content:space-between;background:#eaf2fc;border:1px solid #c6d8ed;padding:1mm 2mm;font-weight:700;font-size:6.5pt}
          .top-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:1.5mm}.panel{border:1px solid #9eb4d1;padding:1.3mm;min-width:0}.panel-title{font-weight:800;background:#173b78;color:#fff;margin:-1.3mm -1.3mm 1.2mm;padding:1mm 1.5mm;font-size:7pt;letter-spacing:.03em}
          .student-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1mm 2mm}.field{min-width:0;display:flex;flex-direction:column;gap:.3mm}.field b{font-size:5.8pt;color:#526987}.field span{min-height:3.8mm;border-bottom:.5px solid #b7c6d9;padding:.4mm 0;overflow-wrap:anywhere;white-space:normal}
          .fee-list{display:grid;grid-template-columns:1fr;column-gap:2mm}.fee-row{display:flex;justify-content:space-between;gap:1mm;padding:.7mm .5mm;border-bottom:.5px solid #e0e8f1;font-size:6.4pt}.fee-row strong{white-space:nowrap}.fee-row.grand{grid-column:1/-1;background:#eaf2fc;font-weight:900;border:0;margin-top:.5mm;padding:1mm}
          .payment-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1mm}.payment-field{border:.5px solid #d2deeb;padding:1mm;min-width:0;min-height:7mm}.payment-field b{display:block;font-size:5.7pt;color:#526987;margin-bottom:.5mm}.payment-field strong{font-size:6.7pt;overflow-wrap:anywhere}.payment-field.received{background:#eaf2fc;border-color:#9eb4d1}
          .items-table{width:100%;border-collapse:collapse;margin-top:1mm;font-size:6.3pt}.items-table th,.items-table td{border:.5px solid #cbd8e7;padding:.7mm 1mm;text-align:left}.items-table th{background:#f0f5fb}.right{text-align:right!important}.purpose-note{margin-top:.7mm;font-size:6pt}
          .terms{border:1px solid #9eb4d1;padding:1.2mm}.terms h3{margin:0 0 .7mm;font-size:6.8pt}.terms ol{margin:0;padding-left:4mm;display:grid;grid-template-columns:1fr 1fr;gap:.6mm 4mm;font-size:5.9pt}
          .bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:2mm;align-items:end;margin-top:auto}.bottom-note{font-size:5.8pt;line-height:1.3}.sign{text-align:center;padding-top:1mm;display:grid;grid-template-columns:1fr 1fr;gap:2mm;align-items:end}.signature-box,.stamp-box{height:13mm;border:1px dashed #9eb4d1;display:flex;align-items:end;justify-content:center;padding:1mm;font-size:5.3pt;color:#526987}.signature-box{border:0;border-bottom:.7px solid #173b78}.auth{font-size:5.5pt;font-weight:700;margin-top:.5mm;grid-column:1/-1}
          @media screen{body{background:#e9eef5;padding:5mm}.receipt{box-shadow:0 4px 22px #102b5920}}
          @media print{html,body{width:203mm;height:140mm;margin:0!important;padding:0!important}.receipt{width:203mm;height:140mm;margin:0;box-shadow:none;break-after:avoid}}
        `;
        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>RCLD Fee Receipt - ${esc(receiptNo)}</title><style>${css}</style></head><body>
          <main class="receipt">
            <header class="header"><img class="logo" src="${esc(logoUrl)}" alt="RCLD logo"/><div class="heading"><h1>RASHTRIYA COMPUTER LITERACY DRIVE</h1><h2>STUDENT FEE RECEIPT</h2></div><div class="receipt-meta"><b>Receipt No.:</b> ${esc(receiptNo)}<br/><b>Payment Date:</b> ${esc(formatDate(payment?.date))}</div></header>
            <div class="org"><span>RCLD – ISLAMPUR</span><span>AEC Code: RCLD/ISL/001</span><span>9/15, A/9, Accheletalla, Islampur</span></div>
            <div class="top-grid"><section class="panel"><div class="panel-title">STUDENT DETAILS</div><div class="student-grid">${fieldHtml}</div></section><section class="panel"><div class="panel-title">COMPLETE FEE BREAKUP</div><div class="fee-list">${feeHtml}</div></section></div>
            <section class="panel"><div class="panel-title">PAYMENT RECEIVED — COMPLETE TRANSACTION DETAILS</div>
              <div class="payment-grid">
                <div class="payment-field received"><b>Total Amount Received</b><strong>${esc(money(payment?.amount))}</strong></div>
                <div class="payment-field"><b>Payment Section / Type</b><strong>${esc(type)}</strong></div>
                <div class="payment-field"><b>Payment Date</b><strong>${esc(formatDate(payment?.date))}</strong></div>
                <div class="payment-field"><b>Payment Method</b><strong>${esc(payment?.method || "—")}</strong></div>
                <div class="payment-field"><b>Installment Month</b><strong>${esc(formatMonth(payment?.installmentMonth || items.find((x) => x.installmentMonth)?.installmentMonth || ""))}</strong></div>
              </div>
              <table class="items-table"><thead><tr><th>Fee Section / Purpose</th><th>Installment Month</th><th class="right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
              <div class="purpose-note"><b>UTR / Transaction No.:</b> ${esc(payment?.utrNumber || "—")} &nbsp; | &nbsp; <b>Other Reference:</b> ${esc(payment?.reference || "—")} &nbsp; | &nbsp; <b>Purpose / Note:</b> ${esc(payment?.note || "—")} &nbsp; | &nbsp; <b>Payment Screenshot:</b> ${payment?.screenshotUrl ? "Attached" : "Not attached"}</div>
            </section>
            <section class="panel"><div class="panel-title">PAYMENT SUMMARY</div><div class="payment-grid"><div class="payment-field"><b>Total Course Fee Payable</b><strong>${esc(money(payable))}</strong></div><div class="payment-field"><b>Total Amount Paid</b><strong>${esc(money(paid))}</strong></div><div class="payment-field"><b>Amount Due</b><strong>${esc(money(due))}</strong></div><div class="payment-field"><b>Receipt Amount</b><strong>${esc(money(payment?.amount))}</strong></div><div class="payment-field"><b>Receipt No.</b><strong>${esc(receiptNo)}</strong></div></div></section>
            <section class="terms"><h3>TERMS &amp; CONDITIONS</h3><ol><li>If any fee payment or installment is made after the 10th of the month, a late fine of ₹50 will be added.</li><li>This receipt is valid only after verification by the Authorised AEC.</li><li>Fee once paid is non-refundable.</li><li>Admission fee includes nominal charges for registration, ID card, course module and certificates.</li></ol></section>
            <div class="bottom"><div class="bottom-note"><b>Payment Proof:</b> ${payment?.screenshotUrl ? `<a href="${esc(payment.screenshotUrl)}">View uploaded proof</a>` : "Not attached"}<br/><b>Reference:</b> ${esc(reference)}</div><div class="sign"><div class="signature-box">Authorised Signatory Signature</div><div class="stamp-box">Official Stamp</div><div class="auth">AUTHORISED AEC • RCLD – ISLAMPUR</div></div><div class="bottom-note" style="text-align:right"><b>Received:</b> ${esc(money(payment?.amount))}<br/><b>For RCLD – ISLAMPUR</b></div></div>
          </main><script>window.addEventListener("load",()=>{const imgs=[...document.images];Promise.all(imgs.map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>setTimeout(()=>window.print(),250));});</script>
        </body></html>`;
        w.document.open();
        w.document.write(html);
        w.document.close();
}
