# AR Rocket Builder

A high-fidelity Augmented Reality physics simulation built with **Three.js** and **MindAR.js**. Assemble your rocket, tune its parameters, and launch it from a physical target image in real-time.

![Rocket AR Preview](target.jpg)

## Features

- **Image Tracking**: Rock-solid AR stability using MindAR.js. Anchors the simulation to a physical target.
- **Realistic Physics**: 
  - Phase-based Euler integration (Burn, Coast, Descent, Landed).
  - **Atmospheric Drag**: Velocity-squared drag model for realistic deceleration.
  - **Dynamic Mass**: Fuel consumption during burn affects acceleration.
  - **3D Trajectory**: Randomized launch tilt and drift for accurate flight paths.
- **Interactive Assembly**: Drag and snap the nose cone to prepare for launch.
- **Responsive UI**: Real-time readouts of height, velocity, and flight time.

## Quick Start

1.  **Open the App**: Access the hosted URL on a mobile device (Chrome or Safari).
2.  **Grant Permission**: Grant camera access when prompted.
3.  **Find the Target**: Point your camera at the tracking target image (`target.jpg`).
4.  **Assemble**: Drag the nose cone down onto the body.
5.  **Launch**: Once assembled, adjust your thrust and hit **LAUNCH**!

## Tracking Target

The application utilizes `target.jpg` as the tracking marker. You can find this image in the repository root. For the best experience:
-   Display the image on a screen or print it.
-   Ensure good lighting on the target.

## Technical Stack

-   **Rendering**: [Three.js](https://threejs.org/) (v0.160.0)
-   **AR Engine**: [MindAR.js](https://hiukim.github.io/mind-ar-js-doc/)
-   **Logic**: Vanilla JavaScript (ES6 Modules)
-   **Physics**: Custom Euler-based kinematics engine.

## License

MIT License - Feel free to use this for your own GSoC proposals or projects!
