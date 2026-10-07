import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const status = v.union(v.literal("starting"), v.literal("in progress"), v.literal("error"), v.literal("success"));
export const outcome = v.union(v.literal("success"), v.literal("failure"));
export const environment = v.union(v.literal("preview"), v.literal("production"));
export const buildRequest = { gitRepo: v.string(), environment, projectDirectory: v.optional(v.string()) };
export default defineSchema({
  builds: defineTable({
    log: v.string(),
    status,
    finishedAt: v.optional(outcome),
    sandboxId: v.optional(v.string()),
    apkId: v.optional(v.id("_storage")),
    artifactId: v.optional(v.id("_storage")),
    gitRepo: v.optional(v.string()),
    environment: v.optional(environment),
    projectDirectory: v.optional(v.string()),
  }),
});
