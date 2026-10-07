import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("notes"), _creationTime: v.number(), text: v.string() })),
  handler: async (ctx) => await ctx.db.query("notes").order("desc").take(50),
});

export const add = mutation({
  args: { text: v.string() },
  returns: v.id("notes"),
  handler: async (ctx, { text }) => {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("A note needs text.");
    return await ctx.db.insert("notes", { text: trimmed });
  },
});
