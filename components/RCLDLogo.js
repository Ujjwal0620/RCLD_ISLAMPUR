export default function RCLDLogo({ className = "", alt = "RCLD — Rashtriya Computer Literacy Drive" }) {
  return (
    <img
      src="/assets/rcld-logo.svg"
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
