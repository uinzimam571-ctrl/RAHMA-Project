import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  Droplets,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "./api";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/login"
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-ink"}`}
      aria-label="RAHMA home"
    >
      <span className="grid size-11 place-items-center rounded-xl bg-brand text-white">
        <Droplets size={25} />
      </span>
      <span>
        <b className="block text-2xl leading-7 tracking-[.18em]">RAHMA</b>
        <small
          className={`block text-[9px] tracking-[.18em] uppercase ${light ? "text-slate-400" : "text-muted"}`}
        >
          Flood Response Network
        </small>
      </span>
    </Link>
  );
}
export function Button({
  children,
  busy = false,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant === "secondary" ? "button-secondary" : ""} ${props.className || ""}`}
      aria-busy={busy}
    >
      {busy ? <LoaderCircle size={17} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
export function Field({
  label,
  name,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="relative block">
        <input
          {...props}
          name={name}
          type={props.type === "password" && visible ? "text" : props.type}
          className={`input ${props.type === "password" ? "pr-12" : ""}`}
        />
        {props.type === "password" && (
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(!visible)}
            className="absolute top-0 right-0 grid h-full w-12 place-items-center text-muted"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
    </label>
  );
}
export function Notice({
  error,
  children,
}: {
  error?: unknown;
  children?: ReactNode;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
      >
        {(error as Error).message || String(error)}
        {error instanceof ApiError && error.errors.length > 0 && (
          <ul className="mt-2 list-disc pl-4">
            {error.errors.map((item) => (
              <li key={item.field}>
                {item.field.replaceAll("_", " ")}: {item.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  return children ? (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
    >
      {children}
    </div>
  ) : null;
}
export function Success({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="py-8">
      <CheckCircle2 className="mb-6 text-brand" size={44} />
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4 leading-7 text-muted">{children}</div>
      <Link
        className="mt-8 inline-flex items-center gap-2 font-semibold text-brand"
        to="/login"
      >
        Back to sign in <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function NetworkMap() {
  return (
    <div
      className="network-map mt-10 rounded-2xl border border-white/10 p-5"
      aria-label="Illustration of a connected relief network in Pakistan"
    >
      <div className="flex justify-between text-[10px] tracking-[.17em] text-slate-400 uppercase">
        <span>Pakistan · Relief network</span>
        <span className="text-emerald-300">People connected</span>
      </div>
      <svg
        viewBox="0 0 420 245"
        className="mt-5 w-full"
        role="img"
        aria-label="Illustrated river connecting communities and relief partners"
      >
        <defs>
          <pattern
            id="grid"
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M26 0H0V26"
              fill="none"
              stroke="#ffffff"
              strokeOpacity=".045"
            />
          </pattern>
          <linearGradient id="river" x1="0" x2="1">
            <stop stopColor="#73dbc4" stopOpacity=".2" />
            <stop offset="1" stopColor="#73dbc4" stopOpacity=".8" />
          </linearGradient>
        </defs>
        <rect width="420" height="245" fill="url(#grid)" />
        <path
          d="M279 10 301 35 282 61 297 83 271 107 261 139 229 156 216 190 176 204 135 232 101 216 117 182 151 167 165 131 198 110 221 75 247 61 258 27Z"
          fill="#ffffff"
          fillOpacity=".035"
          stroke="#7caca7"
          strokeOpacity=".35"
        />
        <path
          d="M278 27C229 57 267 89 234 120S199 151 180 178 170 213 138 222"
          fill="none"
          stroke="url(#river)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M110 160 230 118 310 174M176 194 230 118 303 58"
          fill="none"
          stroke="#68cfac"
          strokeDasharray="3 5"
          strokeOpacity=".4"
        />
        {[
          [230, 118, "Coordination"],
          [176, 194, "Households"],
          [303, 58, "Volunteers"],
          [110, 160, "Relief partners"],
          [310, 174, "Donors"],
        ].map(([x, y, label]) => (
          <g key={label}>
            <circle cx={x} cy={y} r="13" fill="#45bd98" fillOpacity=".14" />
            <circle cx={x} cy={y} r="4" fill="#8de4c4" />
            <text
              x={Number(x) + 17}
              y={Number(y) + 4}
              fill="#b8cdd0"
              fontSize="9"
            >
              {label}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[10px] text-slate-500">
        Network illustration · Not a live operations map
      </p>
    </div>
  );
}
export function TrustNote() {
  return (
    <p className="flex items-center justify-center gap-2 text-xs text-muted">
      <ShieldCheck size={15} /> Your information stays protected and private.
    </p>
  );
}
