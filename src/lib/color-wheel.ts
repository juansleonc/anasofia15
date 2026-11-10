// Pure geometry for the dress-color wheel: slice outlines (SVG path data) and the rotor
// rotation that centers a chosen slice under the fixed top pointer. Framework-free so both are
// unit-testable without mounting the SVG/DOM the wheel island renders.

function pointOnCircle(center: number, radius: number, angleDeg: number): [number, number] {
  // Offset by -90deg so angle 0 lands at twelve o'clock instead of three o'clock.
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return [center + radius * Math.cos(angleRad), center + radius * Math.sin(angleRad)];
}

/**
 * SVG path (as a pie slice from `center`) for slice `index` of `count` equal slices, starting
 * at twelve o'clock for slice 0 and sweeping clockwise.
 */
export function slicePath(index: number, count: number, radius: number, center: number): string {
  const sliceAngle = 360 / count;
  const startAngle = index * sliceAngle;
  const endAngle = startAngle + sliceAngle;
  const [startX, startY] = pointOnCircle(center, radius, startAngle);
  const [endX, endY] = pointOnCircle(center, radius, endAngle);
  const largeArcFlag = sliceAngle > 180 ? 1 : 0;

  return (
    `M${center},${center} ` +
    `L${startX},${startY} ` +
    `A${radius},${radius} 0 ${largeArcFlag} 1 ${endX},${endY} Z`
  );
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Smallest forward (clockwise) rotation, from `currentDeg`, that centers slice `index` of
 * `count` under the wheel's fixed top pointer — plus one full turn, so every new pick is a
 * visible spin. Returns `currentDeg` unchanged if that slice is already centered.
 */
export function nextRotation(currentDeg: number, index: number, count: number): number {
  const sliceAngle = 360 / count;
  const target = normalizeDeg(-(index + 0.5) * sliceAngle);
  const currentMod = normalizeDeg(currentDeg);

  if (currentMod === target) return currentDeg;

  let delta = target - currentMod;
  if (delta <= 0) delta += 360;

  return currentDeg + delta + 360;
}
