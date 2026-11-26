import { describe, expect, it } from "vitest";
import { overallBand, rawToBand, roundHalf, writingBand } from "@/lib/ielts/bands";

describe("overallBand (official IELTS rounding)", () => {
  it("rounds .25 up to .5", () => {
    expect(overallBand([6.5, 6.5, 5.0, 7.0])).toBe(6.5); // 6.25
  });
  it("rounds .75 up to the next whole band", () => {
    expect(overallBand([6.5, 6.5, 7.0, 7.0])).toBe(7.0); // 6.75
  });
  it("rounds .125 down and .375 up", () => {
    expect(overallBand([6.0, 6.0, 6.0, 6.5])).toBe(6.0); // 6.125
    expect(overallBand([6.0, 6.0, 6.5, 7.0])).toBe(6.5); // 6.375
  });
  it("rounds .625 to .5 and .875 to next whole", () => {
    expect(overallBand([6.5, 6.5, 6.5, 7.0])).toBe(6.5); // 6.625
    expect(overallBand([7.0, 7.0, 7.0, 6.5])).toBe(7.0); // 6.875
  });
  it("returns null unless all four skills have a band", () => {
    expect(overallBand([6.5, 6.5, null, 7.0])).toBeNull();
    expect(overallBand([6.5, 6.5, 7.0])).toBeNull();
  });
});

describe("roundHalf", () => {
  it("rounds to nearest half band with .25/.75 going up", () => {
    expect(roundHalf(5.24)).toBe(5.0);
    expect(roundHalf(5.25)).toBe(5.5);
    expect(roundHalf(5.74)).toBe(5.5);
    expect(roundHalf(5.75)).toBe(6.0);
  });
  it("clamps to 0..9", () => {
    expect(roundHalf(9.4)).toBe(9);
    expect(roundHalf(-1)).toBe(0);
  });
});

describe("rawToBand", () => {
  it("uses the Academic Reading table", () => {
    expect(rawToBand("reading", 40)).toBe(9);
    expect(rawToBand("reading", 30)).toBe(7);
    expect(rawToBand("reading", 29)).toBe(6.5);
    expect(rawToBand("reading", 23)).toBe(6);
    expect(rawToBand("reading", 22)).toBe(5.5);
    expect(rawToBand("reading", 15)).toBe(5);
  });
  it("uses the Listening table", () => {
    expect(rawToBand("listening", 39)).toBe(9);
    expect(rawToBand("listening", 32)).toBe(7.5);
    expect(rawToBand("listening", 30)).toBe(7);
    expect(rawToBand("listening", 26)).toBe(6.5);
    expect(rawToBand("listening", 18)).toBe(5.5);
    expect(rawToBand("listening", 16)).toBe(5);
  });
  it("scales short tests to /40 before converting", () => {
    expect(rawToBand("reading", 10, 13)).toBe(rawToBand("reading", 31)); // 30.77 -> 31
    expect(rawToBand("listening", 0, 10)).toBe(rawToBand("listening", 0));
  });
  it("clamps out-of-range raw scores", () => {
    expect(rawToBand("reading", 45)).toBe(9);
    expect(rawToBand("reading", -3)).toBe(rawToBand("reading", 0));
  });
});

describe("writingBand", () => {
  it("weights Task 2 double", () => {
    // (6 + 2*7) / 3 = 6.67 -> 6.5
    expect(writingBand(6, 7)).toBe(6.5);
    // (7 + 2*7) / 3 = 7
    expect(writingBand(7, 7)).toBe(7);
  });
  it("uses the single task when only one is given", () => {
    expect(writingBand(null, 6.5)).toBe(6.5);
    expect(writingBand(6, null)).toBe(6);
  });
});
