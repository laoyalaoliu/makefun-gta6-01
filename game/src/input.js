// Keyboard and mouse input: a held-keys set for movement, an edge-triggered
// pressed set for one-shot actions (punch, enter car, pause), and the mouse
// position plus clicks for the menu screens.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (!held.has(code)) pressed.add(code);
    held.add(code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.clicked = true;
    mouse.clickX = event.clientX - rect.left;
    mouse.clickY = event.clientY - rect.top;
  });

  return {
    mouse,
    isHeld(...codes) { return codes.some((code) => held.has(code)); },
    wasPressed(...codes) { return codes.some((code) => pressed.has(code)); },
    /** Movement axes from WASD or the arrow keys, each -1..1. */
    moveAxes() {
      const x = (this.isHeld('KeyD', 'ArrowRight') ? 1 : 0) - (this.isHeld('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (this.isHeld('KeyS', 'ArrowDown') ? 1 : 0) - (this.isHeld('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Call once per frame after the game has read the edge-triggered keys. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
