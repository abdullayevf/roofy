/**
 * Prototype session plumbing (server-only): who is signed in (cookie `roofy_role`), which demo
 * session's store to use (cookie `roofy_demo`) and which `?demo=` state to force.
 *
 * - Reading works everywhere on the server: Server Components, Server Functions, Route Handlers.
 * - Setting cookies only works in a Server Function or Route Handler (`ensureDemoSession`, the
 *   `/prototype/role` route). A request without `roofy_demo` still renders, from the shared,
 *   read-only seed store; the first write (Task 7) or a role switch gives the browser its own store.
 */
import { cookies, headers } from "next/headers";
import type { Role } from "./contracts";

// `server-only` isn't installed; this is the same guard at runtime.
if (typeof window !== "undefined") throw new Error("src/data/session.ts is server-only.");

export const ROLE_COOKIE = "roofy_role";
export const DEMO_COOKIE = "roofy_demo";
/** Copied from `?demo=` by `src/proxy.ts`, so layouts (which get no searchParams) see the state. */
export const DEMO_HEADER = "x-roofy-demo";

export const ROLES: readonly Role[] = ["owner", "manager", "foreman", "accountant"];
export const DEFAULT_ROLE: Role = "manager";

/** Prototype cookies: HTTP-only, same-site, 30 days; `Secure` is added when the request is https. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

/** A `Set-Cookie` value for a prototype cookie (Route Handlers that build their own Response). */
export function serializeSessionCookie(name: string, value: string, secure: boolean): string {
  const o = SESSION_COOKIE_OPTIONS;
  return `${name}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

const DEMO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A demo session id is a random UUID v4 (anything else is ignored, as if absent). */
export function isDemoSessionId(value: unknown): value is string {
  return typeof value === "string" && DEMO_ID.test(value);
}

export function newDemoSessionId(): string {
  return crypto.randomUUID();
}

/**
 * A same-origin path to go to after a role switch, else "/". Refuses absolute URLs, backslashes,
 * control characters and anything that is — or normalises or decodes to — protocol-relative
 * ("//evil", "/.//evil", "/a/..//evil"); encoded slashes (%2F, %5C) are refused outright. Any doubt → "/".
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.includes("\\") || [...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f))
    return "/";
  const base = "http://roofy.invalid";
  let url: URL;
  let decoded: string;
  try {
    url = new URL(value, base);
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return "/";
  }
  const risky = (path: string) => path.startsWith("//") || path.includes("\\");
  if (url.origin !== base || risky(url.pathname) || risky(decoded) || /%2f|%5c/i.test(url.pathname))
    return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Was this request made over https (directly or behind a proxy)? Decides the `Secure` flag. */
export function isHttps(url: string, requestHeaders: Headers): boolean {
  if (url.startsWith("https:")) return true;
  const forwarded = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwarded === "https";
}

export interface PrototypeSession {
  role: Role;
  /** Null: no demo session yet → the shared read-only seed store. */
  demoSessionId: string | null;
}

export async function readSession(): Promise<PrototypeSession> {
  const jar = await cookies();
  const id = jar.get(DEMO_COOKIE)?.value;
  return {
    role: parseRole(jar.get(ROLE_COOKIE)?.value) ?? DEFAULT_ROLE,
    demoSessionId: isDemoSessionId(id) ? id : null,
  };
}

/**
 * The demo session id, creating the cookie when missing. Server Functions and Route Handlers only
 * (Next can't set cookies while a Server Component renders). Task 7's writes call this first.
 */
export async function ensureDemoSession(): Promise<string> {
  const jar = await cookies();
  const id = jar.get(DEMO_COOKIE)?.value;
  if (isDemoSessionId(id)) return id;
  const created = newDemoSessionId();
  jar.set(DEMO_COOKIE, created, { ...SESSION_COOKIE_OPTIONS, secure: isHttps("", await headers()) });
  return created;
}

export type SearchParams = Record<string, string | string[] | undefined>;
/** A page's `searchParams` (a Promise in Next 16), a plain record, or URLSearchParams (route handlers). */
export type SearchParamsInput = SearchParams | URLSearchParams | Promise<SearchParams>;

/** The raw `demo` query value: from `searchParams` when given, else the proxy's request header. */
export async function readDemoParam(searchParams?: SearchParamsInput): Promise<string | string[] | null> {
  if (searchParams !== undefined) {
    const params = await searchParams;
    if (params instanceof URLSearchParams) return params.get("demo");
    return params.demo ?? null;
  }
  return (await headers()).get(DEMO_HEADER);
}
