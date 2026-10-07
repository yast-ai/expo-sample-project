import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { benchmarkKey } from "./artifacts";

const http = httpRouter();

// Only the three public report assets are served here. Source archives stay private.
http.route({
  pathPrefix: "/build-lab/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const file = new URL(request.url).pathname.slice("/build-lab/".length) || "index.html";
    const types: Record<string, string> = { "index.html": "text/html; charset=utf-8", "app.js": "text/javascript; charset=utf-8", "data.json": "application/json; charset=utf-8" };
    if (!Object.hasOwn(types, file)) return new Response("Not found", { status: 404 });
    const url = await ctx.runQuery(internal.artifacts.getUrl, { key: `benchmarks/report/${file}` });
    const response = await fetch(url);
    if (!response.ok) return new Response("Report unavailable", { status: 503 });
    return new Response(await response.arrayBuffer(), { headers: { "Content-Type": types[file], "Cache-Control": "no-store" } });
  }),
});

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
