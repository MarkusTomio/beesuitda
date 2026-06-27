import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";

/**
 * Basemaps are all EPSG:3857 web map tile services.
 * They provide cartographic context below the project WMS layers.
 */
export const basemaps = {
  cartoLight: {
    id: "cartoLight",
    title: "Carto Light",
    attribution: "© OpenStreetMap contributors © CARTO",
    layer: () =>
      new TileLayer({
        visible: true,
        source: new XYZ({
          url: "https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          crossOrigin: "anonymous",
        }),
      }),
  },

  osm: {
    id: "osm",
    title: "OpenStreetMap",
    attribution: "© OpenStreetMap contributors",
    layer: () =>
      new TileLayer({
        visible: false,
        source: new OSM({
          crossOrigin: "anonymous",
        }),
      }),
  },

  satellite: {
    id: "satellite",
    title: "Satellite",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    layer: () =>
      new TileLayer({
        visible: false,
        source: new XYZ({
          url:
            "https://server.arcgisonline.com/ArcGIS/rest/services/" +
            "World_Imagery/MapServer/tile/{z}/{y}/{x}",
          crossOrigin: "anonymous",
        }),
      }),
  },
};