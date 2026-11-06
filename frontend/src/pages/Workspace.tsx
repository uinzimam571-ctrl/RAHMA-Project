import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { Brand, Button, Notice } from "../components";

export function Workspace() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (auth.loading)
    return (
      <div
        role="status"
        className="grid min-h-screen place-items-center text-muted"
      >
        Opening your workspace…
      </div>
    );
  if (auth.error)
    return (
      <div className="mx-auto mt-20 max-w-md p-6">
        <Notice error={new Error(auth.error)} />
        <Button onClick={() => void auth.refresh()} className="mt-5">
          Try again
        </Button>
      </div>
    );
  if (!auth.user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  const user = auth.user;
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await auth.signOut();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-paper">
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`workspace-sidebar ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between px-6 py-8">
          <Brand light />
          <button
            className="text-white lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow mt-6 mb-3 px-7 text-slate-500">Your workspace</p>
        <nav className="grid gap-1 px-3" aria-label="Workspace navigation">
          {[
            ["/workspace", "Overview", LayoutDashboard],
            ["/workspace/profile", "Profile & security", UserRound],
            ...(user.role === "Admin"
              ? [["/workspace/users", "User management", Users]]
              : []),
          ].map(([to, title, Icon]) => {
            const NavIcon = Icon as typeof Users;
            return (
              <NavLink
                end={to === "/workspace"}
                to={String(to)}
                key={String(to)}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
                onClick={() => setOpen(false)}
              >
                <NavIcon size={17} />
                {String(title)}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-5">
          <div className="mb-5 flex gap-3">
            <span className="avatar bg-white/10! text-emerald-200!">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {user.name}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {user.role} account
              </p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2.5 text-xs text-slate-300 disabled:opacity-50"
          >
            <LogOut size={14} />
            {busy ? "Signing out…" : "Sign out"}
          </button>
          {Boolean(error) && (
            <div className="mt-3">
              <Notice error={error} />
            </div>
          )}
        </div>
      </aside>
      <div className="lg:ml-[244px]">
        <header className="flex h-20 items-center justify-between border-b border-line bg-white px-5 sm:px-10">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              className="lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="text-xs text-muted">Workspace</span>
            <ChevronRight size={13} className="text-muted" />
            <span className="text-xs font-semibold">
              {location.pathname.endsWith("/users")
                ? "User management"
                : location.pathname.endsWith("/profile")
                  ? "Profile & security"
                  : "Overview"}
            </span>
          </div>
          <span className="badge">
            <ShieldCheck size={13} />
            {user.role}
          </span>
        </header>
        <main className="mx-auto max-w-[1340px] p-5 py-8 sm:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function Overview() {
  const { user } = useAuth();
  if (!user) return null;
  const descriptions = {
    Admin:
      "Manage verified accounts and keep access to the network accountable.",
    NGO: "Your approved organization access is ready for coordinated relief.",
    Volunteer:
      "Your account is ready. You’re part of the network that brings support closer.",
    Donor:
      "Your account is ready to support communities through the RAHMA network.",
    Household:
      "Your account is ready. Stay connected to the people coordinating relief.",
  };
  return (
    <div className="grid gap-7">
      <div>
        <p className="eyebrow text-brand">Connected. Verified. Ready.</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Welcome, {user.name.split(" ")[0]}.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          {descriptions[user.role]}
        </p>
      </div>
      <section className="welcome-card">
        <div className="max-w-lg">
          <span className="eyebrow text-emerald-200">
            A stronger response, together
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            You’re part of something that matters.
          </h2>
          <p className="mt-4 text-sm leading-7 text-emerald-100/70">
            Keep your profile accurate and your account secure. Your role
            determines the information and actions available to you.
          </p>
          <Link
            to="/workspace/profile"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-xs font-semibold text-brand"
          >
            Review your profile <ArrowRight size={15} />
          </Link>
        </div>
        <div className="hidden size-36 place-items-center rounded-full border border-white/10 bg-white/5 sm:grid">
          <ShieldCheck size={68} strokeWidth={1} />
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          [CheckCircle2, "Email verified", "Your email address is confirmed."],
          [
            LockKeyhole,
            "Secure session",
            "Your session expires automatically and can be ended with sign out.",
          ],
          [
            UserRound,
            `${user.role} access`,
            "Permissions are checked by the server on every protected request.",
          ],
        ].map(([Icon, title, text]) => {
          const CardIcon = Icon as typeof Users;
          return (
            <div className="card p-6" key={String(title)}>
              <CardIcon size={22} className="mb-5 text-brand" />
              <h2 className="font-semibold">{String(title)}</h2>
              <p className="mt-2 text-xs leading-6 text-muted">
                {String(text)}
              </p>
            </div>
          );
        })}
      </div>
      <section className="card p-6">
        <h2 className="font-semibold">Your account at a glance</h2>
        <dl className="mt-5 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Email address</dt>
            <dd className="mt-2 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Member since</dt>
            <dd className="mt-2">
              {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
                new Date(user.created_at),
              )}
            </dd>
          </div>
          {user.organization_id && (
            <div>
              <dt className="text-xs text-muted">Organization scope</dt>
              <dd className="mt-2">{user.organization_id}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
