import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { status, outcome } from "./schema";

export const create = internalMutation({
  args: {}, returns: v.id("builds"),
  handler: async (ctx) => {
    const id = await ctx.db.insert("builds", { log: "", status: "starting" });
    await ctx.scheduler.runAfter(0, internal.android.start, { id });
    return id;
  },
});
export const get = internalQuery({
  args: { id: v.id("builds") },
  returns: v.union(v.null(), v.object({
    _id: v.id("builds"), _creationTime: v.number(), log: v.string(), status,
    finishedAt: v.optional(outcome), sandboxId: v.optional(v.string()),
    apkId: v.optional(v.id("_storage")), apkUrl: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, { id }) => {
    const build = await ctx.db.get(id);
    return build && { ...build, apkUrl: build.apkId ? await ctx.storage.getUrl(build.apkId) : null };
  },
});
export const update = internalMutation({
  args: { id: v.id("builds"), log: v.string(), status, sandboxId: v.optional(v.string()), apkId: v.optional(v.id("_storage")), finishedAt: v.optional(outcome) },
  returns: v.null(),
  handler: async (ctx, { id, ...patch }) => {
    const build = await ctx.db.get(id);
    if (!build || build.finishedAt) return null;
    await ctx.db.patch(id, patch);
    if (!patch.finishedAt) await ctx.scheduler.runAfter(15_000, internal.android.poll, { id });
    return null;
  },
});
