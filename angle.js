export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function lerpAngle(from, to, maxStep) {
  let diff = normalizeAngle(to - from);
  if (Math.abs(diff) < maxStep) return to;
  return from + Math.sign(diff) * maxStep;
}
