export const esc = (v) =>
  String(v ?? "—").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

export const upper = (v) => esc(String(v ?? "").trim().toUpperCase());

export const toTitleCase = (str) =>
  String(str ?? "")
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

export const formatIcardDate = (date) => {
  if (!date) return "—";
  const m = String(date).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(date);
};

export const icardIcon = (type, color) => {
  const c = esc(color);
  if (type === "mail")
    return `<svg class="ic" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M3 7l9 7 9-7" fill="none" stroke="${c}" stroke-width="2.4"/></svg>`;
  if (type === "phone-circle")
    return `<svg class="ic-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M8.2 10.9a9.5 9.5 0 004.9 4.9l1.6-1.6c.2-.2.5-.3.8-.1.8.3 1.7.4 2.6.4.4 0 .7.3.7.7v2.5c0 .4-.3.7-.7.7A12.4 12.4 0 015.6 5.9c0-.4.3-.7.7-.7h2.5c.4 0 .7.3.7.7 0 .9.1 1.8.4 2.6.1.3 0 .6-.2.8l-1.5 1.6z" fill="${c}"/></svg>`;
  if (type === "std-phone")
    return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><path d="M8.2 10.9a9.5 9.5 0 004.9 4.9l1.6-1.6c.2-.2.5-.3.8-.1.8.3 1.7.4 2.6.4.4 0 .7.3.7.7v2.5c0 .4-.3.7-.7.7A12.4 12.4 0 015.6 5.9c0-.4.3-.7.7-.7h2.5c.4 0 .7.3.7.7 0 .9.1 1.8.4 2.6.1.3 0 .6-.2.8l-1.5 1.6z" fill="#FFFFFF"/></svg>`;
  if (type === "std-mail")
    return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><rect x="5" y="7.5" width="14" height="9" rx="1.2" fill="none" stroke="#FFFFFF" stroke-width="1.8"/><path d="M5.5 8l6.5 5 6.5-5" fill="none" stroke="#FFFFFF" stroke-width="1.8"/></svg>`;
  if (type === "std-web")
    return `<svg class="std-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0288D1"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#FFFFFF" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3" ry="6.5" fill="none" stroke="#FFFFFF" stroke-width="1.3"/><path d="M5.5 12h13" stroke="#FFFFFF" stroke-width="1.3"/></svg>`;
  return "";
};

export const icardSignature = (color) =>
  `<svg class="scribble" viewBox="0 0 85 32"><path d="M8 22 C14 5 26 4 22 18 C19 28 32 6 38 11 C44 16 33 26 46 18 C54 12 60 8 65 17 C70 25 75 11 82 15 M4 16 L48 14" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
