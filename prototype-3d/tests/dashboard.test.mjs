import test from "node:test";
import assert from "node:assert/strict";
import { DashboardSimulationController } from "../src/simulation/DashboardSimulationController.js";

function fixture() {
  let receive, started = 0, stopped = 0, closed = 0;
  const sim = new DashboardSimulationController({
    start: () => started++,
    stop: () => stopped++,
    getSnapshot: () => ({ connection: "offline", telemetry: null }),
  }, (callback) => {
    receive = callback;
    return () => closed++;
  });
  return { sim, receive: (state) => receive(state), counts: () => ({ started, stopped, closed }) };
}

test("dashboard state stays authoritative and stale transport stops both flows", () => {
  const f = fixture(), sim = f.sim;
  sim.setMode("dashboard");
  const state = { ...sim.state, galleryLiters: 22, tankLiters: 10, running: true, drainage: "on", reuse: "on" };
  f.receive(state);
  const now = sim.dashboardAt;
  const before = JSON.stringify(state);
  const view = sim.tick(1, now);
  assert.equal(view.levelCm, 22);
  assert.equal(view.dam, 0.25);
  assert.equal(view.drainFlow, true);
  assert.equal(view.reuseFlow, true);
  sim.dispatch({ type: "rain", value: 100 });
  assert.equal(JSON.stringify(state), before);
  const stale = sim.tick(1, now + 4001);
  assert.equal(stale.fresh, false);
  assert.equal(stale.drainFlow, false);
  assert.equal(stale.reuseFlow, false);
  sim.dispose();
});

test("dashboard MQTT uses the shared snapshot without opening another connection", () => {
  const f = fixture(), sim = f.sim, now = Date.now();
  sim.setMode("dashboard");
  f.receive({ mqtt: {
    connection: "connected", deviceStatus: "online", receivedAt: now,
    telemetry: { sensor_ok: true, level_pct: 73.3, level_cm: 22, distance_cm: 8, drain_on: true, reuse_on: false, alarm: false },
  } });
  assert.equal(sim.tick(1, now).drainFlow, true);
  assert.equal(f.counts().started, 0);
  const dam = sim.liveDam;
  assert.equal(sim.tick(1, now + 4001).drainFlow, false);
  assert.equal(sim.liveDam, dam);
  sim.setMode("mqtt");
  assert.equal(f.counts().closed, 1);
  assert.equal(f.counts().started, 1);
  sim.dispose();
});

test("leaving dashboard restores local controls and releases its subscription", () => {
  const f = fixture(), sim = f.sim;
  sim.setMode("dashboard");
  assert.equal(sim.view().fresh, false);
  sim.setMode("demo");
  sim.dispatch({ type: "rain", value: 60 });
  assert.equal(sim.state.rain, 60);
  assert.equal(f.counts().closed, 1);
  sim.dispose();
});
