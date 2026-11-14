import { NextResponse } from "next/server"
import {
  authConfigurationReady,
  backendApiUrl,
  configuredMutationToken,
  consumeLoginAttemptLimit,
  createOperatorSession,
  csrfTokenMatches,
  deleteOperatorSession,
  isBackendOperatorTokenAccepted,
  isSameOriginRequest,
  LOGIN_WINDOW_SECONDS,
  mutationCookieOptions,
  mutationSessionCookieName,
  readBoundedBody,
  readOperatorSession,
  resetLoginAttemptLimit,
  verifyOperatorCredentials,
} from "@/lib/server-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  if (!authConfigurationReady()) {
    return NextResponse.json({ detail: "Operator authentication is not fully configured on the server." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    })
  }
  try {
    const session = await readOperatorSession(readSessionId(request))
    return NextResponse.json(
      { authorized: Boolean(session), csrfToken: session?.csrfToken ?? null },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ detail: "Authentication session service is unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    })
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Same-origin authentication is required." }, { status: 403 })
  }
  if (!authConfigurationReady()) {
    return NextResponse.json({ detail: "Operator authentication is not fully configured on the server." }, { status: 503 })
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return NextResponse.json({ detail: "Authentication requests must use application/json." }, { status: 415 })
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > 4096) {
    return NextResponse.json({ detail: "Authentication request is too large." }, { status: 413 })
  }
  const bodyText = await readBoundedBody(request, 4096)
  if (bodyText === null) {
    return NextResponse.json({ detail: "Authentication request is too large." }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(bodyText) as unknown
  } catch {
    return NextResponse.json({ detail: "A valid JSON authentication request is required." }, { status: 400 })
  }
  if (
    typeof body !== "object"
    || body === null
    || !("username" in body)
    || !("password" in body)
    || typeof body.username !== "string"
    || typeof body.password !== "string"
    || body.username.length > 128
    || body.password.length > 1024
    || Object.keys(body).some((key) => key !== "username" && key !== "password")
  ) {
    return NextResponse.json({ detail: "A valid username and password are required." }, { status: 400 })
  }

  let allowed: boolean
  try {
    allowed = await consumeLoginAttemptLimit(request, body.username)
  } catch {
    return NextResponse.json({ detail: "Authentication service is unavailable." }, { status: 503 })
  }
  if (!allowed) {
    return NextResponse.json({ detail: "Too many authentication attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(LOGIN_WINDOW_SECONDS) },
    })
  }

  let credentialsValid: boolean
  try {
    credentialsValid = await verifyOperatorCredentials(body.username, body.password)
  } catch {
    return NextResponse.json({ detail: "Authentication service is unavailable." }, { status: 503 })
  }
  if (!credentialsValid) {
    return NextResponse.json({ detail: "Operator credentials were not accepted." }, { status: 401 })
  }

  const token = configuredMutationToken()
  const backendUrl = backendApiUrl(request)
  if (!token || !backendUrl) {
    return NextResponse.json({ detail: "Protected simulator actions are not configured on the server." }, { status: 503 })
  }
  let backendTokenAccepted: boolean
  try {
    backendTokenAccepted = await isBackendOperatorTokenAccepted(backendUrl, token)
  } catch {
    return NextResponse.json({ detail: "Backend is unavailable; no operator session was created." }, { status: 503 })
  }
  if (!backendTokenAccepted) {
    return NextResponse.json({ detail: "Backend did not confirm operator-token enforcement; simulated changes remain disabled." }, { status: 503 })
  }

  try {
    await deleteOperatorSession(readSessionId(request))
    await resetLoginAttemptLimit(request, body.username)
    const { id, session } = await createOperatorSession()
    const response = NextResponse.json(
      { authorized: true, csrfToken: session.csrfToken },
      { headers: { "Cache-Control": "no-store" } },
    )
    response.cookies.set(mutationSessionCookieName(), id, mutationCookieOptions())
    return response
  } catch {
    return NextResponse.json({ detail: "Authentication service is unavailable." }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Same-origin logout is required." }, { status: 403 })
  }
  const id = readSessionId(request)
  try {
    const session = await readOperatorSession(id)
    if (session && !csrfTokenMatches(request.headers.get("x-csrf-token"), session.csrfToken)) {
      return NextResponse.json({ detail: "A valid CSRF token is required to log out." }, { status: 403 })
    }
    await deleteOperatorSession(id)
    const response = NextResponse.json({ authorized: false }, { headers: { "Cache-Control": "no-store" } })
    response.cookies.set(mutationSessionCookieName(), "", { ...mutationCookieOptions(), maxAge: 0 })
    return response
  } catch {
    return NextResponse.json({ detail: "Authentication session could not be revoked." }, { status: 503 })
  }
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

function isJsonContentType(value: string | null): boolean {
  return value?.split(";")[0].trim().toLowerCase() === "application/json"
}
