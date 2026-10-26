export default function LoginPage() {
  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">Secure Access</div>
        <h2>RCLD ERP Login</h2>
        <p>Authentication will be connected to the ERP user and student identity system.</p>
        <form className="actions" action="/dashboard">
          <input name="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button className="btn primary" type="submit">Continue</button>
        </form>
      </section>
    </main>
  );
}
