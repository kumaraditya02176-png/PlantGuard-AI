import { randomBytes, scryptSync } from "node:crypto"

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  process.stderr.write("Run this command in an interactive terminal; password input must not be echoed.\n")
  process.exit(1)
}

process.stdout.write("Operator password (minimum 16 characters): ")
process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding("utf8")

let password = ""
process.stdin.on("data", (chunk) => {
  for (const character of chunk) {
    if (character === "\u0003") {
      process.stdout.write("\nCancelled.\n")
      process.exit(1)
    }
    if (character === "\r" || character === "\n") {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write("\n")
      if (password.length < 16 || password.length > 1024) {
        process.stderr.write("Password must contain 16 to 1024 characters.\n")
        process.exit(1)
      }
      const salt = randomBytes(16)
      const derived = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
      const hash = `scrypt$32768$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`
      password = ""
      process.stdout.write(`${hash}\n`)
      process.exit(0)
    }
    if (character === "\u007f" || character === "\b") {
      password = password.slice(0, -1)
    } else {
      password += character
    }
  }
})
