import { decodeJwtPayload } from "../jwt";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64url({ alg: "HS256" })}.${base64url(payload)}.fake-signature`;
}

describe("decodeJwtPayload", () => {
  it("decodes a well-formed JWT payload without verifying the signature", () => {
    const token = makeFakeJwt({ adminUserId: "u1", organizationId: "o1", role: "owner" });
    expect(decodeJwtPayload(token)).toEqual({ adminUserId: "u1", organizationId: "o1", role: "owner" });
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(decodeJwtPayload("")).toBeNull();
  });
});
