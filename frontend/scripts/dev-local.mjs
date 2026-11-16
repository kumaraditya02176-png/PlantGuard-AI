import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const isWindows = process.platform === "win32"
const command = isWindows ? "powershell.exe" : "next"
const args = isWindows
  ? [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      fileURLToPath(new URL("../../scripts/start_local_demo_frontend.ps1", import.meta.url)),
    ]
  : ["dev", ...process.argv.slice(2)]

const child = spawn(command, args, { env: process.env, stdio: "inherit" })
child.on("error", () => {
  console.error(isWindows
    ? "Could not start the Windows local demo launcher."
    : "Could not start the Next.js development server.")
  process.exitCode = 1
})
child.on("exit", (code) => {
  process.exitCode = code ?? 1
})
