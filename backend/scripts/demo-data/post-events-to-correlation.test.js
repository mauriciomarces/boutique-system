const test = require("node:test");
const assert = require("node:assert/strict");
const { postEvents } = require("./post-events-to-correlation");

test("posts only seed-owned events to the local correlation API", async () => {
  const events = [
    { event_id: "demo-42-normal-sale", metadata: { fixture: "demo-seed", scenario: "normal" } },
    { event_id: "demo-42-anomalous-login", metadata: { fixture: "demo-seed", scenario: "anomalous" } },
  ];
  let requests = 0;
  const result = await postEvents(events, async (url, request) => {
    requests += 1;
    assert.equal(url, "http://127.0.0.1:4007/events");
    assert.equal(request.method, "POST");
    assert.equal(JSON.parse(request.body).event_id, events[requests - 1].event_id);
    return new Response(JSON.stringify({
      event_id: events[requests - 1].event_id,
      ingest_status: requests === 1 ? "created" : "duplicate",
    }), { status: requests === 1 ? 201 : 200 });
  });

  assert.deepEqual(result, { created: 1, duplicate: 1 });
  assert.equal(requests, 2);
});

test("refuses non-seed events before making requests", async () => {
  let requests = 0;
  await assert.rejects(
    postEvents([{ event_id: "operational-event", metadata: {} }], async () => {
      requests += 1;
    }),
    /eventos/,
  );
  assert.equal(requests, 0);
});

test("reports the endpoint status without exposing the response body", async () => {
  await assert.rejects(
    postEvents([{
      event_id: "demo-42-normal-sale",
      metadata: { fixture: "demo-seed", scenario: "normal" },
    }], async () => new Response("sensitive response content", { status: 409 })),
    /HTTP 409/,
  );
});
