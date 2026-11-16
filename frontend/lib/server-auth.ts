import "server-only"
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import { createClient, type RedisClientType } from "redis"

export const MUTATION_SESSION_COOKIE = "plantguard-session"
export const MUTATION_SESSION_SECONDS = 30 * 60
export const LOGIN_ATTEMPT_LIMIT = 5
export const LOGIN_WINDOW_SECONDS = 15 * 60
const LOCAL_DEMO_ORIGIN = "http://127.0.0.1:3102"
const LOCAL_DEMO_HOST = "127.0.0.1:3102"

type OperatorSession = {
  csrfToken: string
  createdAt: number
}

let redisClientPromise: Promise<RedisClientType> | null = null

export function backendApiUrl(request: Request): URL | null {
  const configured = process.env.PLANTGUARD_API_URL
  let value = configured
  if (value === undefined && process.env.NODE_ENV !== "production") {
    value = "http://127.0.0.1:8001"
  }
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export function configuredMutationToken(): string | null {
  const token = process.env.PLANTGUARD_MUTATION_TOKEN
  return token && token.length >= 32 ? token : null
}

export function authConfigurationReady(): boolean {
  const expectedUsername = process.env.PLANTGUARD_OPERATOR_USERNAME
  const passwordHash = parsePasswordHash(process.env.PLANTGUARD_OPERATOR_PASSWORD_HASH)
  const sessionStoreUrl = parseSessionStoreUrl()
  const publicOrigin = configuredPublicOrigin()
  const secure = process.env.PLANTGUARD_COOKIE_SECURE
  const productionSessionStoreReady = process.env.PLANTGUARD_AUTH_ENV !== "production"
    || Boolean(sessionStoreUrl?.protocol === "rediss:" && sessionStoreUrl.password)
  const cookieConfigurationValid = process.env.PLANTGUARD_AUTH_ENV === "production"
    ? secure === "true" && publicOrigin?.protocol === "https:"
    : process.env.PLANTGUARD_AUTH_ENV === "development"
      && secure === "false"
      && isLoopbackOrigin(publicOrigin)

  return Boolean(
    configuredMutationToken()
    && expectedUsername
    && expectedUsername.length <= 128
    && passwordHash
    && sessionStoreUrl
    && publicOrigin
    && productionSessionStoreReady
    && cookieConfigurationValid,
  )
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin")
  const fetchSite = request.headers.get("sec-fetch-site")
  const expected = configuredPublicOrigin()
  if (!origin || !expected || fetchSite && fetchSite !== "same-origin") return false
  try {
    const requestUrl = new URL(request.url)
    const authEnvironment = process.env.PLANTGUARD_AUTH_ENV
    const trustProxy = process.env.PLANTGUARD_TRUST_PROXY === "true"
    const forwardedHost = request.headers.get("x-forwarded-host")
    const forwardedProtocol = request.headers.get("x-forwarded-proto")
    if (authEnvironment === "development") {
      // Next can reconstruct Request.url with its internal hostname instead of the incoming Host.
      if (
        expected.origin !== LOCAL_DEMO_ORIGIN
        || requestUrl.protocol !== "http:"
        || request.headers.get("host") !== LOCAL_DEMO_HOST
        || (forwardedHost !== null && forwardedHost !== LOCAL_DEMO_HOST)
        || (forwardedProtocol !== null && forwardedProtocol !== "http")
      ) return false
    }
    if (authEnvironment === "production" && forwardedProtocol && !trustProxy) return false
    const secureTransport = requestUrl.protocol === "https:"
      || trustProxy && forwardedProtocol === "https"
    if (authEnvironment === "production" && !secureTransport) return false
    return new URL(origin).origin === expected.origin && origin === expected.origin
  } catch {
    return false
  }
}

export function mutationCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.PLANTGUARD_COOKIE_SECURE === "true" || process.env.PLANTGUARD_AUTH_ENV === "production",
    path: "/",
    maxAge: MUTATION_SESSION_SECONDS,
  }
}

export function mutationSessionCookieName(): string {
  return process.env.PLANTGUARD_AUTH_ENV === "production"
    ? "__Host-plantguard-session"
    : MUTATION_SESSION_COOKIE
}

export async function createOperatorSession(): Promise<{ id: string; session: OperatorSession }> {
  const id = randomBytes(32).toString("base64url")
  const session = { csrfToken: randomBytes(32).toString("base64url"), createdAt: Date.now() }
  await (await sessionStore()).set(sessionKey(id), JSON.stringify(session), { EX: MUTATION_SESSION_SECONDS })
  return { id, session }
}

export async function readOperatorSession(id: string | undefined): Promise<OperatorSession | null> {
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null
  const serialized = await (await sessionStore()).get(sessionKey(id))
  if (!serialized) return null
  try {
    const session = JSON.parse(serialized) as Partial<OperatorSession>
    return typeof session.csrfToken === "string"
      && /^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)
      && typeof session.createdAt === "number"
      ? { csrfToken: session.csrfToken, createdAt: session.createdAt }
      : null
  } catch {
    return null
  }
}

export async function deleteOperatorSession(id: string | undefined): Promise<void> {
  if (id && /^[A-Za-z0-9_-]{43}$/.test(id)) {
    await (await sessionStore()).del(sessionKey(id))
  }
}

export function csrfTokenMatches(supplied: string | null, expected: string): boolean {
  if (!supplied || supplied.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

export async function consumeLoginAttemptLimit(request: Request, username: string): Promise<boolean> {
  const client = await sessionStore()
  const ip = clientAddressKey(request)
  const usernameKey = createHash("sha256").update(username.toLowerCase()).digest("hex")
  const keys = [`pg:login:ip:${ip}`, `pg:login:user:${ip}:${usernameKey}`]
  const counts = await client.eval(
    "local a=redis.call('INCR',KEYS[1]); if a==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; local b=redis.call('INCR',KEYS[2]); if b==1 then redis.call('EXPIRE',KEYS[2],ARGV[1]) end; return {a,b}",
    { keys, arguments: [String(LOGIN_WINDOW_SECONDS)] },
  )
  return Array.isArray(counts)
    && counts.every((count) => typeof count === "number" && count <= LOGIN_ATTEMPT_LIMIT)
}

export async function resetLoginAttemptLimit(request: Request, username: string): Promise<void> {
  const client = await sessionStore()
  const ip = clientAddressKey(request)
  const usernameKey = createHash("sha256").update(username.toLowerCase()).digest("hex")
  await client.del([`pg:login:ip:${ip}`, `pg:login:user:${ip}:${usernameKey}`])
}

export async function verifyOperatorCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = process.env.PLANTGUARD_OPERATOR_USERNAME
  const passwordHash = parsePasswordHash(process.env.PLANTGUARD_OPERATOR_PASSWORD_HASH)
  if (!expectedUsername || !passwordHash || username.length > 128 || password.length > 1024) return false

  const derived = await derivePassword(password, passwordHash.salt)
  const usernameBytes = Buffer.from(username)
  const expectedUsernameBytes = Buffer.from(expectedUsername)
  const usernameMatches = usernameBytes.length === expectedUsernameBytes.length
    && timingSafeEqual(usernameBytes, expectedUsernameBytes)
  const passwordMatches = timingSafeEqual(derived, passwordHash.digest)
  return usernameMatches && passwordMatches
}

export async function isBackendOperatorTokenAccepted(baseUrl: URL, token: string): Promise<boolean> {
  const response = await fetch(new URL("/api/v1/auth/status", baseUrl), {
    headers: { Accept: "application/json", Authorization: ["Bearer", token].join(" ") },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return false
  let body: unknown
  try {
    body = await response.json() as unknown
  } catch {
    return false
  }
  return typeof body === "object" && body !== null && "authorized" in body
    && body.authorized === true
}

export async function readBoundedBody(request: Request, limit: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function configuredPublicOrigin(): URL | null {
  const value = process.env.PLANTGUARD_PUBLIC_ORIGIN
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.origin !== value
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null
    if (process.env.PLANTGUARD_AUTH_ENV === "production" && url.protocol !== "https:") return null
    if (process.env.PLANTGUARD_AUTH_ENV === "development" && !isLoopbackOrigin(url)) return null
    return url
  } catch {
    return null
  }
}

function isLoopbackOrigin(url: URL | null): boolean {
  return url?.origin === LOCAL_DEMO_ORIGIN
}

function parseSessionStoreUrl(): URL | null {
  const value = process.env.PLANTGUARD_SESSION_STORE_URL
  if (!value) return null
  try {
    const url = new URL(value)
    return ["redis:", "rediss:"].includes(url.protocol) && url.hostname ? url : null
  } catch {
    return null
  }
}

function parsePasswordHash(value: string | undefined): { salt: Buffer; digest: Buffer } | null {
  if (!value) return null
  const [algorithm, n, r, p, saltText, digestText, extra] = value.split("$")
  if (algorithm !== "scrypt" || n !== "32768" || r !== "8" || p !== "1" || !saltText || !digestText || extra !== undefined) {
    return null
  }
  try {
    const salt = Buffer.from(saltText, "base64url")
    const digest = Buffer.from(digestText, "base64url")
    return salt.length === 16 && digest.length === 64 ? { salt, digest } : null
  } catch {
    return null
  }
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

async function sessionStore(): Promise<RedisClientType> {
  if (redisClientPromise) return redisClientPromise
  const url = parseSessionStoreUrl()
  if (!url) throw new Error("Session store is not configured.")
  const client = createClient({
    url: url.toString(),
    socket: {
      connectTimeout: 2_500,
      socketTimeout: 5_000,
      reconnectStrategy: (retries) => retries < 2 ? 250 : false,
    },
  })
  client.on("error", () => console.error("Authentication session store connection failed."))
  const connection = client.connect().then(
    () => client,
    (error: unknown) => {
      if (redisClientPromise === connection) redisClientPromise = null
      throw error
    },
  )
  redisClientPromise = connection
  client.on("end", () => {
    if (redisClientPromise === connection) redisClientPromise = null
  })
  return connection
}

function sessionKey(id: string): string {
  return `pg:session:${createHash("sha256").update(id).digest("hex")}`
}

function clientAddressKey(request: Request): string {
  const forwarded = process.env.PLANTGUARD_TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    : undefined
  const candidate = forwarded && isIP(forwarded) ? forwarded : "local-or-untrusted-proxy"
  return createHash("sha256").update(candidate).digest("hex")
}
