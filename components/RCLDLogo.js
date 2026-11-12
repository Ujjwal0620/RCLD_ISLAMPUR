export default function RCLDLogo({ className = "", alt = "RCLD — Rashtriya Computer Literacy Drive" }) {
  return (
    <img
      src="/assets/logo.png"
      alt={alt}
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
