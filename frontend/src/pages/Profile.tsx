import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Field, Notice } from "../components";
import type { User } from "../types";

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  if (!user) return null;
  async function submit(event: FormEvent<HTMLFormElement>, kind: string) {
    event.preventDefault();
    setBusy(kind);
    setError(null);
    setSaved(false);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (kind === "profile") {
        const result = await api<{ user: User }>("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        setUser(result.user);
        setSaved(true);
      } else {
        await api("/auth/change-password", {
          method: "POST",
          body: JSON.stringify(values),
        });
        setUser(null);
        navigate("/login", { replace: true });
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="grid gap-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Profile & security
        </h1>
        <p className="mt-3 text-sm text-muted">
          A few details that keep your RAHMA account up to date.
        </p>
      </div>
      <Notice error={error} />
      {saved && <Notice>Your profile has been updated.</Notice>}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="card">
          <div className="card-heading">
            <UserRound size={19} />
            <h2>Personal information</h2>
          </div>
          <form
            className="grid gap-5 p-6"
            onSubmit={(e) => void submit(e, "profile")}
          >
            <Field
              label="Full name"
              name="name"
              defaultValue={user.name}
              autoComplete="name"
              minLength={2}
              maxLength={100}
              required
            />
            <div>
              <p className="field mb-2">Email address</p>
              <p className="break-all text-sm">{user.email}</p>
              <p className="mt-2 text-xs text-muted">
                Verified email addresses cannot be changed here.
              </p>
            </div>
            <Field
              label="Phone number"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={25}
              pattern="[+0-9 ()\-]*"
              defaultValue={user.phone}
            />
            <Field
              label="District"
              name="district"
              maxLength={100}
              defaultValue={user.district}
              autoComplete="address-level2"
            />
            <Button
              busy={busy === "profile"}
              disabled={Boolean(busy)}
              type="submit"
            >
              Save profile
            </Button>
          </form>
        </section>
        <section className="card">
          <div className="card-heading">
            <KeyRound size={19} />
            <h2>Change password</h2>
          </div>
          <form
            className="grid gap-5 p-6"
            onSubmit={(e) => void submit(e, "password")}
          >
            <p className="text-xs leading-6 text-muted">
              Changing your password ends all active sessions. You’ll need to
              sign in again.
            </p>
            <Field
              label="Current password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <p className="text-xs text-muted">Use at least 12 characters.</p>
            <Button
              busy={busy === "password"}
              disabled={Boolean(busy)}
              variant="secondary"
              type="submit"
            >
              Update password
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
