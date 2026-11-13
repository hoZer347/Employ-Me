// The access rule behind in-place text editing, which is the part of it that
// has to be right: loomhozer.ca arrives through the Cloudflare tunnel, so
// cloudflared holds the socket and every visitor on the internet looks like the
// host. Getting this wrong publishes the editor rather than breaking it, so the
// tunnel shapes are pinned here.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const edit = require("../tools/edit-server.cjs");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES = path.join(ROOT, "public", "content-overrides.json");

const server = http.createServer((req, res) => {
  if (!edit.handle(req, res)) {
    res.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const PORT = server.address().port;

// undici drops a Host header on the floor, so requests go out over node:http
// where the header actually reaches the wire.
function call(urlPath, { host = `127.0.0.1:${PORT}`, headers = {}, method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path: urlPath,
        method,
        headers: {
          Host: host,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
      },
      (res) => {
        let out = "";
        res.on("data", (chunk) => (out += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: out }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const session = async (options) => JSON.parse((await call("/__edit/session", options)).body).editable;

test("the host machine may edit", async () => {
  assert.equal(await session(), true);
  assert.equal(await session({ host: `localhost:${PORT}` }), true);
  assert.equal(await session({ host: `[::1]:${PORT}` }), true);
});

test("a request through the tunnel may not, whatever its socket says", async () => {
  for (const header of [
    "CF-Connecting-IP",
    "CF-Ray",
    "CDN-Loop",
    "X-Forwarded-For",
    "X-Real-IP",
    "Forwarded",
    "Via",
  ]) {
    assert.equal(await session({ headers: { [header]: "203.0.113.7" } }), false, header);
  }
});

test("a request for a public hostname may not either", async () => {
  assert.equal(await session({ host: "loomhozer.ca" }), false);
  assert.equal(await session({ host: "www.loomhozer.ca" }), false);
});

test("a name that merely resolves here is not a local Host", async () => {
  // DNS rebinding: these are names someone else owns, pointed at 127.0.0.1.
  assert.equal(await session({ host: `127.0.0.1.nip.io:${PORT}` }), false);
  assert.equal(await session({ host: `127.0.0.1.evil.example:${PORT}` }), false);
  assert.equal(await session({ host: `127.evil.example:${PORT}` }), false);
  assert.equal(await session({ host: `localhost.evil.example:${PORT}` }), false);
});

test("another site the host has open cannot reach the editor", async () => {
  assert.equal(await session({ headers: { Origin: "https://evil.example" } }), false);
  assert.equal(await session({ headers: { "Sec-Fetch-Site": "cross-site" } }), false);
  assert.equal(await session({ headers: { "Sec-Fetch-Site": "same-site" } }), false);
  // The site's own page, which is the one case that has to keep working.
  assert.equal(
    await session({
      headers: { Origin: `http://127.0.0.1:${PORT}`, "Sec-Fetch-Site": "same-origin" },
    }),
    true,
  );
});

test("a save that dodges the JSON preflight is refused", async () => {
  const body = JSON.stringify({ key: "#app/p:0", html: "hi", original: "hi" });
  for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
    const res = await call("/__edit/save", {
      method: "POST",
      body,
      headers: { "Content-Type": type },
    });
    assert.equal(res.status, 415, type);
  }
});

test("an edit may change the words and nothing else", async () => {
  const post = (html, original) =>
    call("/__edit/save", { method: "POST", body: JSON.stringify({ key: "#app/p:0", html, original }) });

  const rendered = 'Liam <span class="text-sky-400">Brown</span>';
  // The reject-list shapes that a list of forbidden tags and " on...=" misses.
  for (const html of [
    `${rendered}<img/onerror=alert(1) src=x>`,
    `${rendered}<svg/onload=alert(1)>`,
    `Liam <span class="text-sky-400" onmouseover=alert(1)>Brown</span>`,
    `Liam <a href="jav&#x61;script:alert(1)">Brown</a>`,
    `${rendered}<img onerror=alert(1)`,
  ]) {
    assert.equal((await post(html, rendered)).status, 400, html);
  }
});

test("saving is refused for anyone but the host", async () => {
  const body = JSON.stringify({ key: "#app/p:0", html: "hi", original: "yo" });
  const res = await call("/__edit/save", {
    method: "POST",
    body,
    headers: { "CF-Connecting-IP": "203.0.113.7" },
  });
  assert.equal(res.status, 403);
});

test("a malformed payload is refused", async () => {
  const post = (payload) =>
    call("/__edit/save", { method: "POST", body: JSON.stringify(payload) });

  assert.equal((await post({ key: "../../etc/passwd", html: "x", original: "x" })).status, 400);
  assert.equal((await post({ key: "#app/p:0", html: 42, original: "y" })).status, 400);
  assert.equal((await call("/__edit/save", { method: "POST", body: "not json" })).status, 400);
});

test("a save is stored, and typing the original back clears it", async (t) => {
  const before = fs.readFileSync(OVERRIDES, "utf8");
  t.after(() => fs.writeFileSync(OVERRIDES, before));

  const key = "#app/main:1/section:0/h1:0";
  const rendered = 'Liam <span class="text-sky-400">Brown</span>';
  const post = (html) =>
    call("/__edit/save", {
      method: "POST",
      body: JSON.stringify({ key, html, original: rendered }),
    });

  const edited = 'Liam James <span class="text-sky-400">Brown</span><br>of somewhere';
  assert.equal((await post(edited)).status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(OVERRIDES, "utf8"))[key], {
    html: edited,
    original: rendered,
  });

  assert.equal(JSON.parse((await post(rendered)).body).cleared, true);
  assert.equal(JSON.parse(fs.readFileSync(OVERRIDES, "utf8"))[key], undefined);
});

test.after(() => server.close());
