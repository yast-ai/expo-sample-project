import { R2 } from "@convex-dev/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

export const r2 = new R2(components.r2);

async function presignUpload(key: string) {
  return { key, url: await getSignedUrl(r2.client, new PutObjectCommand({ Bucket: r2.config.bucket, Key: key }), { expiresIn: 3600 }) };
}

export const createUpload = internalMutation({
  args: { buildId: v.id("builds"), extension: v.union(v.literal("apk"), v.literal("aab")) },
  returns: v.object({ key: v.string(), url: v.string() }),
  handler: async (_ctx, { buildId, extension }) => await presignUpload(`builds/${buildId}/artifact.${extension}`),
});

export const uploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const legacyUrl = internalQuery({
  args: { id: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { id }) => await ctx.storage.getUrl(id),
});

export function benchmarkKey(key: string) {
  if (!/^benchmarks\/[A-Za-z0-9._/-]+$/.test(key) || key.includes("..")) throw new Error("Benchmark keys must stay under benchmarks/");
  return key;
}

export const benchmarkUpload = internalMutation({
  args: { key: v.string() },
  returns: v.object({ key: v.string(), url: v.string() }),
  handler: async (_ctx, { key }) => await presignUpload(benchmarkKey(key)),
});

export const completeUpload = internalAction({
  args: { key: v.string() },
  returns: v.object({ key: v.string(), size: v.number(), url: v.string() }),
  handler: async (ctx, { key }) => {
    const safeKey = benchmarkKey(key);
    await r2.syncMetadata(ctx, safeKey);
    const metadata = await r2.getMetadata(ctx, safeKey);
    if (!metadata?.size) throw new Error("Uploaded benchmark artifact is missing or empty");
    return { key: safeKey, size: metadata.size, url: await r2.getUrl(safeKey) };
  },
});

export const getUrl = internalQuery({
  args: { key: v.string() },
  returns: v.string(),
  handler: async (_ctx, { key }) => await r2.getUrl(key),
});
