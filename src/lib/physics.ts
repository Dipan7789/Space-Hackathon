/**
 * Orbital Physics Engine
 * Implements RK4 integration with Earth gravity and J2 perturbation.
 */

export const EARTH_RADIUS = 6378137; // meters
export const MU = 3.986004418e14; // Earth gravitational parameter
export const J2 = 1.08262668e-3; // J2 perturbation coefficient

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface StateVector {
  pos: Vector3;
  vel: Vector3;
}

export function magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize(v: Vector3): Vector3 {
  const mag = magnitude(v);
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

export function add(v1: Vector3, v2: Vector3): Vector3 {
  return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
}

export function subtract(v1: Vector3, v2: Vector3): Vector3 {
  return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
}

export function multiply(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/**
 * Calculates acceleration including J2 perturbation
 */
export function getAcceleration(pos: Vector3): Vector3 {
  const r = magnitude(pos);
  const r2 = r * r;
  const r3 = r2 * r;
  
  // Basic gravity
  const accGrav = multiply(pos, -MU / r3);
  
  // J2 Perturbation
  const z2 = pos.z * pos.z;
  const factor = (1.5 * J2 * MU * EARTH_RADIUS * EARTH_RADIUS) / (r2 * r3);
  
  const j2Acc: Vector3 = {
    x: factor * (pos.x / r) * (5 * (z2 / (r * r)) - 1),
    y: factor * (pos.y / r) * (5 * (z2 / (r * r)) - 1),
    z: factor * (pos.z / r) * (5 * (z2 / (r * r)) - 3)
  };
  
  return add(accGrav, j2Acc);
}

/**
 * RK4 Step for orbit propagation
 */
export function propagateRK4(state: StateVector, dt: number): StateVector {
  const k1v = getAcceleration(state.pos);
  const k1p = state.vel;
  
  const k2v = getAcceleration(add(state.pos, multiply(k1p, dt / 2)));
  const k2p = add(state.vel, multiply(k1v, dt / 2));
  
  const k3v = getAcceleration(add(state.pos, multiply(k2p, dt / 2)));
  const k3p = add(state.vel, multiply(k2v, dt / 2));
  
  const k4v = getAcceleration(add(state.pos, multiply(k3p, dt)));
  const k4p = add(state.vel, multiply(k3v, dt));
  
  const nextVel = add(state.vel, multiply(
    add(add(k1v, multiply(k2v, 2)), add(multiply(k3v, 2), k4v)),
    dt / 6
  ));
  
  const nextPos = add(state.pos, multiply(
    add(add(k1p, multiply(k2p, 2)), add(multiply(k3p, 2), k4p)),
    dt / 6
  ));
  
  return { pos: nextPos, vel: nextVel };
}
