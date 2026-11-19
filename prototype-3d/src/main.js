import "./styles/main.css";
import "./styles/brand.css";
import { SceneManager } from "./scene/SceneManager.js";
import { DashboardSimulationController as SimulationController } from "./simulation/DashboardSimulationController.js";
import { aquaMqtt } from "./mqtt/mqttClient.js";
import { layout, bindControls } from "./ui/Controls.js";
layout();
const embedded = new URLSearchParams(location.search).get("embed") === "true";
if (embedded) document.body.classList.add("dashboard-embed");
const mqtt = aquaMqtt,
  sim = new SimulationController(mqtt);
let scene,
  ui,
  frame,
  last = performance.now(),
  elapsed = 0;
try {
  scene = new SceneManager(document.querySelector("#scene"), (key, move) =>
    ui?.select(key, move),
  );
  ui = bindControls(sim, scene);
  if (embedded) {
    scene.scene.background.set(0xeef6fc);
    scene.atmosphere.clear.set(0xeef6fc);
    scene.scene.fog.color.set(0xeef6fc);
    scene.scene.traverse((object) => {
      if (object.isGridHelper) object.visible = false;
      if (object.isMesh && object.geometry.parameters?.width === 200) object.material.color.set(0xeef6fc);
    });
    scene.cameraController.camera.position.set(24, 16, 29);
    scene.cameraController.controls.target.set(0, -0.5, -1);
    scene.cameraController.controls.update();
  }
  if (new URLSearchParams(location.search).get("source") === "dashboard")
    document.getElementById("dashboard-mode").click();
  function animate(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    const view = sim.tick(dt);
    scene.update(dt, view);
    ui.update(view, elapsed);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });
  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(frame);
      sim.dispose();
      ui?.dispose();
      scene.dispose();
    },
    { once: true },
  );
  document.querySelector("canvas").addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    cancelAnimationFrame(frame);
    const el = document.querySelector("#error");
    el.textContent =
      "A renderização foi interrompida. Recarregue a página e selecione qualidade baixa.";
    el.hidden = false;
  });
} catch (error) {
  const el = document.querySelector("#error");
  el.textContent = `Não foi possível iniciar o ambiente 3D. Verifique se WebGL está habilitado. ${error.message}`;
  el.hidden = false;
  console.error(error);
}
