# Three-Body Problem Simulation

An interactive 3D gravitational simulation of the famous three-body problem, built with Three.js.

The simulation uses the classic **figure-8 orbit** discovered by Chenciner and Montgomery — a periodic solution where three equal-mass bodies chase each other along a shared figure-8 path.

## Controls

| Control | Action |
|---------|--------|
| Drag | Orbit camera |
| Scroll | Zoom in/out |
| ⏸ / ▶ | Pause / Resume |
| ↺ | Reset simulation |
| Speed slider | Adjust simulation speed (0.1× – 5×) |
| Trails toggle | Show/hide orbital trails |

## Run Locally

```bash
# Clone or download the repo, then serve with any static server:
npx serve .
# or
python3 -m http.server
# or
npx live-server
```

## Deploy to GitHub Pages

1. Push to your GitHub repository
2. Go to **Settings → Pages**
3. Set **Source** to **Deploy from branch**, select `main` / `root`
4. Your simulation will be live at `https://<username>.github.io/three-body-problem/`

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- OrbitControls — camera interaction
- Semi-implicit Euler integration — physics simulation

## Physics

The gravitational force between each pair of bodies is calculated as:

```
F_ij = G * m_i * m_j / r²
```

A softening parameter prevents numerical instability during close encounters. The figure-8 initial conditions produce a perfectly periodic orbit in the theoretical case; numerical integration will slowly drift over time, reflecting the inherently chaotic nature of the three-body problem.

## License

MIT
