import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createClient } from "redis"

const frontendUrl = required("PHASE10_3_FRONTEND_URL")
const backendUrl = required("PHASE10_3_BACKEND_URL")
const sessionStoreUrl = required("PLANTGUARD_SESSION_STORE_URL")
const mutationToken = required("PLANTGUARD_MUTATION_TOKEN")
const operatorUsername = required("PLANTGUARD_OPERATOR_USERNAME")
const operatorPassword = required("PHASE10_3_OPERATOR_PASSWORD")
const expectedSecureCookie = process.env.PHASE10_3_EXPECT_SECURE === "true"
const publicOrigin = new URL(required("PLANTGUARD_PUBLIC_ORIGIN")).origin
const redis = createClient({ url: sessionStoreUrl })
redis.on("error", () => console.error("Test session store connection failed."))
await redis.connect()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required test configuration: ${name}`)
  return value
}

function requestHeaders(origin = publicOrigin) {
  const headers = { origin, "sec-fetch-site": "same-origin" }
  if (expectedSecureCookie) headers["x-forwarded-proto"] = "https"
  return headers
}

async function login(username = operatorUsername, password = operatorPassword, origin = publicOrigin, cookie) {
  const headers = { ...requestHeaders(origin), "content-type": "application/json" }
  if (cookie) headers.cookie = cookie
  return fetch(new URL("/api/auth", frontendUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({ username, password }),
  })
}

async function sensorSnapshot() {
  const response = await fetch(new URL("/api/backend/api/v1/sensors/latest", frontendUrl))
  assert.equal(response.status, 200)
  return response.json()
}

async function main() {
  assert.equal((await fetch(new URL("/health", backendUrl))).status, 200)

  const missingCredentials = await fetch(new URL("/api/auth", frontendUrl), {
    method: "POST",
    headers: { ...requestHeaders(), "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  assert.equal(missingCredentials.status, 400)
  console.log("PASS missing login fields rejected")

  const untrustedLogin = await login(operatorUsername, operatorPassword, "https://untrusted.invalid")
  assert.equal(untrustedLogin.status, 403)
  console.log("PASS untrusted login Origin rejected")

  const invalidCredentials = await login(operatorUsername, `${operatorPassword}-invalid`)
  assert.equal(invalidCredentials.status, 401)
  assert.doesNotMatch(await invalidCredentials.clone().text(), new RegExp(mutationToken))

  const beforeUnauthorized = await sensorSnapshot()
  const unauthorizedMutation = await fetch(new URL("/api/backend/api/v1/simulation/reset", frontendUrl), {
    method: "POST",
    headers: { ...requestHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ scenario: "overheating" }),
  })
  assert.equal(unauthorizedMutation.status, 401)
  assert.deepEqual(await sensorSnapshot(), beforeUnauthorized)
  console.log("PASS invalid credentials and unauthorized mutation rejected without state change")

  const loginResponse = await login()
  assert.equal(loginResponse.status, 200)
  let loginBody = await loginResponse.json()
  assert.equal(loginBody.authorized, true)
  assert.equal(typeof loginBody.csrfToken, "string")
  const setCookieHeaders = loginResponse.headers.getSetCookie()
  const cookieHeader = setCookieHeaders.find((value) => value.startsWith(expectedSecureCookie
    ? "__Host-plantguard-session="
    : "plantguard-session="))
  assert.ok(cookieHeader, "session cookie should use the expected environment-specific name")
  assert.match(cookieHeader, /HttpOnly/i)
  assert.match(cookieHeader, /SameSite=Strict/i)
  assert.match(cookieHeader, /Path=\//i)
  assert.match(cookieHeader, /Max-Age=1800/i)
  assert.doesNotMatch(cookieHeader, /;\s*Domain=/i)
  assert.equal(/;\s*Secure(?:;|$)/i.test(cookieHeader), expectedSecureCookie)
  assert.doesNotMatch(JSON.stringify(loginBody) + setCookieHeaders.join(";"), new RegExp(mutationToken))
  let cookiePair = cookieHeader.split(";")[0]
  const sessionId = cookiePair.slice(cookiePair.indexOf("=") + 1)
  let sessionKey = `pg:session:${createHash("sha256").update(sessionId).digest("hex")}`
  assert.ok(await redis.exists(sessionKey))
  console.log("PASS valid login creates opaque Redis session and correct cookie attributes")

  const sessionCookieName = expectedSecureCookie ? "__Host-plantguard-session" : "plantguard-session"
  const invalidSession = await fetch(new URL("/api/auth", frontendUrl), {
    headers: { ...requestHeaders(), cookie: `${sessionCookieName}=${"x".repeat(43)}` },
  })
  assert.equal(invalidSession.status, 200)
  assert.equal((await invalidSession.json()).authorized, false)
  console.log("PASS invalid session is rejected")

  const rotatedLogin = await login(operatorUsername, operatorPassword, publicOrigin, cookiePair)
  assert.equal(rotatedLogin.status, 200)
  const rotatedBody = await rotatedLogin.json()
  const rotatedCookieHeader = rotatedLogin.headers.getSetCookie().find((value) => value.startsWith(expectedSecureCookie
    ? "__Host-plantguard-session="
    : "plantguard-session="))
  assert.ok(rotatedCookieHeader)
  const rotatedCookiePair = rotatedCookieHeader.split(";")[0]
  const rotatedSessionId = rotatedCookiePair.slice(rotatedCookiePair.indexOf("=") + 1)
  const previousSessionKey = sessionKey
  assert.notEqual(rotatedCookiePair, cookiePair)
  assert.equal(await redis.exists(previousSessionKey), 0)
  const previousSessionStatus = await fetch(new URL("/api/auth", frontendUrl), {
    headers: { ...requestHeaders(), cookie: cookiePair },
  })
  assert.equal(previousSessionStatus.status, 200)
  assert.equal((await previousSessionStatus.json()).authorized, false)
  cookiePair = rotatedCookiePair
  sessionKey = `pg:session:${createHash("sha256").update(rotatedSessionId).digest("hex")}`
  loginBody = rotatedBody
  assert.equal(await redis.exists(sessionKey), 1)
  console.log("PASS successful reauthentication rotates and invalidates the previous session")

  const settingsResponse = await fetch(new URL("/settings", frontendUrl))
  assert.equal(settingsResponse.status, 200)
  const html = await settingsResponse.text()
  assert.ok(!html.includes(mutationToken))
  const scriptPaths = [...html.matchAll(/src="([^"]+\.js(?:\?[^"]*)?)"/g)].map((match) => match[1])
  const staticBundles = await Promise.all(scriptPaths.map(async (path) => {
    const response = await fetch(new URL(path, frontendUrl))
    assert.equal(response.status, 200)
    return response.text()
  }))
  assert.ok(staticBundles.every((bundle) => !bundle.includes(mutationToken)))
  assert.ok(staticBundles.every((bundle) => !bundle.includes("PLANTGUARD_MUTATION_TOKEN")))
  console.log("PASS backend token absent from delivered HTML and fetched frontend bundles")

  const noCsrf = await fetch(new URL("/api/backend/api/v1/simulation/reset", frontendUrl), {
    method: "POST",
    headers: { ...requestHeaders(), cookie: cookiePair, "content-type": "application/json" },
    body: JSON.stringify({ scenario: "overheating" }),
  })
  assert.equal(noCsrf.status, 403)
  const wrongOrigin = await fetch(new URL("/api/backend/api/v1/simulation/reset", frontendUrl), {
    method: "POST",
    headers: {
      ...requestHeaders("https://untrusted.invalid"),
      cookie: cookiePair,
      "x-csrf-token": loginBody.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ scenario: "overheating" }),
  })
  assert.equal(wrongOrigin.status, 403)
  const wrongCsrf = await fetch(new URL("/api/backend/api/v1/simulation/reset", frontendUrl), {
    method: "POST",
    headers: {
      ...requestHeaders(),
      cookie: cookiePair,
      "x-csrf-token": "invalid",
      "content-type": "application/json",
    },
    body: JSON.stringify({ scenario: "overheating" }),
  })
  assert.equal(wrongCsrf.status, 403)
  console.log("PASS missing/invalid CSRF and untrusted mutation Origin rejected")

  const dashboardResponse = await fetch(new URL("/api/backend/api/v1/dashboard", frontendUrl))
  assert.equal(dashboardResponse.status, 200)
  const activeScenario = (await dashboardResponse.json()).simulation.active_scenario?.type
  const nextScenario = activeScenario === "overheating" ? "normal" : "overheating"
  const reset = await fetch(new URL("/api/backend/api/v1/simulation/reset", frontendUrl), {
    method: "POST",
    headers: {
      ...requestHeaders(),
      cookie: cookiePair,
      "x-csrf-token": loginBody.csrfToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ scenario: nextScenario }),
  })
  assert.equal(reset.status, 200)
  assert.notDeepEqual(await sensorSnapshot(), beforeUnauthorized)
  console.log("PASS authorized CSRF-protected simulator mutation")

  await redis.expire(sessionKey, 1)
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const expiredStatus = await fetch(new URL("/api/auth", frontendUrl), {
    headers: { ...requestHeaders(), cookie: cookiePair },
  })
  assert.equal(expiredStatus.status, 200)
  assert.equal((await expiredStatus.json()).authorized, false)
  console.log("PASS expired server-side session rejected")

  const logoutLogin = await login()
  assert.equal(logoutLogin.status, 200)
  const logoutBody = await logoutLogin.json()
  const logoutCookie = logoutLogin.headers.getSetCookie().find((value) => value.startsWith(expectedSecureCookie
    ? "__Host-plantguard-session="
    : "plantguard-session="))
  const logoutPair = logoutCookie.split(";")[0]
  const logoutId = logoutPair.slice(logoutPair.indexOf("=") + 1)
  const logoutKey = `pg:session:${createHash("sha256").update(logoutId).digest("hex")}`
  const missingLogoutCsrf = await fetch(new URL("/api/auth", frontendUrl), {
    method: "DELETE",
    headers: { ...requestHeaders(), cookie: logoutPair },
  })
  assert.equal(missingLogoutCsrf.status, 403)
  assert.equal(await redis.exists(logoutKey), 1)
  const logoutResponse = await fetch(new URL("/api/auth", frontendUrl), {
    method: "DELETE",
    headers: { ...requestHeaders(), cookie: logoutPair, "x-csrf-token": logoutBody.csrfToken },
  })
  assert.equal(logoutResponse.status, 200)
  assert.equal(await redis.exists(logoutKey), 0)
  assert.equal((await (await fetch(new URL("/api/auth", frontendUrl), {
    headers: { ...requestHeaders(), cookie: logoutPair },
  })).json()).authorized, false)
  console.log("PASS logout deletes and invalidates server-side session")

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await login(operatorUsername, `${operatorPassword}-bad-${attempt}`)).status, 401)
  }
  const rateLimited = await login(operatorUsername, `${operatorPassword}-bad-final`)
  assert.equal(rateLimited.status, 429)
  assert.equal(rateLimited.headers.get("retry-after"), "900")
  console.log("PASS login attempt rate limit enforced")

  const redisOutageFrontendUrl = process.env.PHASE10_3_REDIS_OUTAGE_FRONTEND_URL
  if (redisOutageFrontendUrl) {
    const outageOrigin = new URL(redisOutageFrontendUrl).origin
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const startedAt = Date.now()
      const response = await fetch(new URL("/api/auth", redisOutageFrontendUrl), {
        method: "POST",
        headers: { ...requestHeaders(outageOrigin), "content-type": "application/json" },
        body: JSON.stringify({ username: operatorUsername, password: operatorPassword }),
        signal: AbortSignal.timeout(8_000),
      })
      assert.equal(response.status, 503)
      assert.equal((await response.json()).detail, "Authentication service is unavailable.")
      assert.equal(response.headers.getSetCookie().length, 0)
      assert.ok(Date.now() - startedAt < 8_000)
    }
    console.log("PASS Redis outage fails closed without issuing a session")
  }

  console.log("PASS API test completed without printing credentials")
}

try {
  await main()
} finally {
  await redis.quit()
}
