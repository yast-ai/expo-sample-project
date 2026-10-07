"use node";
import { BoatApi, Configuration } from "@boatdev/sdk";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildStatus, safeLog } from "./buildLog";
import { setupScript } from "./setupScript";
import type { Id } from "./_generated/dataModel";
import { buildRequest } from "./schema";
import { r2 } from "./artifacts";

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
      const extension = environment === "production" ? "aab" : "apk";
      const upload = await ctx.runMutation(internal.artifacts.createUpload, { buildId: id, extension });
      const created = await boat().create({
        idempotencyKey: id,
        createSandboxRequest: {
          type: "large", ttlSeconds: 3600, noEnv: true, snapshots: false,
          from: process.env.ANDROID_BUILD_TEMPLATE || "android-build-tools",
          env: { EXPO_TOKEN: process.env.EXPO_TOKEN!, R2_UPLOAD_URL: upload.url, R2_OBJECT_KEY: upload.key }, setupScript: setupScript(gitRepo, environment, projectDirectory),
        },
      });
      sandboxId = created.sandbox.id;
      await ctx.runMutation(internal.builds.update, { id, sandboxId, uploadKey: upload.key, log: "", status: "starting" });
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
        const result = await api.command({ sandboxId: build.sandboxId, commandRequest: {
          command: `node -e 'const f=require("fs");console.log(JSON.stringify({artifact:JSON.parse(f.readFileSync("/home/user/artifact.json")),timing:JSON.parse(f.readFileSync("/home/user/timing.json"))}))'`, timeoutSeconds: 10,
        } });
        if (!("stdout" in result) || result.exitCode !== 0) throw new Error("Missing artifact upload receipt");
        const { artifact, timing } = JSON.parse(result.stdout);
        if (artifact.key !== build.uploadKey) throw new Error("Uploaded artifact key does not match this build");
        await r2.syncMetadata(ctx, artifact.key);
        const metadata = await r2.getMetadata(ctx, artifact.key);
        if (!metadata || !metadata.size) throw new Error("Uploaded R2 artifact is missing or empty");
        const completedAt = Date.now();
        await ctx.runMutation(internal.builds.update, { id, log, status, storageKey: artifact.key,
          setupStartedAt: timing.setupStartedAt, buildStartedAt: timing.buildStartedAt, buildCompletedAt: timing.buildCompletedAt,
          uploadStartedAt: timing.uploadStartedAt, uploadCompletedAt: timing.artifactReadyAt, artifactReadyAt: completedAt,
          completedAt, endToEndSeconds: (completedAt - build._creationTime) / 1000,
          artifactBytes: metadata.size, finishedAt: "success" });
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
      if (build.uploadKey) { try { await r2.deleteObject(ctx, build.uploadKey); } catch { /* Best effort: preserve the original build error if storage cleanup fails. */ } }
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
