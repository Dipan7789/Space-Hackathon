import { StateVector, propagateRK4, magnitude, subtract, normalize, add, multiply } from "../lib/physics.ts";
// @ts-ignore
import kdTree from "kd-tree-javascript";

export interface SpaceObject {
  id: string;
  type: "satellite" | "debris";
  state: StateVector;
  mass: number; // kg
  fuel: number; // kg
  maxFuel: number;
  assignedOrbit?: StateVector;
  maneuvers: Maneuver[];
  lastManeuverTime: number;
}

export interface Maneuver {
  time: number;
  deltaV: { x: number; y: number; z: number };
  type: "evasion" | "recovery" | "graveyard";
}

export interface CollisionRisk {
  obj1Id: string;
  obj2Id: string;
  distance: number;
  timeToCollision: number;
}

export class ACMManager {
  private objects: Map<string, SpaceObject> = new Map();
  private currentTime: number = 0;
  private groundStations = [
    { name: "Svalbard", lat: 78.2, lon: 15.6 },
    { name: "McMurdo", lat: -77.8, lon: 166.6 },
    { name: "Troll", lat: -72.0, lon: 2.5 }
  ];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Add some satellites
    for (let i = 0; i < 50; i++) {
      const alt = 500000 + Math.random() * 100000;
      const r = 6378137 + alt;
      const v = Math.sqrt(3.986004418e14 / r);
      const angle = (i / 50) * Math.PI * 2;
      
      const state: StateVector = {
        pos: { x: r * Math.cos(angle), y: r * Math.sin(angle), z: 0 },
        vel: { x: -v * Math.sin(angle), y: v * Math.cos(angle), z: 0 }
      };

      this.objects.set(`SAT-${i}`, {
        id: `SAT-${i}`,
        type: "satellite",
        state: { ...state },
        mass: 500,
        fuel: 100,
        maxFuel: 100,
        assignedOrbit: { ...state },
        maneuvers: [],
        lastManeuverTime: -1000
      });
    }

    // Add debris
    for (let i = 0; i < 2000; i++) { // Starting with 2000 for stability
      const alt = 400000 + Math.random() * 300000;
      const r = 6378137 + alt;
      const v = Math.sqrt(3.986004418e14 / r);
      const angle = Math.random() * Math.PI * 2;
      const inc = (Math.random() - 0.5) * Math.PI;

      this.objects.set(`DEB-${i}`, {
        id: `DEB-${i}`,
        type: "debris",
        state: {
          pos: { x: r * Math.cos(angle), y: r * Math.sin(angle) * Math.cos(inc), z: r * Math.sin(angle) * Math.sin(inc) },
          vel: { x: -v * Math.sin(angle), y: v * Math.cos(angle) * Math.cos(inc), z: v * Math.cos(angle) * Math.sin(inc) }
        },
        mass: 1,
        fuel: 0,
        maxFuel: 0,
        maneuvers: [],
        lastManeuverTime: 0
      });
    }
  }

  ingestTelemetry(objects: SpaceObject[]) {
    objects.forEach(obj => this.objects.set(obj.id, obj));
  }

  scheduleManeuver(satelliteId: string, maneuver: Maneuver) {
    const sat = this.objects.get(satelliteId);
    if (sat && sat.type === "satellite") {
      sat.maneuvers.push(maneuver);
    }
  }

  step(dt: number) {
    this.currentTime += dt;
    const objectsArray = Array.from(this.objects.values());

    // 1. Propagate all objects
    objectsArray.forEach(obj => {
      // Check for scheduled maneuvers
      const activeManeuver = obj.maneuvers.find(m => Math.abs(m.time - this.currentTime) < dt / 2);
      if (activeManeuver && obj.fuel > 0) {
        // Apply deltaV
        obj.state.vel = add(obj.state.vel, activeManeuver.deltaV);
        // Rocket equation: deltaV = ve * ln(m0/m1) => m1 = m0 / exp(deltaV/ve)
        // Simplified fuel consumption: 1kg per 10m/s for 500kg sat
        const dvMag = magnitude(activeManeuver.deltaV);
        const fuelConsumed = (dvMag / 10) * (obj.mass / 500);
        obj.fuel = Math.max(0, obj.fuel - fuelConsumed);
        obj.lastManeuverTime = this.currentTime;
        obj.maneuvers = obj.maneuvers.filter(m => m !== activeManeuver);
      }

      obj.state = propagateRK4(obj.state, dt);
    });

    // 2. Collision Detection using KD-Tree
    const treeData = objectsArray.map(obj => ({
      id: obj.id,
      x: obj.state.pos.x,
      y: obj.state.pos.y,
      z: obj.state.pos.z,
      obj: obj
    }));

    const tree = new kdTree.kdTree(treeData, (a: any, b: any) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      return dx * dx + dy * dy + dz * dz;
    }, ["x", "y", "z"]);

    const risks: CollisionRisk[] = [];
    objectsArray.filter(o => o.type === "satellite").forEach(sat => {
      const satNode = { x: sat.state.pos.x, y: sat.state.pos.y, z: sat.state.pos.z };
      const nearest = tree.nearest(satNode, 2, 1000 * 1000); // 1km radius
      nearest.forEach(([node, distSq]: [any, number]) => {
        if (node.id !== sat.id) {
          const dist = Math.sqrt(distSq);
          if (dist < 100) {
            risks.push({ obj1Id: sat.id, obj2Id: node.id, distance: dist, timeToCollision: 0 });
          }
        }
      });
    });

    // 3. Autonomous Logic
    this.runAutonomousLogic(risks);

    return {
      currentTime: this.currentTime,
      risks,
      stats: {
        satellites: objectsArray.filter(o => o.type === "satellite").length,
        debris: objectsArray.filter(o => o.type === "debris").length
      }
    };
  }

  private runAutonomousLogic(risks: CollisionRisk[]) {
    risks.forEach(risk => {
      const sat = this.objects.get(risk.obj1Id);
      if (sat && sat.type === "satellite" && this.currentTime - sat.lastManeuverTime > 600) {
        // Calculate evasion
        // Prefer transverse direction (perpendicular to velocity and position)
        const radial = normalize(sat.state.pos);
        const velocity = normalize(sat.state.vel);
        const transverse = {
          x: radial.y * velocity.z - radial.z * velocity.y,
          y: radial.z * velocity.x - radial.x * velocity.z,
          z: radial.x * velocity.y - radial.y * velocity.x
        };

        const deltaV = multiply(transverse, 5); // 5 m/s evasion
        
        // Check fuel and graveyard
        if (sat.fuel / sat.maxFuel < 0.05) {
          this.scheduleManeuver(sat.id, {
            time: this.currentTime + 10,
            deltaV: multiply(velocity, 15), // Boost to graveyard
            type: "graveyard"
          });
        } else {
          this.scheduleManeuver(sat.id, {
            time: this.currentTime + 10,
            deltaV,
            type: "evasion"
          });
          // Schedule recovery
          this.scheduleManeuver(sat.id, {
            time: this.currentTime + 1200,
            deltaV: multiply(deltaV, -1),
            type: "recovery"
          });
        }
      }
    });

    // Station keeping
    this.objects.forEach(obj => {
      if (obj.type === "satellite" && obj.assignedOrbit && this.currentTime - obj.lastManeuverTime > 3600) {
        const drift = magnitude(subtract(obj.state.pos, obj.assignedOrbit.pos));
        if (drift > 10000) { // 10km drift
          const correction = multiply(normalize(subtract(obj.assignedOrbit.pos, obj.state.pos)), 2);
          this.scheduleManeuver(obj.id, {
            time: this.currentTime + 60,
            deltaV: correction,
            type: "recovery"
          });
        }
      }
    });
  }

  getSnapshot() {
    return {
      time: this.currentTime,
      objects: Array.from(this.objects.values()).map(o => ({
        id: o.id,
        type: o.type,
        pos: o.state?.pos || { x: 0, y: 0, z: 0 },
        fuel: o.fuel,
        maxFuel: o.maxFuel
      }))
    };
  }
}
