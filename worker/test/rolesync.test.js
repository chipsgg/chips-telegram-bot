import assert from "node:assert/strict";
import { test } from "node:test";
import {
  memoryRegistry,
  runRoleSync,
  sqliteRegistry,
  syncOne,
} from "../src/lib/rolesync.js";

const FLIPPER = "1106398232382291978";
const COLLECTOR = "1106398500020834405";

const withDiscord = async (fn) => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(`${init?.method} ${String(url).replace(/^.*\/guilds\//, "")}`);
    return { ok: true, status: 204, text: async () => "" };
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = orig;
  }
};

test("registry: memory and sqlite agree; list is least-recently-synced first", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  for (const [name, reg] of Object.entries({
    memory: memoryRegistry(),
    sqlite: sqliteRegistry(new DatabaseSync(":memory:")),
  })) {
    await reg.upsert({
      discordId: "1",
      chipsUserid: "a",
      username: "alice",
      rank: "Flipper I",
      roleId: FLIPPER,
    });
    await reg.upsert({
      discordId: "2",
      chipsUserid: "b",
      username: "bob",
      rank: null,
      roleId: null,
    });
    await new Promise((r) => setTimeout(r, 15)); // synced_at is ms; alice's re-link must be strictly later
    await reg.upsert({
      discordId: "1",
      chipsUserid: "a",
      username: "alice2",
      rank: "Flipper II",
      roleId: FLIPPER,
    }); // re-link updates
    assert.equal(await reg.count(), 2, name);
    const list = await reg.list(10);
    assert.equal(list.length, 2, name);
    assert.equal(
      list[0].discordId,
      "2",
      `${name}: bob synced least recently comes first`
    );
    assert.equal(list[1].username, "alice2", name);
  }
});

test("syncOne: unchanged rank -> no Discord calls; rank up -> remove old, add new; no guild -> skipped", async () => {
  const env = { DISCORD_TOKEN: "t", DISCORD_ROLES_GUILD_ID: "G" };
  const reg = memoryRegistry();
  await withDiscord(async (calls) => {
    const same = await syncOne(
      env,
      reg,
      { discordId: "1", chipsUserid: "a", rank: "Flipper I", roleId: FLIPPER },
      { vip: { rank: "Flipper I" } }
    );
    assert.equal(same, "unchanged");
    assert.equal(calls.length, 0);

    const up = await syncOne(
      env,
      reg,
      { discordId: "1", chipsUserid: "a", rank: "Flipper I", roleId: FLIPPER },
      { username: "alice", vip: { rank: "Collector II" } }
    );
    assert.equal(up, "updated");
    assert.deepEqual(calls, [
      `DELETE G/members/1/roles/${FLIPPER}`,
      `PUT G/members/1/roles/${COLLECTOR}`,
    ]);
    const stored = (await reg.list())[0];
    assert.equal(stored.roleId, COLLECTOR);
    assert.equal(stored.rank, "Collector II");

    calls.length = 0;
    // first sync of a pre-registry link (roleId unknown): just add
    const first = await syncOne(
      env,
      reg,
      { discordId: "2", chipsUserid: "b", rank: null, roleId: null },
      { vip: { rank: "Flipper III" } }
    );
    assert.equal(first, "updated");
    assert.deepEqual(calls, [`PUT G/members/2/roles/${FLIPPER}`]);
  });
  assert.equal(
    await syncOne(
      { DISCORD_TOKEN: "t" },
      reg,
      { discordId: "1" },
      { vip: { rank: "Flipper I" } }
    ),
    "skipped"
  );
});

test("runRoleSync: walks the registry, tolerates missing players, unconfigured -> skipped", async () => {
  const env = { DISCORD_TOKEN: "t", DISCORD_ROLES_GUILD_ID: "G" };
  const reg = memoryRegistry();
  await reg.upsert({
    discordId: "1",
    chipsUserid: "a",
    rank: "Flipper I",
    roleId: FLIPPER,
  });
  await reg.upsert({
    discordId: "2",
    chipsUserid: "gone",
    rank: null,
    roleId: null,
  });
  await reg.upsert({
    discordId: "3",
    chipsUserid: "c",
    rank: "Flipper I",
    roleId: FLIPPER,
  });
  const api = {
    public: async (_m, { userid }) => {
      if (userid === "gone") throw new Error("id not found");
      return {
        username: userid,
        vip: { rank: userid === "c" ? "Collector I" : "Flipper I" },
      };
    },
  };
  const origTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => origTimeout(fn, 0); // skip the 250ms pacing in tests
  try {
    const out = await withDiscord(() =>
      runRoleSync({ env, api, registry: reg })
    );
    assert.deepEqual(out, {
      checked: 3,
      updated: 1,
      unchanged: 1,
      failed: 0,
      missing: 1,
    });
  } finally {
    globalThis.setTimeout = origTimeout;
  }
  assert.deepEqual(await runRoleSync({ env: {}, api, registry: reg }), {
    skipped: "unconfigured",
  });
});
