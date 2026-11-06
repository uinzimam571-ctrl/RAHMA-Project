import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  HandHeart,
  Heart,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  Brand,
  Button,
  Field,
  NetworkMap,
  Notice,
  Success,
  TrustNote,
} from "../components";

const pages = {
  login: [
    "Welcome back",
    "Sign in to your role-specific RAHMA workspace.",
    "Sign in to workspace",
  ],
  signup: [
    "Join the response network",
    "A small step for you. Meaningful support for more families.",
    "Create your account",
  ],
  forgot: [
    "Forgot your password?",
    "It happens. We’ll email you a secure link to start fresh.",
    "Send reset link",
  ],
  reset: [
    "Choose a new password",
    "A fresh start. Use at least 12 characters for a strong password.",
    "Update password",
  ],
  verify: [
    "Verify your email",
    "Confirm your email address to activate your RAHMA account.",
    "Verify email address",
  ],
  resend: [
    "Check your inbox",
    "Enter your email to request a new verification link.",
    "Send verification link",
  ],
} as const;
type Page = keyof typeof pages;

export default function AuthPage() {
  const location = useLocation();
  const mode = location.pathname.slice(1) || "login";
  const page: Page = mode in pages ? (mode as Page) : "login";
  const [title, subtitle, action] = pages[page];
  const auth = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("Household");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
  );
  useEffect(() => {
    document.title = `${title} · RAHMA`;
    if (window.location.hash)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, [title]);
  if (auth.user && ["login", "signup"].includes(page))
    return <Navigate to="/workspace" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      if (page === "login") {
        await auth.signIn(data.email, data.password);
        const destination = location.state?.from;
        navigate(
          typeof destination === "string" &&
            destination.startsWith("/workspace")
            ? destination
            : "/workspace",
          { replace: true },
        );
      } else {
        const bodies = {
          signup: {
            name: data.name,
            email: data.email,
            password: data.password,
            role,
          },
          forgot: { email: data.email },
          resend: { email: data.email },
          reset: { token, password: data.password },
          verify: { token },
        };
        const paths = {
          signup: "/register",
          forgot: "/forgot-password",
          resend: "/resend-verification",
          reset: "/reset-password",
          verify: "/verify",
        };
        const result = await api<{ message: string }>(`/auth${paths[page]}`, {
          method: "POST",
          body: JSON.stringify(bodies[page]),
        });
        if (page === "verify") setVerificationMessage(result.message);
        if (page === "reset") auth.setUser(null);
        setDone(true);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div className="my-auto py-12 lg:py-14">
          <p className="mb-5 text-[10px] font-semibold tracking-[.22em] text-emerald-300 uppercase">
            Coordinated relief starts here
          </p>
          <h2 className="text-[clamp(2rem,3.5vw,3.4rem)] leading-[1.12] font-semibold tracking-[-.045em] text-white">
            One network.
            <br />
            More families reached.
          </h2>
          <p className="mt-6 max-w-sm text-[15px] leading-7 text-slate-400">
            Bring people, resources and decisions together. Follow every case
            from registration to meaningful support.
          </p>
          <NetworkMap />
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" /> People
              first
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400" /> Accountable
              action
            </span>
          </div>
        </div>
        <p className="text-[10px] tracking-wide text-slate-500">
          RAHMA · Built for communities across Pakistan
        </p>
      </aside>
      <section className="auth-form-section">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          {page !== "login" && (
            <Link
              to="/login"
              className="mb-9 inline-flex items-center gap-2 text-xs text-muted hover:text-brand"
            >
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          )}
          {done ? (
            <Success
              title={
                page === "verify"
                  ? "Email verified"
                  : page === "reset"
                    ? "Password updated"
                    : "Check your inbox"
              }
            >
              {page === "verify" ? (
                verificationMessage
              ) : page === "reset" ? (
                "Your password has been changed and previous sessions have ended. Sign in with your new password."
              ) : (
                <>
                  If your email is eligible, you’ll receive a secure link
                  shortly. Check your inbox and spam folder.
                  {page === "signup" && (
                    <Link
                      to="/resend"
                      className="mt-4 block font-semibold text-brand"
                    >
                      Didn’t receive an email?
                    </Link>
                  )}
                </>
              )}
            </Success>
          ) : (
            <>
              <div className="mb-8">
                <span className="eyebrow text-brand">
                  {page === "login"
                    ? "Your response workspace"
                    : "Your RAHMA account"}
                </span>
                <h1 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-.035em]">
                  {title}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p>
              </div>
              {["verify", "reset"].includes(page) && !token ? (
                <>
                  <Notice
                    error={
                      new Error(
                        "This link is missing its secure token. Please request a new email.",
                      )
                    }
                  />
                  <Link
                    to={page === "verify" ? "/resend" : "/forgot"}
                    className="button mt-5"
                  >
                    Request a new link
                  </Link>
                </>
              ) : (
                <form className="grid gap-5" onSubmit={submit}>
                  {page === "signup" && (
                    <Field
                      label="Full name"
                      name="name"
                      placeholder="Your full name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  )}
                  {["login", "signup", "forgot", "resend"].includes(page) && (
                    <Field
                      label="Email address"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  )}
                  {["login", "signup", "reset"].includes(page) && (
                    <div>
                      <Field
                        label={page === "reset" ? "New password" : "Password"}
                        name="password"
                        type="password"
                        placeholder={
                          page === "login"
                            ? "Enter your password"
                            : "Create a strong password"
                        }
                        autoComplete={
                          page === "login" ? "current-password" : "new-password"
                        }
                        minLength={page === "login" ? 1 : 12}
                        maxLength={128}
                        required
                      />
                      {page !== "login" && (
                        <p className="mt-2 text-xs text-muted">
                          Use at least 12 characters. A longer passphrase works
                          well.
                        </p>
                      )}
                    </div>
                  )}
                  {page === "login" && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <ShieldCheck size={14} /> Secure sign in
                      </span>
                      <Link className="font-semibold text-brand" to="/forgot">
                        Forgot password?
                      </Link>
                    </div>
                  )}
                  {page === "signup" && (
                    <fieldset>
                      <legend className="mb-3 text-xs font-semibold">
                        I’m joining as
                      </legend>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["Household", Users],
                          ["Donor", Heart],
                          ["Volunteer", HandHeart],
                          ["NGO", Building2],
                        ].map(([name, Icon]) => {
                          const RoleIcon = Icon as typeof Users;
                          return (
                            <label
                              key={String(name)}
                              className={`role-choice ${role === name ? "selected" : ""}`}
                            >
                              <input
                                className="sr-only"
                                type="radio"
                                name="role-choice"
                                value={String(name)}
                                checked={role === name}
                                onChange={() => setRole(String(name))}
                              />
                              <RoleIcon size={20} />
                              <span>{String(name)}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted">
                        NGO accounts need administrator approval after email
                        verification. Administrator access cannot be
                        self-registered.
                      </p>
                    </fieldset>
                  )}
                  {page === "verify" && (
                    <div className="rounded-xl border border-line bg-paper p-5 text-sm leading-6 text-muted">
                      <Mail size={25} className="mb-3 text-brand" />
                      Verify this email address to securely activate your
                      account. This link can only be used once.
                    </div>
                  )}
                  <Notice error={error} />
                  <Button busy={busy} type="submit" className="mt-1 w-full">
                    {action}
                    <ArrowRight size={16} />
                  </Button>
                </form>
              )}
              <div className="mt-7 text-center text-xs text-muted">
                {page === "login" ? (
                  <>
                    New to RAHMA?{" "}
                    <Link to="/signup" className="font-semibold text-brand">
                      Create an account
                    </Link>
                    <p className="mt-3">
                      Waiting for verification?{" "}
                      <Link to="/resend" className="text-brand">
                        Resend email
                      </Link>
                    </p>
                  </>
                ) : (
                  <>
                    Already registered?{" "}
                    <Link to="/login" className="font-semibold text-brand">
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
          <div className="mt-10 border-t border-line pt-6">
            <TrustNote />
          </div>
        </div>
        <p className="mt-10 text-center text-[10px] text-muted">
          Together, we make relief reach further.
        </p>
      </section>
    </main>
  );
}
