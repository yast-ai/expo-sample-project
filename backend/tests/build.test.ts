import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const mock = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), command: vi.fn(), artifact: vi.fn(), stop: vi.fn(), r2Presign: vi.fn(), r2Sync: vi.fn(), r2Metadata: vi.fn(), r2GetUrl: vi.fn(), r2Delete: vi.fn() }));
vi.mock("@boatdev/sdk", () => ({
  Configuration: class {}, BoatApi: class {
    create = mock.create; get = mock.get; command = mock.command; artifact = mock.artifact; stop = mock.stop;
  },
}));
vi.mock("@convex-dev/r2", () => ({
  R2: class {
    client = {};
    config = { bucket: "test-bucket" };
    deleteObject = mock.r2Delete;
    syncMetadata = mock.r2Sync;
    getMetadata = mock.r2Metadata;
    getUrl = mock.r2GetUrl;
  },
}));
vi.mock("@aws-sdk/client-s3", () => ({ PutObjectCommand: class { constructor(_: unknown) {} } }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mock.r2Presign }));
const modules = import.meta.glob("../convex/**/*.ts");
const request = { gitRepo: "https://github.com/yast-ai/expo-sample-project.git", environment: "preview" as const };
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  vi.stubEnv("EXPO_TOKEN", "test-token"); vi.stubEnv("BOAT_API_KEY", "test-key");
  mock.create.mockResolvedValue({ sandbox: { id: "test-sandbox" } });
  mock.stop.mockResolvedValue({ ok: true });
  mock.r2Presign.mockResolvedValue("https://r2.test/upload");
  mock.r2Metadata.mockResolvedValue({ size: 10 });
  mock.r2GetUrl.mockImplementation((key: string) => `https://r2.test/${key}`);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it("saves an early setup failure and stops the VM without scheduling more build polls", async () => {
  mock.get.mockResolvedValue({ sandbox: { state: "ready", setupStatus: "failed", setupError: "sdkmanager failed" } });
  mock.command.mockResolvedValue({ stdout: "[time] sdkmanager failed\n[time] ERROR\n" });
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, request);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "error", finishedAt: "failure", sandboxId: "test-sandbox" });
  expect(build?.log).toContain("sdkmanager failed");
  expect(mock.stop).toHaveBeenCalledOnce();
  expect(mock.create).toHaveBeenCalledOnce();
});

it("polls after 15 seconds, syncs the direct R2 upload, and stops the sandbox", async () => {
  mock.get.mockRejectedValueOnce(Object.assign(new Error("Gateway warming up"), { response: new Response("retry", { status: 502 }) }))
    .mockResolvedValue({ sandbox: { state: "ready", setupStatus: "done" } });
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, request);
  const key = `builds/${id}/artifact.apk`;
  mock.command.mockResolvedValueOnce({ stdout: "[time] IN_PROGRESS\n[time] SUCCESS\n" }).mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ artifact: {key}, timing: {setupStartedAt: Date.now()+1000, buildStartedAt: Date.now()+2000, buildCompletedAt: Date.now()+3000, uploadStartedAt: Date.now()+3000, artifactReadyAt: Date.now()+3500} }) });
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
  expect((await t.query(internal.builds.get, { id }))?.status).toBe("starting");
  vi.advanceTimersByTime(14_999);
  await t.finishInProgressScheduledFunctions();
  expect(mock.get).not.toHaveBeenCalled();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "success", finishedAt: "success" });
  expect(build?.storageKey).toBe(key);
  expect(build?.apkUrl).toBe(`https://r2.test/${key}`);
  expect(mock.get).toHaveBeenCalledTimes(2);
  expect(build?.endToEndSeconds).toBeCloseTo((build!.completedAt! - build!._creationTime) / 1000, 3);
  expect(build?.uploadCompletedAt).toBeLessThan(build!.artifactReadyAt!);
  expect(build?.artifactReadyAt).toBe(build!.completedAt!);
  expect(build?.artifactBytes).toBe(10);
  expect(mock.r2Sync).toHaveBeenCalledWith(expect.anything(), key);
  expect(mock.artifact).not.toHaveBeenCalled();
  expect(mock.command.mock.invocationCallOrder.at(-1)).toBeLessThan(mock.stop.mock.invocationCallOrder[0]!);
});

it("records the provider's transfer error when APK compilation succeeded", async () => {
  mock.get.mockResolvedValue({ sandbox: { state: "ready", setupStatus: "done" } });
  mock.command.mockResolvedValueOnce({ stdout: "[time] SUCCESS\n" }).mockRejectedValue(Object.assign(new Error("Upload receipt failed"), {
    response: new Response('{"code":"artifact_failed","message":"Upload receipt unavailable"}', { status: 400 }),
  }));
  const t = convexTest(schema, modules);
  const id = await t.action(api.android.runBuild, request);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const build = await t.query(internal.builds.get, { id });
  expect(build).toMatchObject({ status: "error", finishedAt: "failure" });
  expect(build?.log).toContain("HTTP 400");
  expect(build?.log).toContain("Upload receipt unavailable");
  expect(mock.r2Delete).toHaveBeenCalledWith(expect.anything(), `builds/${id}/artifact.apk`);
  expect(mock.stop).toHaveBeenCalledOnce();
});

it("passes the requested repository, production profile and project directory to the sandbox", async () => {
  const t = convexTest(schema, modules);
  await t.action(api.android.runBuild, { ...request, gitRepo: "https://github.com/yast-ai/another-app.git", environment: "production", projectDirectory: "apps/mobile" });
  vi.advanceTimersByTime(0); await t.finishInProgressScheduledFunctions();
  const options = mock.create.mock.calls[0][0].createSandboxRequest;
  expect(options.env.EXPO_TOKEN).toBe("test-token");
  expect(options.env.R2_UPLOAD_URL).toMatch(/^https?:/);
  expect(options.env.R2_OBJECT_KEY).toMatch(/^builds\/[^/]+\/artifact\.aab$/);
  expect(mock.r2Presign).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 3600 });
  expect(options.setupScript).toContain('--upload-file /home/user/app.aab "$R2_UPLOAD_URL"');
  expect(options.setupScript).toContain("https://github.com/yast-ai/another-app.git");
  expect(options.setupScript).toContain("cd '/tmp/app/apps/mobile'");
  expect(options.setupScript).toContain("--profile production");
  expect(options.setupScript).toContain("/home/user/app.aab");
  expect(options.setupScript.trim().split("\n").length).toBeLessThanOrEqual(20);
  await expect(t.action(api.android.runBuild, { ...request, projectDirectory: "../outside" })).rejects.toThrow("relative project directory");
  await expect(t.action(api.android.runBuild, { ...request, gitRepo: "https://example.com/untrusted.git" })).rejects.toThrow("yast-ai GitHub organization");
});

it("finalizes a benchmark direct upload without routing artifact bytes through Convex storage", async () => {
  const t = convexTest(schema, modules);
  const upload = await t.mutation(internal.artifacts.benchmarkUpload, { key: "benchmarks/native/cold.apk" });
  expect(upload).toEqual({ key: "benchmarks/native/cold.apk", url: "https://r2.test/upload" });
  const done = await t.action(internal.artifacts.completeUpload, { key: upload.key });
  expect(done).toEqual({ key: upload.key, size: 10, url: "https://r2.test/benchmarks/native/cold.apk" });
  expect(mock.r2Sync).toHaveBeenCalledWith(expect.anything(), upload.key);
  await expect(t.mutation(internal.artifacts.benchmarkUpload, { key: "builds/not-a-benchmark.apk" })).rejects.toThrow("benchmarks/");
});
