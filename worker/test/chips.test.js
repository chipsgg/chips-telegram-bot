import assert from "node:assert/strict";
import { test } from "node:test";
import { ChipsError, createApi } from "../src/lib/chips.js";

// Scripted fetch: each entry is one response, in order
const scripted = (responses) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error("fetch called more than scripted");
    return new Response(r.body, { status: r.status });
  };
  return { fetchImpl, calls };
};

const quiet = async (fn) => {
  const w = console.warn;
  const e = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.warn = w;
    console.error = e;
  }
};

test("chips api: 500 'Please wait and try again later' is a throttle -> retried, then served", async () => {
  const { fetchImpl, calls } = scripted([
    { status: 500, body: "Please wait and try again later" },
    { status: 200, body: JSON.stringify({ id: "u1", username: "bob" }) },
  ]);
  const api = createApi({ token: "t", fetchImpl });
  const out = await quiet(() =>
    api.auth("getUserByPlatformID", { platform: "telegram", platformid: "1" })
  );
  assert.deepEqual(out, { id: "u1", username: "bob" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, calls[1].url);
  assert.match(calls[0].url, /\/auth\/getUserByPlatformID$/);
  assert.equal(calls[0].init.headers.authorization, "Bearer t");
});

test("chips api: an ordinary 500 is NOT retried and surfaces as ChipsError", async () => {
  const { fetchImpl, calls } = scripted([
    { status: 500, body: "user not found" },
  ]);
  const api = createApi({ fetchImpl });
  await quiet(() =>
    assert.rejects(
      api.auth("getUserByPlatformID", {
        platform: "telegram",
        platformid: "1",
      }),
      (err) =>
        err instanceof ChipsError &&
        err.status === 500 &&
        /user not found/.test(err.message)
    )
  );
  assert.equal(calls.length, 1);
});

test("chips api: throttle that never clears gives up after the backoff schedule", async () => {
  const { fetchImpl, calls } = scripted(
    Array.from({ length: 4 }, () => ({
      status: 500,
      body: "Please wait and try again later",
    }))
  );
  const api = createApi({ fetchImpl });
  await quiet(() =>
    assert.rejects(api.public("getPlayer", { userid: "x" }), /Please wait/)
  );
  assert.equal(calls.length, 4, "1 try + 3 retries");
});
