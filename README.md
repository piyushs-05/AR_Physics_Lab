# AR Physics Lab — Simple Pendulum

A web-based augmented reality physics simulation that lets you place a simple pendulum on any real-world surface and interact with its parameters in real time.

## Demo Modes

| Mode | How it works | Requirements |
|------|-------------|--------------|
| **AR Mode** | Uses WebXR Hit Test API for markerless surface detection. Point your camera at a flat surface, tap to place the pendulum. | Chrome 79+ on Android, HTTPS |
| **3D Viewer** | Interactive 3D view with orbit controls. Works everywhere. | Any modern browser |

## Quick Start

1. **Serve over HTTPS** (required for WebXR/camera access):
   ```bash
   # Option A: Python
   python3 -m http.server 8080
   # Then use ngrok or similar for HTTPS

   # Option B: VS Code Live Server extension

   # Option C: Deploy to GitHub Pages / Netlify / Vercel
   ```
2. Open `index.html` in the browser.
3. Choose **AR Mode** (if supported) or **3D Viewer**.
4. In AR mode, point at a flat surface and tap to place the pendulum.
5. Use the **Parameters** panel to tweak the simulation in real time.

## Physics Model

### Governing Equation

The simulation solves the full nonlinear pendulum equation (not the small-angle approximation):

```
θ″ = −(g / L) · sin(θ) − b · θ′
```

Where:
- `θ` — Angular displacement from vertical (radians)
- `g` — Gravitational acceleration (m/s²)
- `L` — String/rod length (m)
- `b` — Damping coefficient (dimensionless)

### Integration Method

**4th-order Runge-Kutta (RK4)** with 4 sub-steps per frame for numerical stability. This preserves energy conservation far better than simple Euler integration.

### Tunable Parameters

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Gravity | 0.5 – 25 m/s² | 9.81 | Higher → faster swing. Try 1.62 for Moon, 3.72 for Mars |
| String Length | 0.2 – 3.0 m | 1.0 | Longer → slower period (T ∝ √L) |
| Bob Mass | 0.1 – 10.0 kg | 1.0 | Affects energy magnitude, not period (in ideal case) |
| Damping | 0 – 0.5 | 0.02 | Energy dissipation rate. 0 = perpetual motion |
| Initial Angle | 5° – 170° | 45° | Starting displacement. Large angles show nonlinear effects |

### Live Readouts

- **Angle** — Current θ in degrees
- **Angular Velocity** — Current ω in rad/s
- **Kinetic Energy** — KE = ½mv² where v = Lω
- **Potential Energy** — PE = mgL(1 − cos θ)
- **Total Energy** — KE + PE (should decrease with damping > 0)
- **Theoretical Period** — T = 2π√(L/g) (small-angle approximation)
- **Observed Period** — Measured from zero-crossings in the simulation

## Architecture

```
index.html          ← Entry point, UI structure
style.css           ← Dark scientific theme
js/
  app.js            ← Three.js scene, WebXR AR, 3D fallback, animation loop
  physics.js        ← PendulumPhysics class (RK4 integrator, energy calculations)
  ui.js             ← UIController (parameter binding, readout updates)
```

### Key Design Decisions

1. **No build step** — Pure ES modules loaded via `importmap`. Zero dependencies to install.
2. **WebXR Hit Test** — The most reliable markerless surface detection API available on the web. Falls back gracefully to 3D mode.
3. **RK4 integration** — Chosen over Euler for energy preservation. The pendulum at damping=0 conserves energy within <0.1% over thousands of frames.
4. **Separation of concerns** — Physics knows nothing about rendering; UI knows nothing about Three.js. Easy to swap in a different physics model.

## Browser Compatibility

| Feature | Chrome Android | Chrome Desktop | Safari iOS | Firefox |
|---------|---------------|---------------|------------|---------|
| 3D Viewer | ✅ | ✅ | ✅ | ✅ |
| AR Mode | ✅ (79+) | ❌ | ❌ (no WebXR hit-test) | ❌ |

## Extending

**Add a new simulation** (e.g., spring-mass):
1. Create `js/spring-physics.js` implementing the same interface (`step()`, `bobPosition`, energy getters)
2. Create corresponding 3D visuals in `app.js`
3. Update the parameter panel in `index.html`

**Add marker-based AR**:
- Swap WebXR for AR.js with a Hiro marker pattern. The physics and rendering code stays identical.

## License

MIT — use freely for education, research, or portfolio.
