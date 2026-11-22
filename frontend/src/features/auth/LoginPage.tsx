
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AxiosError } from "axios";
import { LockKeyhole, Pill, ArrowRight } from "lucide-react";

import { api } from "../../lib/api";
import { saveSession } from "../../lib/auth";

type LoginResponse = {
  access_token: string;
  token_type?: string;
};

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>(
        "/auth/login",
        {
          email: email.trim(),
          password,
        }
      );

      const accessToken =
        response.data.access_token;

      if (!accessToken) {
        throw new Error(
          "Login response does not contain an access token."
        );
      }

      saveSession(accessToken, pharmacyId.trim());

      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.data?.error?.message ??
            "Unable to sign in. Check your credentials."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup">
          <Pill size={27} />
          <span>PharmaPilot</span>
        </div>

        <div className="brand-message">
          <span className="eyebrow">
            INTELLIGENT PHARMACY OPERATIONS
          </span>

          <h1>
            Smarter inventory.
            <br />
            Better pharmacy decisions.
          </h1>

          <p>
            Manage medicines, stock, purchases
            and pharmacy knowledge from one
            intelligent workspace.
          </p>
        </div>

        <div className="brand-footer">
          PharmaPilot · Pharmacy Management Platform
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-symbol">
            <LockKeyhole size={24} />
          </div>

          <h2>Welcome back</h2>

          <p className="muted">
            Sign in to your pharmacy workspace.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@pharmacy.com"
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <label htmlFor="pharmacy">
              Pharmacy ID
            </label>
            <input
              id="pharmacy"
              type="text"
              value={pharmacyId}
              onChange={(event) =>
                setPharmacyId(event.target.value)
              }
              placeholder="Pharmacy UUID"
              required
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              title="Enter a valid pharmacy UUID"
            />

            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              <span>
                {loading ? "Signing in..." : "Sign in"}
              </span>
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="login-note">
            Secure access for authorized pharmacy
            administrators and staff.
          </p>
        </div>
      </section>
    </main>
  );
}
