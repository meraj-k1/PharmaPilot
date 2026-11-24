
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
  ArrowLeft,
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
  UserRound,
} from "lucide-react";

import { api } from "../../lib/api";

import "./auth-pages.css";

type RegisterResponse = {
  user: {
    id: string;
    full_name: string;
    email: string;
    is_active: boolean;
  };
  pharmacy: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
};

function getRegisterError(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;

    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item: { msg?: string }) =>
          item.msg ?? "Invalid value"
        )
        .join("; ");
    }

    if (error.response?.status === 409) {
      return "An account with this email already exists.";
    }

    if (!error.response) {
      return "Unable to connect to the server.";
    }

    return "Unable to create your account.";
  }

  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordLengthValid =
    password.length >= 8 && password.length <= 128;

  const passwordsMatch =
    password.length > 0 && password === confirmPassword;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (fullName.trim().length < 2) {
      setError("Full name must contain at least 2 characters.");
      return;
    }

    if (pharmacyName.trim().length < 2) {
      setError("Pharmacy name must contain at least 2 characters.");
      return;
    }

    if (!passwordLengthValid) {
      setError(
        "Password must contain between 8 and 128 characters."
      );
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post<RegisterResponse>(
        "/auth/register",
        {
          full_name: fullName.trim(),
          pharmacy_name: pharmacyName.trim(),
          email: email.trim().toLowerCase(),
          password,
        },
        { timeout: 30000 }
      );

      navigate("/login", {
        replace: true,
        state: {
          registered: true,
          email: email.trim().toLowerCase(),
        },
      });
    } catch (err) {
      setError(getRegisterError(err));
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
            START YOUR DIGITAL JOURNEY
          </div>

          <h1>
            Your pharmacy.
            <br />
            Your data.
            <br />
            <span>One platform.</span>
          </h1>

          <p>
            Create your PharmaPilot account and
            organize your pharmacy operations
            through one intelligent workspace.
          </p>

          <div className="auth-feature-list">
            <div>
              <CheckCircle2 size={19} />
              Organize medicine information
            </div>

            <div>
              <CheckCircle2 size={19} />
              Manage purchases and inventory
            </div>

            <div>
              <CheckCircle2 size={19} />
              Explore AI-powered assistance
            </div>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>PharmaPilot</span>
          <span>Your intelligent pharmacy workspace</span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card auth-register-card">
          <Link to="/login" className="auth-back-link">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>

          <div className="auth-heading">
            <div className="auth-heading-icon">
              <Store size={25} />
            </div>

            <h2>Create your account</h2>

            <p>
              Set up your pharmacy workspace
              in a few simple steps.
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) =>
              void handleSubmit(event)
            }
          >
            <label className="auth-field">
              <span>Full name</span>

              <div className="auth-input-wrap">
                <UserRound size={18} />

                <input
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={150}
                  value={fullName}
                  required
                  disabled={loading}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Pharmacy name</span>

              <div className="auth-input-wrap">
                <Store size={18} />

                <input
                  type="text"
                  placeholder="Enter your pharmacy name"
                  minLength={2}
                  maxLength={200}
                  value={pharmacyName}
                  required
                  disabled={loading}
                  onChange={(event) =>
                    setPharmacyName(event.target.value)
                  }
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Email address</span>

              <div className="auth-input-wrap">
                <Mail size={18} />

                <input
                  type="email"
                  placeholder="you@pharmacy.com"
                  autoComplete="email"
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
                  placeholder="Create a password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
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
                    setShowPassword((value) => !value)
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

            <div className="auth-password-hint">
              <CheckCircle2
                size={15}
                className={
                  passwordLengthValid ? "valid" : ""
                }
              />
              Use at least 8 characters.
            </div>

            <label className="auth-field">
              <span>Confirm password</span>

              <div className="auth-input-wrap">
                <LockKeyhole size={18} />

                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  value={confirmPassword}
                  required
                  disabled={loading}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            {confirmPassword && (
              <div
                className={`auth-password-hint ${
                  passwordsMatch
                    ? "auth-match"
                    : "auth-mismatch"
                }`}
              >
                <CheckCircle2 size={15} />
                {passwordsMatch
                  ? "Passwords match."
                  : "Passwords do not match."}
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
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
                  Creating account...
                </>
              ) : (
                <>
                  Create pharmacy account
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>

          <Link
            to="/login"
            className="auth-secondary-link"
          >
            Sign in to PharmaPilot
          </Link>

          <div className="auth-trust-note">
            <ShieldCheck size={17} />
            <span>
              Your account and pharmacy workspace
              will be created together.
            </span>
          </div>
        </div>

        <p className="auth-panel-footer">
          © {new Date().getFullYear()} PharmaPilot.
          Intelligent Pharmacy Operations.
        </p>
      </section>
    </main>
  );
}
