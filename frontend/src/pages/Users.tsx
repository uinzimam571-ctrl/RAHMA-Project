import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Field, Notice } from "../components";
import type { User, UserPage, Role } from "../types";

const roles: Role[] = ["Household", "Donor", "Volunteer", "NGO", "Admin"];

function AccessDialog({
  user,
  close,
  saved,
}: {
  user: User;
  close: () => void;
  saved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<Role>(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/admin/users/${user.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          status: values.status,
          organization_id: values.organization_id || null,
        }),
      });
      saved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} onCancel={close} className="access-dialog">
      <div className="flex items-start justify-between border-b border-line p-6">
        <div>
          <h2 className="text-lg font-semibold">Manage account access</h2>
          <p className="mt-2 text-xs text-muted">{user.name}</p>
        </div>
        <button onClick={close} aria-label="Close dialog">
          <X size={19} />
        </button>
      </div>
      <form onSubmit={submit} className="grid gap-5 p-6">
        <label className="field">
          Role
          <select
            className="input mt-2"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {roles.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Account status
          <select
            className="input mt-2"
            name="status"
            defaultValue={
              user.status === "pending_approval" ? "active" : user.status
            }
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        {["NGO", "Volunteer"].includes(role) && (
          <Field
            label={
              role === "NGO"
                ? "Approved organization ID"
                : "Organization ID (optional)"
            }
            name="organization_id"
            defaultValue={user.organization_id || ""}
            maxLength={100}
            pattern="[A-Za-z0-9_\-]+"
            required={role === "NGO"}
          />
        )}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          Access changes take effect immediately and end this user’s active
          sessions. Assign NGO access only to an approved organization
          representative.
          {role === "Admin" &&
            " Administrator access grants control over other users and cannot be removed through this console."}
        </div>
        <Notice error={error} />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button busy={busy} type="submit">
            Save access
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export default function Users() {
  const { user } = useAuth();
  const [data, setData] = useState<UserPage | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (user?.role !== "Admin") return;
    let ignore = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      page_size: "10",
      search: query,
    });
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    api<UserPage>(`/admin/users?${params}`)
      .then((result) => {
        if (!ignore) setData(result);
      })
      .catch((e) => {
        if (!ignore) setError(e);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [query, role, status, page, version, user?.role]);
  if (user?.role !== "Admin") return <Navigate to="/workspace" replace />;
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-xl bg-mint text-brand">
          <UsersIcon size={23} />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            User management
          </h1>
          <p className="mt-2 text-sm text-muted">
            The right access for every person in the network.
          </p>
        </div>
      </div>
      <Notice error={error} />
      {message && <Notice>{message}</Notice>}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
          <div>
            <h2 className="font-semibold">Network accounts</h2>
            <p className="mt-1 text-xs text-muted">
              {data ? `${data.total} matching accounts` : "Loading accounts…"}
            </p>
          </div>
          <span className="badge">
            <ShieldCheck size={13} /> Administrator only
          </span>
        </div>
        <div className="flex flex-wrap gap-3 border-b border-line p-5">
          <form
            className="flex w-full min-w-0 gap-2 sm:min-w-[240px] sm:flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(
                String(new FormData(e.currentTarget).get("search") || ""),
              );
              setPage(1);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="absolute top-3.5 left-3 text-muted"
              />
              <input
                name="search"
                className="input pl-9"
                placeholder="Search name or email"
                aria-label="Search users"
                maxLength={100}
              />
            </div>
            <Button variant="secondary" type="submit">
              Search
            </Button>
          </form>
          <select
            className="input w-auto flex-1 sm:flex-none"
            aria-label="Filter by role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {roles.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            className="input w-auto flex-1 sm:flex-none"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending_verification">Pending verification</option>
            <option value="pending_approval">Awaiting NGO approval</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="bg-paper text-muted">
              <tr>
                {["Name", "Role", "Status", "Joined", "Access"].map((title) => (
                  <th className="px-5 py-4 font-medium" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted">
                    Loading accounts…
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span className="avatar">
                          {item.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-muted">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5">{item.role}</td>
                    <td className="px-5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.status === "active" ? "bg-mint text-brand" : item.status === "suspended" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                      >
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-5">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5">
                      {item.role === "Admin" ? (
                        <span className="text-muted">Protected admin</span>
                      ) : !item.email_verified ? (
                        <span className="text-muted">
                          Verification required
                        </span>
                      ) : (
                        <button
                          className="font-semibold text-brand"
                          onClick={() => {
                            setSelected(item);
                            setMessage("");
                          }}
                        >
                          Manage access
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-muted">
                    No accounts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line p-5 text-xs text-muted">
          <p>
            Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / 10))}
          </p>
          <div className="flex gap-2">
            <button
              className="pagination"
              aria-label="Previous page"
              disabled={page === 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="pagination"
              aria-label="Next page"
              disabled={!data || page * 10 >= data.total || loading}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <AccessDialog
          user={selected}
          close={() => setSelected(null)}
          saved={() => {
            setSelected(null);
            setMessage("Account access updated. Previous sessions have ended.");
            setVersion(version + 1);
          }}
        />
      )}
    </div>
  );
}
