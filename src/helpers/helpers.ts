function split(from: number, to: number, max: number) {
  const steps = Math.max(1, Math.ceil((to - from) / max - 1e-9));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push(from + ((to - from) * i) / steps);
  }
  console.log("points: ", points)
  return points;
}

export function columnCentres(size: number, column_size: number, step_colummn: number) {
  const half = column_size/ 2;
  return split(-size / 2 + half, size / 2 - half, step_colummn);
}

/** Division points of all spans between columns, together with the columns themselves. */
export function stepsBetween(centres: number[], max: number ) {
  const points = [];
  for (let i = 0; i < centres.length - 1; i++) {
    points.push(...split(centres[i], centres[i + 1], max).slice(0, -1));
  }
  points.push(centres[centres.length - 1]);
  return points;
}