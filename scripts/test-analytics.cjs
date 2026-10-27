/* eslint-disable @typescript-eslint/no-require-imports */
// Run local TypeScript modules with mocked transports; never contacts Mixpanel/DB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

process.chdir(path.resolve(__dirname, ".."));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.resolve(name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText, filename);

const calls = [];
const sdk = {
  init: (...args) => calls.push(["init", ...args]),
  get_property: () => undefined,
  identify: (...args) => calls.push(["identify", ...args]),
  reset: () => calls.push(["reset"]),
  track: (...args) => calls.push(["track", ...args]),
};
let transitionedRows = [];
let dbSelection;
const query = {
  update() { return this; }, eq() { return this; }, in() { return this; },
  async select(selection) { dbSelection = selection; return { data: transitionedRows, error: null }; },
};
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === "mixpanel-browser") return sdk;
  if (name === "@supabase/ssr") return {
    createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  };
  if (name === "@/lib/supabase/server") return {
    serverSupabase: () => ({ from: () => query, rpc: async () => ({ error: null }) }),
  };
  return originalLoad.call(this, name, ...args);
};

global.window = { location: { pathname: "/characters/private-id", search: "?paymentKey=secret&poseDebug=1" } };
global.document = { cookie: "" };
global.sessionStorage = { setItem() {} };
const deliveries = [];
global.fetch = async (url, options) => {
  deliveries.push({ url, options, events: JSON.parse(options.body) });
  return { ok: true, json: async () => ({ status: 1 }) };
};

const { ANALYTICS_EVENTS, validProperties } = require("../lib/analytics/events.ts");
const { analyticsPage } = require("../lib/analytics/config.ts");
const browser = require("../lib/analytics/browser.ts");
const { trackServer } = require("../lib/analytics/server.ts");
const { markDone, markFailed } = require("../lib/generation/finalize.ts");

test("public build defaults enable only Vercel production and allow explicit disable", () => {
  const names = ["VERCEL_ENV", "NEXT_PUBLIC_ANALYTICS_ENABLED", "NEXT_PUBLIC_MIXPANEL_TOKEN", "NEXT_PUBLIC_MIXPANEL_REGION", "NEXT_PUBLIC_ANALYTICS_ENVIRONMENT"];
  const saved = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  const configPath = require.resolve("../next.config.ts");
  function config() { delete require.cache[configPath]; return require(configPath).default.env; }
  try {
    names.forEach((key) => delete process.env[key]);
    assert.equal(config().NEXT_PUBLIC_ANALYTICS_ENABLED, "false");
    process.env.VERCEL_ENV = "preview";
    assert.equal(config().NEXT_PUBLIC_ANALYTICS_ENABLED, "false");
    process.env.VERCEL_ENV = "production";
    assert.equal(config().NEXT_PUBLIC_ANALYTICS_ENABLED, "true");
    assert.equal(config().NEXT_PUBLIC_MIXPANEL_REGION, "US");
    assert.equal(config().NEXT_PUBLIC_MIXPANEL_TOKEN, "241a913b00508c200214be0fa6ecdfbf");
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
    assert.equal(config().NEXT_PUBLIC_ANALYTICS_ENABLED, "false");
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = "";
    assert.equal(config().NEXT_PUBLIC_MIXPANEL_TOKEN, "");
  } finally {
    for (const key of names) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    delete require.cache[configPath];
  }
});

test("pose debug URL is development-only while normal pages remain accessible", async () => {
  const previous = process.env.NODE_ENV;
  const { NextRequest } = require("next/server");
  const proxy = require("../proxy.ts").default;
  try {
    for (const environment of ["production", "test"]) {
      process.env.NODE_ENV = environment;
      assert.equal((await proxy(new NextRequest("http://localhost/?poseDebug=1"))).status, 404);
      assert.equal((await proxy(new NextRequest("http://localhost/?poseDebug=0"))).status, 404);
      assert.equal((await proxy(new NextRequest("http://localhost/"))).status, 200);
    }
    process.env.NODE_ENV = "development";
    assert.equal((await proxy(new NextRequest("http://localhost/?poseDebug=1"))).status, 200);
    assert.match(fs.readFileSync("app/(app)/page.tsx", "utf8"), /process\.env\.NODE_ENV === "development" && searchParams/);
    assert.match(fs.readFileSync("components/pose-editor/pose-debug-panel.tsx", "utf8"), /process\.env\.NODE_ENV !== "development"/);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("missing token or disabled flag prevents SDK initialization and all transport", async () => {
  delete process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
  browser.track("login_started", { method: "google" });
  await trackServer("quota_limit_reached", { kind: "pose" }, { userId: "u1", eventKey: "test" });
  assert.equal(calls.length, 0);
  assert.equal(deliveries.length, 0);
  process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = "test-token-not-real";
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false";
  browser.identifyAnalytics("u1");
  await trackServer("quota_limit_reached", { kind: "pose" }, { userId: "u1", eventKey: "test" });
  assert.equal(calls.length, 0);
  assert.equal(deliveries.length, 0);
});

test("event schema strips unapproved data and rejects invalid properties", () => {
  assert.deepEqual(validProperties("login_started", { method: "google", email: "private@example.com" }), { method: "google" });
  assert.equal(validProperties("login_started", { method: "invented" }), null);
  assert.equal(validProperties("generation_requested", { kind: "pose" }), null);
  assert.equal(analyticsPage("/characters/private-id"), "/characters/:id");
});

test("browser disables automatic capture and tracks only validated, sanitized properties", () => {
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
  process.env.NEXT_PUBLIC_ANALYTICS_INTERNAL_USER_IDS = "internal-user";
  process.env.NEXT_PUBLIC_ANALYTICS_ENVIRONMENT = "test";
  browser.identifyAnalytics("internal-user");
  const configuration = calls.find(([name]) => name === "init")[2];
  assert.equal(configuration.autocapture, false);
  assert.equal(configuration.track_pageview, false);
  assert.equal(configuration.record_sessions_percent, 0);
  assert.equal(configuration.ip, false);
  assert.ok(configuration.property_blacklist.includes("$current_url"));
  browser.track("login_started", { method: "google", password: "secret" });
  const tracked = calls.filter(([name]) => name === "track").at(-1)[2];
  assert.equal(tracked.page, "/characters/:id");
  assert.equal(tracked.is_internal, true);
  assert.equal(tracked.is_pose_debug, true);
  assert.equal(tracked.password, undefined);
  assert.ok(!JSON.stringify(tracked).includes("paymentKey"));
  const length = calls.length;
  browser.track("login_started", { method: "bad" });
  assert.equal(calls.length, length);
});

test("logout and account changes reset identity before the next user", () => {
  const start = calls.length;
  browser.identifyAnalytics(null);
  browser.identifyAnalytics("user-a");
  browser.identifyAnalytics("user-b");
  assert.deepEqual(calls.slice(start).map(([name, value]) => [name, value]), [
    ["reset", undefined], ["identify", "user-a"], ["reset", undefined], ["identify", "user-b"],
  ]);
});

test("server uses stable deduplication, known user and region without sensitive properties", async () => {
  process.env.NEXT_PUBLIC_MIXPANEL_REGION = "EU";
  const context = { userId: "u1", eventKey: "g1", occurredAt: "2026-10-27T00:00:00Z" };
  const properties = { generation_id: "g1", provider: "google", kind: "pose" };
  await trackServer("generation_queued", { ...properties, prompt: "private" }, context);
  await trackServer("generation_queued", properties, context);
  const [a, b] = deliveries.slice(-2);
  assert.ok(a.url.startsWith("https://api-eu.mixpanel.com/track"));
  assert.equal(a.events[0].properties.$insert_id, b.events[0].properties.$insert_id);
  assert.equal(a.events[0].properties.time, b.events[0].properties.time);
  assert.equal(a.events[0].properties.$user_id, "u1");
  assert.equal(a.events[0].properties.prompt, undefined);
});

test("failed analytics transport does not throw into the business operation", async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  global.fetch = async () => { throw new Error("offline"); };
  console.warn = () => {};
  try {
    await assert.doesNotReject(() => trackServer("quota_limit_reached", { kind: "pose" }, { userId: "u1", eventKey: "q1" }));
  } finally { global.fetch = originalFetch; console.warn = originalWarn; }
});

test("generation result emits only on actual transition, not duplicate callbacks", async () => {
  const row = { id: "g2", owner: "u1", kind: "pose", provider: "openai", created_at: "2026-10-27T00:00:00Z", updated_at: "2026-10-27T00:01:00Z" };
  transitionedRows = [row];
  await markDone("g2", { resultPath: "private-path", model: "demo", prompt: "private-prompt" });
  assert.ok(dbSelection.includes("owner"));
  const success = deliveries.at(-1).events[0];
  assert.equal(success.event, "generation_succeeded");
  assert.equal(success.properties.elapsed_ms, 60000);
  assert.equal(success.properties.is_demo, true);
  assert.ok(!JSON.stringify(success).includes("private-prompt"));
  transitionedRows = [];
  const before = deliveries.length;
  await markDone("g2", { resultPath: "private-path", model: "demo", prompt: "private" });
  await markFailed("g2", "should not emit");
  assert.equal(deliveries.length, before);
  transitionedRows = [row];
  await markFailed("g2", "429 private provider response with secret");
  const failure = deliveries.at(-1).events[0];
  assert.equal(failure.properties.failure_type, "rate_limit");
  assert.ok(!JSON.stringify(failure).includes("secret"));
});

test("every event is documented and has a real call site; every declared location exists", () => {
  const documentation = fs.readFileSync("docs/analytics.md", "utf8");
  const emitted = new Set();
  function scan(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isDirectory()) scan(filename);
      else if (/\.tsx?$/.test(filename)) {
        const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
        function visit(node) {
          if (ts.isCallExpression(node) && ["track", "trackServer"].includes(node.expression.getText(source)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const event = node.arguments[0].text;
            assert.ok(Object.hasOwn(ANALYTICS_EVENTS, event), `Unregistered event ${event}`);
            emitted.add(event);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  for (const folder of ["app", "components", "lib"]) scan(folder);
  for (const [name, definition] of Object.entries(ANALYTICS_EVENTS)) {
    assert.ok(documentation.includes('`' + name + '`'), `Undocumented event ${name}`);
    assert.ok(emitted.has(name), `Uninstrumented event ${name}`);
    for (const location of definition.locations) assert.ok(fs.existsSync(location), `${name}: missing ${location}`);
  }
});
