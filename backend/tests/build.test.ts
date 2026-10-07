import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const mock = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), command: vi.fn(), artifact: vi.fn(), stop: vi.fn() }));
vi.mock("@boatdev/sdk", () => ({
  Configuration: class {}, BoatApi: class {
    create = mock.create; get = mock.get; command = mock.command; artifact = mock.artifact; stop = mock.stop;
  },
}));
const modules = import.meta.glob("../convex/**/*.ts");
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  vi.stubEnv("EXPO_TOKEN", "test-token"); vi.stubEnv("BOAT_API_KEY", "test-key");
  mock.create.mockResolvedValue({ sandbox: { id: "test-sandbox" } });
  mock.stop.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("saves an early setup failure and stops the VM without scheduling more build polls", async () => {
  mock.get.mockResolvedValue({ sandbox: { state: "ready", setupStatus: "failed", setupError: "sdkmanager failed" } });
  mock.command.mockResolvedValue({ stdout: "[time] sdkmanager failed\n[time] ERROR\n" });
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, {});
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "error", finishedAt: "failure", sandboxId: "test-sandbox" });
  expect(build?.log).toContain("sdkmanager failed");
  expect(mock.stop).toHaveBeenCalledOnce();
  expect(mock.create).toHaveBeenCalledOnce();
});

it("polls after 15 seconds and stores the finished APK before stopping the sandbox", async () => {
  mock.get.mockResolvedValue({ sandbox: { state: "ready", setupStatus: "done" } });
  mock.command.mockResolvedValueOnce({ stdout: "[time] IN_PROGRESS\n[time] SUCCESS\n" }).mockResolvedValueOnce({ stdout: "/home/user/apk.part.00\n/home/user/apk.part.01\n", exitCode: 0 });
  mock.artifact.mockResolvedValueOnce(new Blob(["sample-"])).mockResolvedValueOnce(new Blob(["apk"]));
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, {});
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  expect((await t.query(internal.builds.get, { id }))?.status).toBe("starting");
  vi.advanceTimersByTime(14_999);
  await t.finishInProgressScheduledFunctions();
  expect(mock.get).not.toHaveBeenCalled();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "success", finishedAt: "success" });
  expect(build?.apkUrl).toBeTruthy();
  const stored = await t.run(async (ctx) => (await ctx.storage.get(build!.apkId!))!.text());
  expect(stored).toBe("sample-apk");
  expect(mock.artifact.mock.invocationCallOrder[0]).toBeLessThan(mock.stop.mock.invocationCallOrder[0]!);
});

it("records the provider's transfer error when APK compilation succeeded", async () => {
  mock.get.mockResolvedValue({ sandbox: { state: "ready", setupStatus: "done" } });
  mock.command.mockResolvedValueOnce({ stdout: "[time] SUCCESS\n" }).mockResolvedValueOnce({ stdout: "/home/user/apk.part.00\n", exitCode: 0 });
  mock.artifact.mockRejectedValue(Object.assign(new Error("Artifact download failed"), {
    response: new Response('{"code":"artifact_failed","message":"Artifact is too large"}', { status: 400 }),
  }));
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, {});
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "error", finishedAt: "failure" });
  expect(build?.log).toContain("HTTP 400");
  expect(build?.log).toContain("Artifact is too large");
  expect(mock.stop).toHaveBeenCalledOnce();
});
