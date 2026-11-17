"use client";

export default function DigitBoxes({ label, value = "", onChange, length = 10 }) {
  const digits = String(value || "").padEnd(length, " ").slice(0, length).split("");

  function updateAt(start, raw) {
    const incoming = String(raw || "").replace(/\D/g, "").slice(0, length - start);
    const next = digits.slice();
    if (!String(raw || "")) next[start] = " ";
    incoming.split("").forEach((digit, index) => (next[start + index] = digit));
    onChange(next.join("").replace(/\s+$/, ""));
  }

  return (
    <label className="form-field digit-box-field">
      <span>{label}</span>
      <div className="rcld-digit-boxes">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            aria-label={label + " digit " + (index + 1)}
            inputMode="numeric"
            maxLength={1}
            value={digits[index] === " " ? "" : digits[index]}
            onChange={(event) => {
              updateAt(index, event.target.value.slice(-1));
              if (event.target.value && index < length - 1)
                event.currentTarget.parentElement.children[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0)
                event.currentTarget.parentElement.children[index - 1]?.focus();
              if (event.key === "ArrowLeft" && index > 0)
                event.currentTarget.parentElement.children[index - 1]?.focus();
              if (event.key === "ArrowRight" && index < length - 1)
                event.currentTarget.parentElement.children[index + 1]?.focus();
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData("text");
              updateAt(index, pasted);
              const count = pasted.replace(/\D/g, "").length;
              event.currentTarget.parentElement.children[Math.min(length - 1, index + count)]?.focus();
            }}
          />
        ))}
      </div>
    </label>
  );
}
