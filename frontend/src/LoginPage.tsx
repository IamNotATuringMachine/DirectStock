import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, User, Lock, ArrowRight, Check, Eye, EyeOff } from "lucide-react";

import { resolvePostLoginPath } from "./routing/accessRouting";
import { useAuthStore } from "./stores/authStore";
import logo from "./assets/logo.png";

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.isLoading);
  const location = useLocation();
  const navigate = useNavigate();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await login(username, password);
      const authenticatedUser = useAuthStore.getState().user;
      const requestedPath = (location.state as LoginLocationState | null)?.from?.pathname;
      const targetPath = resolvePostLoginPath({
        requestedPath,
        userPermissions: authenticatedUser?.permissions,
      });

      if (!targetPath) {
        try {
          await logout();
        } catch {
          // keep login error handling deterministic when logout endpoint fails.
        }
        setError("Keine Seitenberechtigung vorhanden. Bitte Administrator kontaktieren.");
        navigate("/login", { replace: true });
        return;
      }

      navigate(targetPath, { replace: true });
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.");
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[var(--bg)] font-sans text-[var(--ink)]">
      {/* Left Side - Visual / Brand */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center p-12 bg-gray-900">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)] to-[#0c2444] z-0"></div>
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center mix-blend-overlay z-0"></div>

        {/* Abstract Circles Overlay */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-white opacity-5 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[var(--accent-strong)] opacity-20 blur-3xl"></div>

        <div className="relative z-10 max-w-lg text-white space-y-6">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 mb-4 animate-fade-in-up">
            <LayoutDashboard className="w-5 h-5 text-blue-200" />
            <span className="text-sm font-medium tracking-wide text-blue-100">Warehouse Management System</span>
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Effizienz trifft auf <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-white">Präzision.</span>
          </h1>

          <p className="text-lg text-blue-100/80 leading-relaxed">
            Optimieren Sie Ihre Lagerprozesse mit der nächsten Generation von DirectStock.
            Intelligente Bestandsverwaltung für moderne Unternehmen.
          </p>

          <div className="pt-8 flex gap-4 text-sm font-medium text-blue-200/70">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-400" /> Echtzeit-Tracking
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-400" /> Smart Analytics
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-400" /> Cloud Native
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left space-y-2">
            <div className="flex justify-center lg:justify-start">
              <div className="h-16 w-16 bg-[var(--panel)] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/10 mb-6 border border-[var(--line)] p-3 transition-colors duration-300">
                <img
                  src={logo}
                  alt="DirectStock Logo"
                  className="w-full h-full object-contain transition-all duration-300"
                />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-[var(--ink)]">Willkommen zurück</h2>
            <p className="text-[var(--muted)]">Bitte melden Sie sich an, um fortzufahren.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ink)] ml-1" htmlFor="username">
                  Benutzername oder E-Mail
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                  </div>
                  <input
                    id="username"
                    className="block w-full pl-10 pr-3 py-3 border border-[var(--line)] rounded-xl text-[var(--ink)] bg-[var(--panel)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all outline-none"
                    placeholder="Ihr Benutzername oder Ihre E-Mail"
                    data-testid="login-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--ink)] ml-1" htmlFor="password">
                    Passwort
                  </label>
                  <a href="#" className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">
                    Passwort vergessen?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[var(--muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                  </div>
                  <input
                    id="password"
                    className="block w-full pl-10 pr-10 py-3 border border-[var(--line)] rounded-xl text-[var(--ink)] bg-[var(--panel)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all outline-none"
                    placeholder="••••••••"
                    data-testid="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted)] hover:text-[var(--ink)] focus:outline-none focus:text-[var(--ink)] transition-colors"
                    aria-label={
                      showPassword
                        ? "Passwort ist sichtbar (klicken zum Verbergen)"
                        : "Passwort ist verborgen (klicken zum Anzeigen)"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                    data-testid="login-password-toggle"
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--line)] rounded cursor-pointer"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--muted)] cursor-pointer select-none">
                Angemeldet bleiben
              </label>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-shake" data-testid="login-error">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-[var(--accent)]/30 text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
              type="submit"
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Wird angemeldet...
                </>
              ) : (
                <>
                  Anmelden
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-sm text-[var(--muted)] pt-4">
              Noch kein Konto? <a href="#" className="font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Administrator kontaktieren</a>
            </p>
          </form>

          <div className="pt-8 mt-8 border-t border-[var(--line)] text-center text-xs text-[var(--muted)]">
            &copy; {new Date().getFullYear()} direct services GmbH. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
