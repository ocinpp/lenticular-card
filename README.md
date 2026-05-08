# Interactive Lenticular Effect

A 3D interactive lenticular card effect built with **Three.js** and custom WebGL shaders. This project simulates the look and feel of a physical lenticular print, complete with spring-physics-based tilting, dynamic lighting, and configurable lens imperfections.

## Features

- **Custom Shaders**: Simulates the lenticular lens effect transitioning between two images based on viewing angle.
- **Physical Interactions**: Uses spring physics to naturally track mouse or touch movements, adding realistic weight and wobble.
- **Mobile Gyroscope Support**: View the lenticular effect naturally by physically tilting your mobile device (includes the necessary permission flow for iOS 13+). _Note: Gyroscope features require a secure context (HTTPS)._
- **Real-time Tweaking**: Includes a comprehensive GUI powered by [lil-gui](https://lil-gui.georgealways.com/) to adjust properties on the fly:
  - **Lens**: Stripe count (LPI), ghosting (crosstalk), waviness, color fringing (chromatic aberration), and transition blur.
  - **Surface & Light**: Room light intensity, smudge variations, and micro-scratches for added realism.
  - **Physics**: Spring stiffness, damping, and subtle hand wobble.

## Technologies Used

- [Three.js](https://threejs.org/) for the 3D scene and shader material rendering.
- [lil-gui](https://lil-gui.georgealways.com/) for the interactive parameters panel.
- [Vite](https://vitejs.dev/) as the fast development server and build tool.

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Clone or download the repository.
2. Install the project dependencies:
   ```bash
   npm install
   ```

### Development

To start the Vite development server with hot-module replacement (HMR):

```bash
npm run dev
```

Open the provided local URL (typically `http://localhost:5173`) in your browser.

### Building for Production

To build the optimized static assets into the `dist/` directory:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```
