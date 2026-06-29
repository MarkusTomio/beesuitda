# BeeSuitDa Dashboard

Interactive React dashboard for the BeeSuitDa SDI Services Implementation project. It displays beekeeping suitability layers for Salzburg with OpenLayers, GeoServer WMS layers, legends, basemap switching, and GetFeatureInfo map queries.

## What Is In Here

- `src/App.jsx` builds the dashboard screen and connects the controls to the map.
- `src/data/layers.js` lists the GeoServer WMS layers and formats clicked map values.
- `src/data/basemaps.js` lists the background maps.
- `src/index.css` contains the visual styling and responsive layout.
- `public/favicon.svg` is the browser-tab icon.

## Run Locally

```bash
npm install
npm run dev
```

## Check Before Publishing

```bash
npm run lint
npm run build
```

The production build uses the `/beesuitda/` base path configured in `vite.config.js`.
