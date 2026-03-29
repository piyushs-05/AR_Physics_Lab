# AR Physics Lab

A high-fidelity, web-based Augmented Reality (AR) physics simulator for interactive education. Explore real physics by placing experiments on any surface in your environment or interact in a dedicated 3D viewer.

## 🚀 Experience Modes

| Mode | How it Works | Requirements |
|------|-------------|--------------|
| **AR Mode** | Marker-less placement via WebXR Hit Test API or Image Tracking via MindAR. | Chrome 79+ on Android, HTTPS |
| **3D Viewer** | Full interactive 3D scene with orbit controls. | Any modern web browser |

## 🧪 Included Experiments

### 1. Simple Pendulum
A non-linear pendulum simulation capable of modeling large angular displacements.
- **Adjustable Parameters**: Gravity ($g$), String Length ($L$), Bob Mass ($m$), and Damping coefficient ($b$).
- **Features**: Drag-to-set angle, flick-to-start (initial velocity), and real-time energy readouts (Kinetic, Potential, Total).
- **Precision**: Uses **4th-order Runge-Kutta (RK4)** integration to ensure energy conservation.

### 2. Inclined Plane (Ramp)
A rolling solid sphere ($I = \frac{2}{5}mR^2$) on a customizable ramp.
- **Adjustable Parameters**: Ramp Angle ($\alpha$), Ramp Length, Sphere Mass, and Surface Friction ($\mu$).
- **Features**: Realistic transition from ramp to flat surface, velocity peak tracking, and height-based PE calculations.

## 🛠 Project Architecture

This project is built with a **modular ES6 architecture**, ensuring that physics logic is decoupled from rendering and UI.

- **`index.html`**: The UI entry point and styling.
- **`app.js`**: Core orchestrator for Three.js, AR/VR sessions, and user pointer-interactions.
- **`physics.js` & `ramp-physics.js`**: Pure physics engines implementing numerical integration (RK4).
- **`ui.js`**: Binds the parameter sliders and data readouts to the underlying physics state.
- **`vendor/`**: Localized assets for AR tracking (MindAR targets, Hiro markers, and WebXR helpers).
## Output GIF
### Pendulum
![pendulam](https://github.com/user-attachments/assets/271e5139-fa5a-45c0-970e-d371dd475370)
### Inlined Plane
![ball](https://github.com/user-attachments/assets/676c5f09-6873-4913-9498-976fd022d941)


## 🧮 Theoretical Background

The simulation solves the full equations of motion:
- **Pendulum**: $\theta'' = -\frac{g}{L} \sin(\theta) - b \theta'$
- **Ramp**: $a = \frac{5}{7} g (\sin \alpha - \mu \cos \alpha)$

Numerical stability is maintained through **4 substeps per frame** using the RK4 method, providing far superior accuracy over standard Euler integration.

## 📦 Getting Started

1. **Serve the Project**: WebXR and Camera access requires a secure context (HTTPS) or `localhost`.
   ```bash
   # Using Python
   python3 -m http.server 8000
   ```
2. **Access**: Open `index.html` in your browser.
3. **Usage**: Choose an experiment, select AR or 3D mode, and use the **⚙ Parameters** panel to tweak the world mid-simulation.

## 📜 License
MIT — Open for educational and research use.
