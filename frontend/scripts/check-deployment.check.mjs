import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOrigin } from "./check-deployment.mjs";
test("accepts a public HTTPS API origin", () =>
  assert.equal(
    validateOrigin("https://api.example.com"),
    "https://api.example.com",
  ));
for (const value of [
  "",
  "http://api.example.com",
  "https://api.example.com/api",
  "https://api.example.com/",
  "https://u:secret@api.example.com",
  "https://api.example.com?token=x",
  "https://localhost",
])
  test(`rejects invalid origin ${value.includes("secret") ? "credentials" : value}`, () =>
    assert.throws(() => validateOrigin(value)));
