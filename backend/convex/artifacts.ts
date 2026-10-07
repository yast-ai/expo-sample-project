import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
export const uploadUrl = internalMutation({ args: {}, returns: v.string(), handler: ctx => ctx.storage.generateUploadUrl() });
export const getUrl = internalQuery({ args: { id: v.id("_storage") }, returns: v.union(v.string(), v.null()), handler: (ctx, { id }) => ctx.storage.getUrl(id) });
