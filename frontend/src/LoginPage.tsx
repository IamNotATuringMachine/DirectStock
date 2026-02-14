import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "./stores/authStore";

export default function LoginPage() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("change-me-admin-password");
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.isLoading);
  const navigate = useNavigate();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await login(username, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Login fehlgeschlagen");
    }
  };

  return (
    <main className="page" data-testid="login-page">
      <section className="card login-card">
        <h1>DirectStock Login</h1>
        <form onSubmit={onSubmit} className="form-grid" data-testid="login-form">
          <label>
            Benutzername
            <input
              className="input"
              data-testid="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Passwort
            <input
              className="input"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="error" data-testid="login-error">{error}</p> : null}
          <button className="btn btn-primary" disabled={loading} type="submit" data-testid="login-submit">
            {loading ? "Anmeldung..." : "Anmelden"}
          </button>
        </form>
      </section>
    </main>
  );
}
