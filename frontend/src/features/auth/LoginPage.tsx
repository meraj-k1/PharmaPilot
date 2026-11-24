
import {
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router";

import { AxiosError } from "axios";

import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Pill,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

import { api } from "../../lib/api";

import {
  logout,
  saveSession,
  setSelectedPharmacyId,
} from "../../lib/auth";

import "./auth-pages.css";

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type Membership = {
  pharmacy_id: string;
  pharmacy_name: string;
  role: string;
};

type ProfileResponse = {
  user: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
  };
  memberships: Membership[];
};

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;

    if (error.response?.status === 401) {
      return "Invalid email or password.";
    }

    if (error.response?.status === 422) {
      return "Please enter a valid email and password.";
    }

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (!error.response) {
      return "Unable to connect to the server.";
    }

    return "Unable to sign in. Please try again.";
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [memberships, setMemberships] =
    useState<Membership[]>([]);

  const [selectedPharmacy, setSelectedPharmacy] =
    useState("");

  const [userName, setUserName] = useState("");

  const choosingPharmacy = memberships.length > 1;

  function completeLogin(pharmacyId: string) {
    const authorized = memberships.some(
      (item) => item.pharmacy_id === pharmacyId
    );

    if (!authorized) {
      setError("Select an authorized pharmacy.");
      return;
    }

    setSelectedPharmacyId(pharmacyId);
    navigate("/dashboard", { replace: true });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMemberships([]);
    setSelectedPharmacy("");

    logout();

    try {
      const response = await api.post<LoginResponse>(
        "/auth/login",
        {
          email: email.trim().toLowerCase(),
          password,
        }
      );

      const token = response.data.access_token;

      if (!token) {
        throw new Error(
          "Login response did not contain an access token."
        );
      }

      saveSession(token);

      const profileResponse =
        await api.get<ProfileResponse>("/auth/me");

      const profile = profileResponse.data;

      if (!profile.user.is_active) {
        throw new Error(
          "Your account is not active."
        );
      }

      if (profile.memberships.length === 0) {
        throw new Error(
          "No pharmacy is assigned to your account."
        );
      }

      setUserName(profile.user.full_name);

      if (profile.memberships.length === 1) {
        setSelectedPharmacyId(
          profile.memberships[0].pharmacy_id
        );

        navigate("/dashboard", {
          replace: true,
        });

        return;
      }

      setMemberships(profile.memberships);
      setSelectedPharmacy(
        profile.memberships[0].pharmacy_id
      );
    } catch (err) {
      logout();
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <Link to="/login" className="auth-brand-logo">
          <span className="auth-logo-icon">
            <Pill size={23} />
          </span>
          <span>PharmaPilot</span>
        </Link>

        <div className="auth-brand-content">
          <div className="auth-brand-tag">
            <Sparkles size={15} />
            INTELLIGENT PHARMACY OPERATIONS
          </div>

          <h1>
            A smarter way to
            <br />
            manage your
            <br />
            <span>pharmacy.</span>
          </h1>

          <p>
            Manage your medicines, inventory,
            suppliers, purchases and AI-powered
            pharmacy knowledge from one workspace.
          </p>

          <div className="auth-feature-list">
            <div>
              <CheckCircle2 size={19} />
              Centralized pharmacy management
            </div>

            <div>
              <CheckCircle2 size={19} />
              Batch-level inventory monitoring
            </div>

            <div>
              <CheckCircle2 size={19} />
              Intelligent AI assistance
            </div>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>PharmaPilot</span>
          <span>Built for smarter pharmacy operations</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          {choosingPharmacy ? (
            <>
              <div className="auth-heading">
                <div className="auth-heading-icon">
                  <Store size={25} />
                </div>

                <h2>Choose your pharmacy</h2>

                <p>
                  Welcome back, {userName}.
                  Select the workspace you want to manage.
                </p>
              </div>

              <div className="auth-pharmacy-options">
                {memberships.map((membership) => (
                  <button
                    key={membership.pharmacy_id}
                    type="button"
                    className={`auth-pharmacy-option ${
                      selectedPharmacy === membership.pharmacy_id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedPharmacy(
                        membership.pharmacy_id
                      )
                    }
                  >
                    <span className="auth-pharmacy-symbol">
                      <Store size={21} />
                    </span>

                    <span className="auth-pharmacy-info">
                      <strong>
                        {membership.pharmacy_name}
                      </strong>
                      <small>{membership.role}</small>
                    </span>

                    <span className="auth-radio-indicator" />
                  </button>
                ))}
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="button"
                className="auth-submit"
                disabled={!selectedPharmacy}
                onClick={() =>
                  completeLogin(selectedPharmacy)
                }
              >
                Continue to Dashboard
                <ArrowRight size={19} />
              </button>

              <button
                type="button"
                className="auth-text-button"
                onClick={() => {
                  logout();
                  setMemberships([]);
                  setSelectedPharmacy("");
                  setPassword("");
                  setError("");
                }}
              >
                Sign in with another account
              </button>
            </>
          ) : (
            <>
              <div className="auth-heading">
                <div className="auth-heading-icon">
                  <LockKeyhole size={25} />
                </div>

                <h2>Welcome back</h2>

                <p>
                  Sign in to your PharmaPilot account
                  to access your workspace.
                </p>
              </div>

              <form
                className="auth-form"
                onSubmit={(event) =>
                  void handleSubmit(event)
                }
              >
                <label className="auth-field">
                  <span>Email address</span>

                  <div className="auth-input-wrap">
                    <Mail size={18} />

                    <input
                      type="email"
                      placeholder="you@pharmacy.com"
                      autoComplete="username"
                      value={email}
                      required
                      disabled={loading}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                    />
                  </div>
                </label>

                <label className="auth-field">
                  <span>Password</span>

                  <div className="auth-input-wrap">
                    <LockKeyhole size={18} />

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      required
                      disabled={loading}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>

                {error && (
                  <div
                    className="auth-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={19}
                        className="auth-spin"
                      />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={19} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-divider">
                <span>New to PharmaPilot?</span>
              </div>

              <Link
                to="/register"
                className="auth-secondary-link"
              >
                <Store size={18} />
                Create a pharmacy account
              </Link>

              <div className="auth-trust-note">
                <ShieldCheck size={17} />
                <span>
                  Your pharmacy is identified
                  automatically after sign in.
                </span>
              </div>
            </>
          )}
        </div>

        <p className="auth-panel-footer">
          © {new Date().getFullYear()} PharmaPilot.
          Intelligent Pharmacy Operations.
        </p>
      </section>
    </main>
  );
}
