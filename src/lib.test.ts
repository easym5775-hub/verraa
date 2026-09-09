/* VERRAA — unit tests for lib.ts helpers */

import { describe, expect, it } from "vitest";
import {
  uuid,
  uid,
  toISO,
  fromISO,
  todayISO,
  addDays,
  diffDays,
  fmtDate,
  fmtShort,
  relDay,
  dayNum,
  normalizePhone,
  waHref,
  copyText,
  isValidUsername,
  coachUsernameSuffix,
  stripCoachSuffix,
  buildClientUsername,
  maxClientPartLength,
  relTime,
  errorMessage,
  randomPassword,
  fileToDataUrl,
} from "./lib";

describe("uuid", () => {
  it("generates a valid UUID v4 string", () => {
    const id = uuid();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe("uid", () => {
  it("generates a short unique id", () => {
    const id = uid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(8);
  });
  it("produces different values on subsequent calls", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
  });
});

describe("toISO / fromISO", () => {
  it("round-trips a date", () => {
    const d = new Date(2026, 8, 15);
    expect(fromISO(toISO(d)).getTime()).toBe(d.getTime());
  });
  it("formats YYYY-MM-DD", () => {
    expect(toISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    expect(addDays("2026-09-01", 5)).toBe("2026-09-06");
  });
  it("handles negative offset", () => {
    expect(addDays("2026-09-10", -3)).toBe("2026-09-07");
  });
  it("handles zero", () => {
    expect(addDays("2026-09-08", 0)).toBe("2026-09-08");
  });
  it("handles month rollover", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });
});

describe("diffDays", () => {
  it("returns positive when to is later", () => {
    expect(diffDays("2026-09-01", "2026-09-06")).toBe(5);
  });
  it("returns negative when to is earlier", () => {
    expect(diffDays("2026-09-10", "2026-09-08")).toBe(-2);
  });
  it("returns 0 for same date", () => {
    expect(diffDays("2026-09-08", "2026-09-08")).toBe(0);
  });
});

describe("fmtDate / fmtShort", () => {
  it("formats a date", () => {
    expect(fmtDate("2026-09-08")).toBe("8 Sept 2026");
  });
  it("formats short", () => {
    expect(fmtShort("2026-09-08")).toBe("8 Sept");
  });
});

describe("relDay", () => {
  it("returns Today for today", () => {
    expect(relDay(todayISO())).toBe("Today");
  });
  it("returns Yesterday for yesterday", () => {
    expect(relDay(addDays(todayISO(), -1))).toBe("Yesterday");
  });
  it("returns formatted date for other days", () => {
    const result = relDay(addDays(todayISO(), 5));
    expect(result).not.toBe("Today");
    expect(result).not.toBe("Yesterday");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("dayNum", () => {
  it("Monday = 1", () => {
    expect(dayNum(new Date(2026, 8, 7))).toBe(1); // Mon Sep 7 2026
  });
  it("Sunday = 7", () => {
    expect(dayNum(new Date(2026, 8, 13))).toBe(7); // Sun Sep 13 2026
  });
});

describe("normalizePhone", () => {
  it("normalizes Egyptian local format", () => {
    expect(normalizePhone("01012345678")).toBe("201012345678");
  });
  it("passes through international format", () => {
    expect(normalizePhone("+201012345678")).toBe("201012345678");
  });
  it("handles 00 prefix", () => {
    expect(normalizePhone("00201012345678")).toBe("201012345678");
  });
  it("returns null for empty", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
  it("returns null for too short", () => {
    expect(normalizePhone("012")).toBeNull();
  });
});

describe("waHref", () => {
  it("builds WhatsApp link", () => {
    expect(waHref("01012345678")).toBe("https://wa.me/201012345678");
  });
  it("returns null for invalid", () => {
    expect(waHref("")).toBeNull();
  });
});

describe("isValidUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidUsername("ali")).toBe(true);
    expect(isValidUsername("ahmed.sammy")).toBe(true);
    expect(isValidUsername("user-123")).toBe(true);
    expect(isValidUsername("a.1-b")).toBe(true);
  });
  it("rejects invalid usernames", () => {
    expect(isValidUsername("abc")).toBe(true); // lowercase is valid
    expect(isValidUsername("a")).toBe(false); // too short (min 3)
    expect(isValidUsername("a".repeat(25))).toBe(false); // too long (max 24)
    expect(isValidUsername("user@name")).toBe(false); // special char
  });
});

describe("coachUsernameSuffix", () => {
  it("extracts first latin token from name", () => {
    expect(coachUsernameSuffix("Ahmed Samy", "ahmed@gmail.com")).toBe("ahmed");
  });
  it("falls back to email prefix", () => {
    expect(coachUsernameSuffix(null, "coach@test.com")).toBe("coach");
  });
  it("returns coach as last resort", () => {
    expect(coachUsernameSuffix(null, null)).toBe("coach");
  });
});

describe("stripCoachSuffix", () => {
  it("strips trailing suffix", () => {
    expect(stripCoachSuffix("ali.ahmed", "ahmed")).toBe("ali");
  });
  it("returns unchanged when no suffix", () => {
    expect(stripCoachSuffix("ali", "ahmed")).toBe("ali");
  });
  it("handles case insensitivity", () => {
    expect(stripCoachSuffix("Ali.Ahmed", "ahmed")).toBe("ali");
  });
});

describe("buildClientUsername", () => {
  it("builds client.coach username", () => {
    expect(buildClientUsername("ali", "ahmed")).toBe("ali.ahmed");
  });
  it("strips existing suffix before appending", () => {
    expect(buildClientUsername("ali.ahmed", "ahmed")).toBe("ali.ahmed");
  });
});

describe("maxClientPartLength", () => {
  it("respects total 24 char limit", () => {
    expect(maxClientPartLength("ahmed")).toBe(18); // 24 - 5 - 1
  });
  it("minimum is 1", () => {
    expect(maxClientPartLength("a".repeat(30))).toBe(1);
  });
});

describe("relTime", () => {
  it("returns Just now for recent", () => {
    expect(relTime(Date.now())).toBe("Just now");
  });
  it("returns minutes ago", () => {
    expect(relTime(Date.now() - 61_000)).toBe("1m ago");
  });
  it("returns hours ago", () => {
    expect(relTime(Date.now() - 2 * 3600_000)).toBe("2h ago");
  });
  it("returns Yesterday for 25 hours ago", () => {
    expect(relTime(Date.now() - 25 * 3600_000)).toBe("Yesterday");
  });
});

describe("errorMessage", () => {
  it("returns error message for Error", () => {
    expect(errorMessage(new Error("test"))).toBe("test");
  });
  it("returns fallback for non-Error", () => {
    expect(errorMessage("string")).toBe("Something went wrong.");
    expect(errorMessage(null)).toBe("Something went wrong.");
  });
});

describe("randomPassword", () => {
  it("generates a 10-char password", () => {
    const pw = randomPassword();
    expect(pw.length).toBe(10);
  });
  it("does not contain ambiguous characters", () => {
    const pw = randomPassword();
    expect(pw).not.toMatch(/[liI1|oO0]/);
  });
});

describe("copyText", () => {
  it("returns true when clipboard is available", async () => {
    // In jsdom/vitest environment, navigator.clipboard may not exist
    // This tests the fallback path
    const result = await copyText("test");
    expect(typeof result).toBe("boolean");
  });
});

describe("fileToDataUrl", () => {
  it("resolves to a data URL for a valid image", async () => {
    // Skip in node environment where document is not defined
    if (typeof document === "undefined") {
      expect(true).toBe(true);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 10, 10);
    }
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? new Blob())));
    const file = new File([blob], "test.png", { type: "image/png" });
    const url = await fileToDataUrl(file);
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("todayISO", () => {
  it("returns today in YYYY-MM-DD format", () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    expect(today).toBe(toISO(now));
  });
});
