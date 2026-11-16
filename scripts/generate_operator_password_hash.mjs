import { randomBytes, scryptSync } from "node:crypto"

const passwordFromStdin = process.argv[2] === "--password-stdin"
if (process.argv.length > (passwordFromStdin ? 3 : 2) || process.argv[2] && !passwordFromStdin) {
  process.stderr.write("Usage: node generate_operator_password_hash.mjs [--password-stdin]\n")
  process.exit(2)
}

function emitPasswordHash(password) {
  if (password.length < 16 || password.length > 1024) {
    process.stderr.write("Password must contain 16 to 1024 characters.\n")
    process.exit(1)
  }
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const hash = `scrypt$32768$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`
  password = ""
  process.stdout.write(`${hash}\n`)
}

if (passwordFromStdin) {
  process.stdin.setEncoding("utf8")
  let password = ""
  process.stdin.on("data", (chunk) => {
    password += chunk
  })
  process.stdin.on("end", () => {
    emitPasswordHash(password.replace(/(?:\r\n|\n|\r)$/, ""))
    password = ""
  })
} else {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    process.stderr.write("Run this command in an interactive terminal; password input must not be echoed.\n")
    process.exit(1)
  }

  process.stderr.write("Operator password (minimum 16 characters): ")
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")

  let password = ""
  process.stdin.on("data", (chunk) => {
    for (const character of chunk) {
      if (character === "\u0003") {
        process.stderr.write("\nCancelled.\n")
        process.exit(1)
      }
      if (character === "\r" || character === "\n") {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stderr.write("\n")
        emitPasswordHash(password)
        password = ""
        process.exit(0)
      }
      if (character === "\u007f" || character === "\b") {
        password = password.slice(0, -1)
      } else {
        password += character
      }
    }
  })
}
