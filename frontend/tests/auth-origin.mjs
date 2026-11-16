import assert from "node:assert/strict"
import { request as httpRequest } from "node:http"
import { test } from "node:test"

const frontendUrl = process.env.PHASE10_3_FRONTEND_URL ?? "http://127.0.0.1:3102"
const canonicalOrigin = "http://127.0.0.1:3102"
assert.equal(new URL(frontendUrl).origin, canonicalOrigin)

async function probe(headers) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL("/api/auth", frontendUrl), {
      method: "POST",
      headers: { "content-type": "text/plain", "sec-fetch-site": "same-origin", ...headers },
    }, (response) => {
      response.resume()
      resolve(response.statusCode)
    })
    request.on("error", reject)
    request.end("origin-check")
  })
}

test("canonical browser origin passes the origin gate", async () => {
  assert.equal(await probe({ origin: canonicalOrigin }), 415)
})

test("localhost origin is rejected", async () => {
  assert.equal(await probe({ origin: "http://localhost:3102" }), 403)
})

test("mismatched Host is rejected", async () => {
  assert.equal(await probe({ origin: canonicalOrigin, host: "localhost:3102" }), 403)
})

test("mismatched forwarded host and protocol are rejected", async () => {
  const wrongHost = await probe({ origin: canonicalOrigin, "x-forwarded-host": "localhost:3102" })
  const wrongProtocol = await probe({ origin: canonicalOrigin, "x-forwarded-proto": "https" })
  assert.equal(wrongHost, 403)
  assert.equal(wrongProtocol, 403)
})
