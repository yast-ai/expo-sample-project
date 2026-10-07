import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {},
  returns: v.object({ value: v.number() }),
  handler: async (ctx) => {
    const row = await ctx.db.query("counters").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    return { value: row?.value ?? 0 };
  },
});

export const increment = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const row = await ctx.db.query("counters").withIndex("by_key", (q) => q.eq("key", "main")).unique();
    const value = (row?.value ?? 0) + 1;
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("counters", { key: "main", value });
    return value;
  },
});
