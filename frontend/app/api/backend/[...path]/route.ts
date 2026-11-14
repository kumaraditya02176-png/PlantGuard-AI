import { NextResponse } from "next/server"
import {
  backendApiUrl,
  authConfigurationReady,
  configuredMutationToken,
  csrfTokenMatches,
  isBackendOperatorTokenAccepted,
  isSameOriginRequest,
  mutationSessionCookieName,
  readOperatorSession,
  readBoundedBody,
} from "@/lib/server-auth"

export const runtime = "nodejs"

const readRoutes = new Set([
  "/health",
  "/api/v1/dashboard",
  "/api/v1/sensors/latest",
  "/api/v1/sensors/history",
  "/api/v1/risk/latest",
  "/api/v1/advisory/latest",
  "/api/v1/metrics",
  "/api/v1/roi",
  "/docs",
  "/openapi.json",
])
const mutationRoutes = new Set([
  "/api/v1/advisories/apply",
  "/api/v1/simulation/reset",
  "/api/v1/simulation/inject",
  "/api/v1/simulation/advance",
])
type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context, "GET")
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context, "POST")
}

async function proxyRequest(request: Request, context: RouteContext, method: "GET" | "POST") {
  const { path } = await context.params
  const upstreamPath = `/${path.join("/")}`
  const permitted = method === "GET" ? readRoutes.has(upstreamPath) : mutationRoutes.has(upstreamPath)
  if (!permitted) return NextResponse.json({ detail: "API route is not available through this application." }, { status: 404 })

  const headers = new Headers({ Accept: "application/json" })
  let body: string | undefined
  if (method === "POST") {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ detail: "Same-origin mutation is required." }, { status: 403 })
    }
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return NextResponse.json({ detail: "Mutation requests must use application/json." }, { status: 415 })
    }
    if (!authConfigurationReady()) {
      return NextResponse.json({ detail: "Operator authentication is not fully configured on the server." }, { status: 503 })
    }
    const token = configuredMutationToken()
    if (!token) {
      return NextResponse.json({ detail: "Simulation mutations are disabled because operator authentication is not configured." }, { status: 503 })
    }
    let session
    try {
      session = await readOperatorSession(readSessionId(request))
    } catch {
      return NextResponse.json({ detail: "Authentication session service is unavailable." }, { status: 503 })
    }
    if (!session) {
      return NextResponse.json({ detail: "Authorize as an operator before changing simulated state." }, { status: 401 })
    }
    if (!csrfTokenMatches(request.headers.get("x-csrf-token"), session.csrfToken)) {
      return NextResponse.json({ detail: "A valid CSRF token is required for simulated changes." }, { status: 403 })
    }

    if (Number(request.headers.get("content-length") ?? 0) > 8192) {
      return NextResponse.json({ detail: "Mutation request is too large." }, { status: 413 })
    }
    body = await readBoundedBody(request, 8192) ?? undefined
    if (body === undefined) {
      return NextResponse.json({ detail: "Mutation request is too large." }, { status: 413 })
    }
    const backendUrl = backendApiUrl(request)
    if (!backendUrl) {
      return NextResponse.json({ detail: "Backend API URL is not configured correctly." }, { status: 503 })
    }
    try {
      if (!await isBackendOperatorTokenAccepted(backendUrl, token)) {
        return NextResponse.json({ detail: "Backend did not confirm operator-token enforcement; simulated changes remain disabled." }, { status: 503 })
      }
    } catch {
      return NextResponse.json({ detail: "Backend is unavailable; simulated changes remain disabled." }, { status: 503 })
    }
    headers.set("Content-Type", request.headers.get("content-type") ?? "application/json")
    headers.set("Authorization", `Bearer ${token}`)
  }

  const upstream = backendApiUrl(request)
  if (!upstream) {
    return NextResponse.json({ detail: "Backend API URL is not configured correctly." }, { status: 503 })
  }
  upstream.pathname = upstreamPath
  upstream.search = new URL(request.url).search

  try {
    const response = await fetch(upstream, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    })
    const responseBody = await response.text()
    const contentType = response.headers.get("content-type") ?? "application/json"
    const output = contentType.includes("text/html") && upstreamPath === "/docs"
      ? responseBody.replaceAll("/openapi.json", "/api/backend/openapi.json")
      : responseBody
    return new Response(output, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ detail: "Backend API is unavailable." }, { status: 502 })
  }
}

function isJsonContentType(value: string | null): boolean {
  return value?.split(";")[0].trim().toLowerCase() === "application/json"
}

function readSessionId(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...parts] = cookie.trim().split("=")
    if (name === mutationSessionCookieName()) return parts.join("=")
  }
  return undefined
}
