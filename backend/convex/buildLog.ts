export function buildStatus(log: string) {
  const last = log.trimEnd().split("\n").at(-1) ?? "";
  if (/\bERROR$/.test(last)) return "error" as const;
  if (/\bSUCCESS$/.test(last)) return "success" as const;
  return log.includes("IN_PROGRESS") ? "in progress" as const : "starting" as const;
}
export function safeLog(log: string) {
  for (const name of ["EXPO_TOKEN", "BOAT_API_KEY"]) {
    const secret = process.env[name];
    if (secret) log = log.replaceAll(secret, "[REDACTED]");
  }
  // Bound UTF-8 size below Convex's 1 MiB document limit, retaining the terminal marker.
  return log.slice(-180_000);
}
