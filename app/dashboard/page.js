const stats = [["Students","0"],["Employees","0"],["Courses","0"],["Active Batches","0"]];

export default function DashboardPage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <h2>RCLD ERP</h2>
        <nav className="nav">
          <a href="/dashboard">Dashboard</a><a href="#">Students</a><a href="#">Admissions</a><a href="#">Courses</a><a href="#">Batches</a><a href="#">Employees</a><a href="#">Fees & Payments</a><a href="#">Attendance</a><a href="#">Exams & Results</a><a href="#">Certificates</a><a href="#">Reports</a><a href="#">Settings</a>
        </nav>
      </aside>
      <section className="content">
        <div className="eyebrow">ERP Control Center</div>
        <h1>Dashboard</h1>
        <p>This is the foundation only. Business modules will be implemented in SDLC order.</p>
        <div className="stats">{stats.map(([label,value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      </section>
    </main>
  );
}
