import numpy as np

EARTH_RADIUS = 6378137.0  # meters
MU = 3.986004418e14  # Earth gravitational parameter
J2 = 1.08262668e-3  # J2 perturbation coefficient

def get_acceleration(pos):
    r = np.linalg.norm(pos)
    r2 = r * r
    r3 = r2 * r
    
    # Basic gravity
    acc_grav = -MU * pos / r3
    
    # J2 Perturbation
    z = pos[2]
    z2 = z * z
    factor = (1.5 * J2 * MU * EARTH_RADIUS**2) / (r2 * r3)
    
    j2_acc = np.array([
        factor * (pos[0] / r) * (5 * (z2 / r**2) - 1),
        factor * (pos[1] / r) * (5 * (z2 / r**2) - 1),
        factor * (pos[2] / r) * (5 * (z2 / r**2) - 3)
    ])
    
    return acc_grav + j2_acc

def propagate_rk4(pos, vel, dt):
    def derivatives(p, v):
        return v, get_acceleration(p)

    k1p, k1v = derivatives(pos, vel)
    
    k2p, k2v = derivatives(pos + k1p * dt/2, vel + k1v * dt/2)
    
    k3p, k3v = derivatives(pos + k2p * dt/2, vel + k2v * dt/2)
    
    k4p, k4v = derivatives(pos + k3p * dt, vel + k3v * dt)
    
    next_pos = pos + (dt / 6.0) * (k1p + 2*k2p + 2*k3p + k4p)
    next_vel = vel + (dt / 6.0) * (k1v + 2*k2v + 2*k3v + k4v)
    
    return next_pos, next_vel
