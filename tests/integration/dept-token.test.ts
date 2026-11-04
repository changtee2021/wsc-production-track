import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createDeptTokenVerifier } from "../../src/lib/auth/dept-token.server.ts";

const SECRET = "iso-test-secret";
const PASSWORD = "iso-test-password";

describe("department token verifier with fake secrets", () => {
  const previous = {
    secret: process.env.ISO_TEST_TOKEN_SECRET,
    password: process.env.ISO_TEST_PASSWORD,
  };

  process.env.ISO_TEST_TOKEN_SECRET = SECRET;
  process.env.ISO_TEST_PASSWORD = PASSWORD;

  after(() => {
    if (previous.secret === undefined) delete process.env.ISO_TEST_TOKEN_SECRET;
    else process.env.ISO_TEST_TOKEN_SECRET = previous.secret;
    if (previous.password === undefined) delete process.env.ISO_TEST_PASSWORD;
    else process.env.ISO_TEST_PASSWORD = previous.password;
  });

  const tokens = createDeptTokenVerifier({
    prefix: "iso-test:",
    secretEnv: ["ISO_TEST_TOKEN_SECRET"],
    passwordEnv: "ISO_TEST_PASSWORD",
    passwordTag: "iso-test-pw",
    label: "ISO test",
    ttlMs: 60_000,
  });

  it("accepts a token it just issued", () => {
    assert.equal(tokens.verify(tokens.issue()), true);
  });

  it("rejects a blank token and a token with a broken signature", () => {
    assert.equal(tokens.verify(undefined), false);
    assert.equal(tokens.verify("123.abcd"), false);
  });

  it("rejects an expired token", () => {
    const expired = createDeptTokenVerifier({
      prefix: "iso-test:",
      secretEnv: ["ISO_TEST_TOKEN_SECRET"],
      label: "ISO test",
      ttlMs: -1,
    });
    assert.equal(expired.verify(expired.issue()), false);
  });

  it("checks the fake password without reading production env names", () => {
    assert.equal(tokens.checkPassword(PASSWORD), true);
    assert.equal(tokens.checkPassword("wrong-password"), false);
  });
});
