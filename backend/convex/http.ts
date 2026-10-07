import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { benchmarkKey } from "./artifacts";

const http = httpRouter();

http.route({
  path: "/artifact",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return new Response("Missing build id", { status: 400 });
    try {
      const build = await ctx.runQuery(internal.builds.get, { id: id as Id<"builds"> });
      if (!build?.artifactUrl) return new Response("Artifact not found", { status: 404 });
      return new Response(null, { status: 302, headers: { Location: build.artifactUrl, "Cache-Control": "no-store" } });
    } catch {
      return new Response("Artifact not found", { status: 404 });
    }
  }),
});

http.route({
  path: "/benchmark-artifact",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return new Response("Missing benchmark key", { status: 400 });
    try {
      const url = await ctx.runQuery(internal.artifacts.getUrl, { key: benchmarkKey(key) });
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
    } catch {
      return new Response("Artifact not found", { status: 404 });
    }
  }),
});

export default http;
