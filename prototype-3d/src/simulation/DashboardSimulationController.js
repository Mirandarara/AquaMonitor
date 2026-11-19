import { SimulationController } from "./SimulationController.js";
import { SIMULATION_CONFIG } from "../features/simulation/engine/simulation.ts";
import { followDashboard, DASHBOARD_STALE_MS } from "../../../src/features/simulation/engine/dashboardBridge.ts";

// Keep the dashboard transport separate from the prototype's hydraulic model.
export class DashboardSimulationController extends SimulationController {
  constructor(mqtt, follow = followDashboard) {
    const bridge = { mqtt: null };
    super({
      start: (credentials) => mqtt.start(credentials),
      publish: (command) => mqtt.publish(command),
      stop: () => mqtt.stop(),
      getSnapshot: () => bridge.mqtt ?? mqtt.getSnapshot(),
    });
    this.bridge = bridge;
    this.follow = follow;
    this.dashboardAt = null;
    this.stopDashboard = null;
  }

  setMode(mode) {
    if (!["demo", "mqtt", "dashboard"].includes(mode) || mode === this.mode) return;
    this.stopDashboard?.();
    this.stopDashboard = null;
    this.bridge.mqtt = null;
    this.dashboardAt = null;
    if (mode !== "dashboard") return super.setMode(mode);
    this.mqtt.stop();
    this.mode = mode;
    this.tour = false;
    this.liveDam = SIMULATION_CONFIG.initialTankLiters / SIMULATION_CONFIG.defaultCapacityLiters;
    this.stopDashboard = this.follow((state) => {
      this.dashboardAt = state ? Date.now() : null;
      this.bridge.mqtt = state && "mqtt" in state ? state.mqtt : null;
      if (state && !("mqtt" in state)) this.state = state;
    });
  }

  tick(dt, now = Date.now()) {
    if (this.mode === "dashboard" && !this.bridge.mqtt) return this.view(now);
    return super.tick(dt, now);
  }

  view(now = Date.now()) {
    if (this.mode !== "dashboard") return super.view(now);
    const fresh = this.dashboardAt !== null && now - this.dashboardAt < DASHBOARD_STALE_MS;
    let view;
    if (this.bridge.mqtt) {
      view = super.view(now);
    } else {
      // Reuse the local state projection without advancing the dashboard engine.
      this.mode = "demo";
      try { view = super.view(now); }
      finally { this.mode = "dashboard"; }
      view.input = "Simulação local do dashboard";
    }
    view.fresh = view.fresh && fresh;
    if (!view.fresh) {
      view.drain = "unknown";
      view.reuse = "unknown";
      view.sensor = null;
      view.running = false;
      view.alarm = "Abra o dashboard e aguarde a conexão";
    }
    view.drainFlow = view.drainFlow && view.fresh;
    view.reuseFlow = view.reuseFlow && view.fresh;
    return view;
  }

  dispose() {
    this.stopDashboard?.();
    this.stopDashboard = null;
    this.mqtt.stop();
  }
}
