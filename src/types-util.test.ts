/* VERRAA — unit tests for types.ts utility functions */

import { describe, expect, it } from "vitest";
import { workoutExerciseKey, weekPos, formatDayName, formatDayShort, WEEK_ORDER_SAT_FIRST } from "./types";

describe("workoutExerciseKey", () => {
  it("returns lib: prefix for exerciseId", () => {
    expect(workoutExerciseKey({ exerciseId: "ex-1" })).toBe("lib:ex-1");
  });
  it("returns custom: prefix for clientExerciseId", () => {
    expect(workoutExerciseKey({ clientExerciseId: "ce-1" })).toBe("custom:ce-1");
  });
  it("returns name: prefix for exerciseName", () => {
    expect(workoutExerciseKey({ exerciseName: "Bench Press" })).toBe("name:bench press");
  });
  it("falls back to name prop", () => {
    expect(workoutExerciseKey({ name: "Squat" })).toBe("name:squat");
  });
  it("prioritizes exerciseId over clientExerciseId", () => {
    expect(workoutExerciseKey({ exerciseId: "ex-1", clientExerciseId: "ce-1", name: "Other" })).toBe("lib:ex-1");
  });
  it("handles empty input", () => {
    expect(workoutExerciseKey({})).toBe("name:");
  });
});

describe("weekPos", () => {
  it("returns position in Sat-first week", () => {
    // Sat=6 → position 1, Sun=7 → position 2, Mon=1 → position 3
    expect(weekPos(6)).toBe(1);
    expect(weekPos(7)).toBe(2);
    expect(weekPos(1)).toBe(3);
    expect(weekPos(5)).toBe(7);
  });
  it("returns the day itself if not found", () => {
    expect(weekPos(0)).toBe(0);
  });
});

describe("formatDayName", () => {
  it("returns weekday name by default", () => {
    expect(formatDayName(1)).toBe("Monday");
    expect(formatDayName(6)).toBe("Saturday");
  });
  it("returns Day N in numbered mode", () => {
    expect(formatDayName(6, "numbered")).toBe("Day 1");
    expect(formatDayName(1, "numbered")).toBe("Day 3");
  });
  it("handles edge cases", () => {
    expect(formatDayName(0)).toBe("Day 0");
  });
});

describe("formatDayShort", () => {
  it("returns short weekday name by default", () => {
    expect(formatDayShort(1)).toBe("Mon");
    expect(formatDayShort(6)).toBe("Sat");
  });
  it("returns D N in numbered mode", () => {
    expect(formatDayShort(6, "numbered")).toBe("D1");
    expect(formatDayShort(1, "numbered")).toBe("D3");
  });
});

describe("WEEK_ORDER_SAT_FIRST", () => {
  it("starts with Saturday", () => {
    expect(WEEK_ORDER_SAT_FIRST[0]).toBe(6);
  });
  it("ends with Friday", () => {
    expect(WEEK_ORDER_SAT_FIRST[6]).toBe(5);
  });
  it("has 7 days", () => {
    expect(WEEK_ORDER_SAT_FIRST.length).toBe(7);
  });
});
