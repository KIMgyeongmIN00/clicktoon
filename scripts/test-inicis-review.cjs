/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");
process.chdir(path.resolve(__dirname, ".."));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith("@/") ? path.resolve(name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
let user = { id: "user" };
let inserted;
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === "@/lib/supabase/session") return { getSessionUser: async () => user };
  if (name === "@/lib/supabase/server") return { serverSupabase: () => ({ from: () => ({ insert: async (row) => { inserted = row; return { error: null }; } }) }) };
  return load.call(this, name, ...args);
};
const { NextRequest } = require("next/server");
const { POST } = require("../app/api/payments/inicis/prepare/route.ts");
const { reviewApprovalUrl, reviewHash } = require("../lib/payments/inicis-review.ts");
const request = (body) => new NextRequest("https://example.com/api/payments/inicis/prepare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("plan prices are server controlled and tests never grant credits", async () => {
  for (const [planId, amount] of [["basic", 170000], ["pro", 320000], ["premium", 500000]]) {
    const response = await POST(request({ planId, amount: 1 }));
    const fields = await response.json();
    assert.equal(response.status, 200);
    assert.equal(fields.P_AMT, String(amount));
    assert.equal(inserted.amount, amount);
    assert.equal(inserted.credits, 0);
    assert.equal(fields.P_CHKFAKE, reviewHash(amount, fields.P_OID, fields.P_TIMESTAMP));
  }
});
test("unknown plans and anonymous orders are rejected", async () => {
  assert.equal((await POST(request({ planId: "other" }))).status, 400);
  user = null;
  assert.equal((await POST(request({ planId: "basic" }))).status, 401);
  user = { id: "user" };
});
test("approval hosts are allowlisted", () => {
  assert.equal(reviewApprovalUrl("fc"), "https://fcpaypro.inicis.com/payment/v1/rest/payAppl.ini");
  assert.equal(reviewApprovalUrl("attacker.example/"), null);
});
