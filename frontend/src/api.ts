export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const csrf = document.cookie
    .split("; ")
    .find((item) => item.startsWith("rahma_csrf="))
    ?.slice("rahma_csrf=".length);
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (csrf && options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "We couldn’t reach RAHMA. Check your connection and try again.",
      0,
    );
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.endsWith("/login"))
      window.dispatchEvent(new Event("rahma:session-ended"));
    throw new ApiError(
      body.message || "Something went wrong. Please try again.",
      response.status,
      body.errors,
    );
  }
  return body as T;
}
