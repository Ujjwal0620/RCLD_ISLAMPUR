export function DetailField({ label, children, className = "student-detail-field" }) {
  const displayValue = children === undefined || children === null || children === "" ? "—" : children;

  return (
    <div className={className}>
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}
