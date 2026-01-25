export function getRequiredCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`Missing canvas element: #${id}`);
  }
  return el;
}

