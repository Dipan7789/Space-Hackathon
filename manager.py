import numpy as np
from scipy.spatial import KDTree
from physics import propagate_rk4
import time

class ACMManager:
    def __init__(self):
        self.objects = {}
        self.current_time = 0
        self.ground_stations = [
            {"name": "Svalbard", "lat": 78.2, "lon": 15.6},
            {"name": "McMurdo", "lat": -77.8, "lon": 166.6},
            {"name": "Troll", "lat": -72.0, "lon": 2.5}
        ]
        self.seed_initial_data()

    def has_los(self, sat_pos):
        # Calculate satellite lat/lon
        r = np.linalg.norm(sat_pos)
        lat = np.degrees(np.arcsin(sat_pos[2] / r))
        lon = np.degrees(np.arctan2(sat_pos[1], sat_pos[0]))
        
        # Simple LOS check: Is the satellite above the horizon for any station?
        for station in self.ground_stations:
            d_lat = abs(lat - station["lat"])
            d_lon = abs(lon - station["lon"])
            if d_lat < 20 and d_lon < 20:
                # Blackout Zone check (e.g., South Atlantic Anomaly simulation)
                if -50 < lon < 0 and -40 < lat < 0:
                    return False # Blackout zone
                return True
        return False

    def seed_initial_data(self):
        # Add satellites
        for i in range(50):
            alt = 500000 + np.random.random() * 100000
            r = 6378137 + alt
            v = np.sqrt(3.986004418e14 / r)
            angle = (i / 50.0) * np.pi * 2
            
            pos = np.array([r * np.cos(angle), r * np.sin(angle), 0.0])
            vel = np.array([-v * np.sin(angle), v * np.cos(angle), 0.0])

            self.objects[f"SAT-{i}"] = {
                "id": f"SAT-{i}",
                "type": "satellite",
                "pos": pos,
                "vel": vel,
                "mass": 500.0,
                "fuel": 100.0,
                "max_fuel": 100.0,
                "assigned_orbit": {"pos": pos.copy(), "vel": vel.copy()},
                "maneuvers": [],
                "last_maneuver_time": -1000
            }

        # Add debris
        for i in range(2000):
            alt = 400000 + np.random.random() * 300000
            r = 6378137 + alt
            v = np.sqrt(3.986004418e14 / r)
            angle = np.random.random() * np.pi * 2
            inc = (np.random.random() - 0.5) * np.pi

            pos = np.array([r * np.cos(angle), r * np.sin(angle) * np.cos(inc), r * np.sin(angle) * np.sin(inc)])
            vel = np.array([-v * np.sin(angle), v * np.cos(angle) * np.cos(inc), v * np.cos(angle) * np.sin(inc)])

            self.objects[f"DEB-{i}"] = {
                "id": f"DEB-{i}",
                "type": "debris",
                "pos": pos,
                "vel": vel,
                "mass": 1.0,
                "fuel": 0.0,
                "max_fuel": 0.0,
                "maneuvers": [],
                "last_maneuver_time": 0
            }

    def ingest_telemetry(self, telemetry_data):
        for obj in telemetry_data:
            oid = obj["id"]
            self.objects[oid] = {
                "id": oid,
                "type": obj["type"],
                "pos": np.array([obj["x"], obj["y"], obj["z"]]),
                "vel": np.array([obj["vx"], obj["vy"], obj["vz"]]),
                "mass": obj.get("mass", 1.0),
                "fuel": obj.get("fuel", 0.0),
                "max_fuel": obj.get("max_fuel", 0.0),
                "maneuvers": [],
                "last_maneuver_time": 0
            }

    def schedule_maneuver(self, satellite_id, burn):
        if satellite_id in self.objects:
            self.objects[satellite_id]["maneuvers"].append(burn)

    def step(self, dt):
        self.current_time += dt
        obj_list = list(self.objects.values())

        # 1. Propagate
        for obj in obj_list:
            # Apply maneuvers
            remaining_maneuvers = []
            for m in obj["maneuvers"]:
                if abs(m["time"] - self.current_time) < dt / 2:
                    dv = np.array([m["dv_x"], m["dv_y"], m["dv_z"]])
                    dv_mag = np.linalg.norm(dv)
                    if obj["fuel"] > 0:
                        obj["vel"] += dv
                        fuel_consumed = (dv_mag / 10.0) * (obj["mass"] / 500.0)
                        obj["fuel"] = max(0.0, obj["fuel"] - fuel_consumed)
                        obj["last_maneuver_time"] = self.current_time
                else:
                    remaining_maneuvers.append(m)
            obj["maneuvers"] = remaining_maneuvers

            obj["pos"], obj["vel"] = propagate_rk4(obj["pos"], obj["vel"], dt)

        # 2. Collision Detection
        positions = np.array([obj["pos"] for obj in obj_list])
        tree = KDTree(positions)
        
        risks = []
        for i, obj in enumerate(obj_list):
            if obj["type"] == "satellite":
                indices = tree.query_ball_point(obj["pos"], 1000.0) # 1km
                for idx in indices:
                    if idx != i:
                        other = obj_list[idx]
                        dist = np.linalg.norm(obj["pos"] - other["pos"])
                        if dist < 100:
                            risks.append({
                                "obj1Id": obj["id"],
                                "obj2Id": other["id"],
                                "distance": float(dist),
                                "timeToCollision": 0
                            })

        # 3. Autonomous Logic
        self.run_autonomous_logic(risks)

        return {
            "currentTime": self.current_time,
            "risks": risks,
            "stats": {
                "satellites": len([o for o in obj_list if o["type"] == "satellite"]),
                "debris": len([o for o in obj_list if o["type"] == "debris"])
            }
        }

    def run_autonomous_logic(self, risks):
        for risk in risks:
            sat = self.objects.get(risk["obj1Id"])
            if sat and sat["type"] == "satellite" and (self.current_time - sat["last_maneuver_time"]) > 600:
                # Check Communication LOS
                if not self.has_los(sat["pos"]):
                    continue # Cannot maneuver without ground link
                
                # Evasion
                pos_norm = sat["pos"] / np.linalg.norm(sat["pos"])
                vel_norm = sat["vel"] / np.linalg.norm(sat["vel"])
                transverse = np.cross(pos_norm, vel_norm)
                
                dv = transverse * 5.0
                
                if sat["fuel"] / sat["max_fuel"] < 0.05:
                    # Graveyard
                    self.schedule_maneuver(sat["id"], {
                        "time": self.current_time + 10,
                        "dv_x": float(vel_norm[0] * 15),
                        "dv_y": float(vel_norm[1] * 15),
                        "dv_z": float(vel_norm[2] * 15),
                        "type": "graveyard"
                    })
                else:
                    self.schedule_maneuver(sat["id"], {
                        "time": self.current_time + 10,
                        "dv_x": float(dv[0]), "dv_y": float(dv[1]), "dv_z": float(dv[2]),
                        "type": "evasion"
                    })
                    # Recovery
                    self.schedule_maneuver(sat["id"], {
                        "time": self.current_time + 1200,
                        "dv_x": float(-dv[0]), "dv_y": float(-dv[1]), "dv_z": float(-dv[2]),
                        "type": "recovery"
                    })

    def get_snapshot(self):
        return {
            "time": self.current_time,
            "objects": [
                {
                    "id": o["id"],
                    "type": o["type"],
                    "pos": {"x": float(o["pos"][0]), "y": float(o["pos"][1]), "z": float(o["pos"][2])},
                    "fuel": float(o["fuel"]),
                    "maxFuel": float(o["max_fuel"])
                } for o in self.objects.values()
            ]
        }
