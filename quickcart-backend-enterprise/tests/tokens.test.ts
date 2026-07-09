import { generateOpaqueToken, hashToken } from "../src/lib/tokens";

describe("generateOpaqueToken / hashToken", () => {
  it("produces a raw token whose hash matches hashToken() of the same raw value", () => {
    const { raw, hash } = generateOpaqueToken();
    expect(hashToken(raw)).toBe(hash);
  });

  it("produces different tokens on each call", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("never returns the raw value as the hash", () => {
    const { raw, hash } = generateOpaqueToken();
    expect(hash).not.toBe(raw);
  });
});
