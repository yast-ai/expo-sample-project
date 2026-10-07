"use node";
import { BoatApi, Configuration } from "@boatdev/sdk";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildStatus, safeLog } from "./buildLog";
import { setupScript } from "./setupScript";
import type { Id } from "./_generated/dataModel";
import { buildRequest } from "./schema";

function boat() {
  if (!process.env.BOAT_API_KEY || !process.env.EXPO_TOKEN) throw new Error("Set BOAT_API_KEY and EXPO_TOKEN first");
  return new BoatApi(new Configuration({ accessToken: process.env.BOAT_API_KEY }));
}
async function failure(log: string, error: unknown) {
  let detail = error instanceof Error ? error.message : String(error);
  const response = (error as { response?: Response })?.response;
  if (response) detail += ` (HTTP ${response.status}): ${(await response.clone().text()).slice(0, 2000)}`;
  return safeLog(`${log}\n[${new Date().toISOString()}] ${detail}\n[${new Date().toISOString()}] ERROR\n`);
}

export const runBuild = action({
  args: buildRequest, returns: v.id("builds"),
  handler: async (ctx, request): Promise<Id<"builds">> => {
    boat();
    setupScript(request.gitRepo, request.environment, request.projectDirectory);
    return await ctx.runMutation(internal.builds.create, request);
  },
});
export const start = internalAction({
  args: { id: v.id("builds"), ...buildRequest }, returns: v.null(),
  handler: async (ctx, { id, gitRepo, environment, projectDirectory }) => {
    let sandboxId: string | undefined;
    try {
      const created = await boat().create({
        idempotencyKey: id,
        createSandboxRequest: {
          type: "large", ttlSeconds: 3600, noEnv: true, snapshots: false,
          from: "android-build-tools",
          env: { EXPO_TOKEN: process.env.EXPO_TOKEN! }, setupScript: setupScript(gitRepo, environment, projectDirectory),
        },
      });
      sandboxId = created.sandbox.id;
      await ctx.runMutation(internal.builds.update, { id, sandboxId, log: "", status: "starting" });
    } catch (error) {
      if (sandboxId) await ctx.scheduler.runAfter(0, internal.android.stop, { sandboxId });
      await ctx.runMutation(internal.builds.update, { id, log: await failure("", error), status: "error", finishedAt: "failure" });
    }
    return null;
  },
});
export const poll = internalAction({
  args: { id: v.id("builds"), retry: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, { id, retry = 0 }) => {
    const build = await ctx.runQuery(internal.builds.get, { id });
    if (!build || build.finishedAt || !build.sandboxId) return null;
    const api = boat();
    let log = build.log;
    try {
      const { sandbox } = await api.get({ sandboxId: build.sandboxId });
      if (["ready", "running", "idle"].includes(sandbox.state)) {
        const result = await api.command({ sandboxId: build.sandboxId, commandRequest: {
          command: "tail -c 600000 /home/user/build.log 2>/dev/null || true", timeoutSeconds: 10,
        } });
        if (!("stdout" in result)) throw new Error("Missing build log command result");
        log = safeLog(result.stdout || log);
      }
      const status = buildStatus(log);
      if (status === "error") throw new Error("Sandbox build failed; see build log");
      if (status === "success") {
        // Boat artifact downloads are capped at 50 MiB per file.
        const extension = build.environment === "production" ? "aab" : "apk";
        const split = await api.command({ sandboxId: build.sandboxId, commandRequest: {
          command: `split -b 40m -d /home/user/app.${extension} /home/user/apk.part. && ls /home/user/apk.part.*`, timeoutSeconds: 30,
        } });
        if (!("stdout" in split) || split.exitCode !== 0) throw new Error("Could not split APK for transfer");
        const paths = split.stdout.trim().split("\n").filter((path) => /^\/home\/user\/apk\.part\.\d{2}$/.test(path));
        if (!paths.length) throw new Error("No APK transfer parts found");
        const parts: Blob[] = [];
        for (const path of paths) parts.push(await api.artifact({ sandboxId: build.sandboxId, path: path.slice("/home/user/".length) }));
        const artifactId = await ctx.storage.store(new Blob(parts, { type: extension === "apk" ? "application/vnd.android.package-archive" : "application/octet-stream" }));
        await ctx.runMutation(internal.builds.update, { id, log, status, artifactId, ...(extension === "apk" ? { apkId: artifactId } : {}), finishedAt: "success" });
        await ctx.scheduler.runAfter(0, internal.android.stop, { sandboxId: build.sandboxId });
        return null;
      }
      if (sandbox.setupStatus === "failed" || ["error", "archived", "archiving", "cancelled"].includes(sandbox.state)) {
        throw new Error(sandbox.setupError || sandbox.error || `Sandbox ${sandbox.state}`);
      }
      if (Date.now() - build._creationTime > 3_300_000) throw new Error("Build exceeded 55-minute limit");
      await ctx.runMutation(internal.builds.update, { id, log, status });
    } catch (error) {
      const response = (error as { response?: Response })?.response;
      if (response && response.status >= 500 && retry < 3) {
        await ctx.scheduler.runAfter(15_000, internal.android.poll, { id, retry: retry + 1 });
        return null;
      }
      await ctx.runMutation(internal.builds.update, { id, log: await failure(log, error), status: "error", finishedAt: "failure" });
      await ctx.scheduler.runAfter(0, internal.android.stop, { sandboxId: build.sandboxId });
    }
    return null;
  },
});
export const stop = internalAction({
  args: { sandboxId: v.string(), attempt: v.optional(v.number()) }, returns: v.null(),
  handler: async (ctx, { sandboxId, attempt = 0 }) => {
    try { await boat().stop({ sandboxId }); }
    catch (error) {
      if (attempt >= 3) throw error;
      await ctx.scheduler.runAfter(15_000, internal.android.stop, { sandboxId, attempt: attempt + 1 });
    }
    return null;
  },
});
