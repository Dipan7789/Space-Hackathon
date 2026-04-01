from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from manager import ACMManager

app = FastAPI()
acm = ACMManager()

class TelemetryObject(BaseModel):
    id: str
    type: str
    x: float
    y: float
    z: float
    vx: float
    vy: float
    vz: float
    mass: Optional[float] = 1.0
    fuel: Optional[float] = 0.0
    max_fuel: Optional[float] = 0.0

class TelemetryRequest(BaseModel):
    objects: List[TelemetryObject]

class ManeuverRequest(BaseModel):
    satelliteId: str
    burn: dict

class StepRequest(BaseModel):
    dt: Optional[float] = 60.0

@app.post("/api/telemetry")
async def ingest_telemetry(req: TelemetryRequest):
    acm.ingest_telemetry([obj.dict() for obj in req.objects])
    return {"status": "ok", "count": len(req.objects)}

@app.post("/api/maneuver/schedule")
async def schedule_maneuver(req: ManeuverRequest):
    acm.schedule_maneuver(req.satelliteId, req.burn)
    return {"status": "ok"}

@app.post("/api/simulate/step")
async def simulate_step(req: StepRequest):
    result = acm.step(req.dt)
    return JSONResponse(content=result)

@app.get("/api/visualization/snapshot")
async def get_snapshot():
    return JSONResponse(content=acm.get_snapshot())

# Serve static files from React build
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "message": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 and port 8000 as required
    uvicorn.run(app, host="0.0.0.0", port=8000)
