import { describe, expect, it } from "vitest";
import { buildStatus, safeLog } from "../convex/buildLog";

describe("sandbox build logs", () => {
  it("does not treat Gradle BUILD SUCCESSFUL or an earlier marker as job completion", () => {
    expect(buildStatus("[time] IN_PROGRESS\n[time] BUILD SUCCESSFUL in 2m\ncopying APK\n")).toBe("in progress");
    expect(buildStatus("[time] SUCCESS\nmore output\n")).toBe("starting");
    expect(buildStatus("[time] SUCCESS\n")).toBe("success");
  });
  it("handles setup errors before EAS launches", () => {
    expect(buildStatus("Installing Android SDK\n[time] ERROR\n")).toBe("error");
    expect(buildStatus("Cloning into app\n")).toBe("starting");
  });
  it("keeps the terminal marker below the Convex document limit and removes credentials", () => {
    process.env.EXPO_TOKEN = "test-only-expo-token";
    process.env.R2_SECRET_ACCESS_KEY = "test-only-r2-secret";
    const log = safeLog("💻".repeat(300_000) + "test-only-expo-token test-only-r2-secret\n[time] SUCCESS\n");
    expect(Buffer.byteLength(log)).toBeLessThan(1_000_000);
    expect(log).not.toContain("test-only-expo-token");
    expect(log).not.toContain("test-only-r2-secret");
    expect(buildStatus(log)).toBe("success");
    delete process.env.EXPO_TOKEN;
    delete process.env.R2_SECRET_ACCESS_KEY;
  });
});
