/**
 * Basemap catalog.
 *
 * App.jsx uses these layer factories to create the background maps underneath
 * the BeeSuitDa project layers. Keeping basemaps here separates general map
 * orientation layers from the analytical WMS layers in layers.js.
 */
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";

/**
 * Basemaps are background maps.
 * They help the user recognize places, while the BeeSuitDa WMS layers carry
 * the actual project information on top.
 */
export const basemaps = {
  cartoLight: {
    id: "cartoLight",
    title: "Carto Light",
    attribution: [
      {
        text: "© OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright",
      },
      { text: ", " },
      {
        text: "© CARTO",
        href: "https://carto.com/attribution/",
      },
    ],
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/403dbf72-8011-4d77-8af8-855ed9525afd",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/403dbf72-8011-4d77-8af8-855ed9525afd/formatters/xml?approved=true",
    metadataStatus: "Provider documentation",
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
    attribution: [
      {
        text: "© OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright",
      },
    ],
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/015e97d7-4732-4eed-a74d-56ca60195449",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/015e97d7-4732-4eed-a74d-56ca60195449/formatters/xml?approved=true",
    metadataStatus: "Provider documentation",
    layer: () =>
      new TileLayer({
        visible: false,
        source: new OSM({
          // Attribution is rendered consistently for every basemap in the map footer.
          attributions: [],
          crossOrigin: "anonymous",
        }),
      }),
  },

  satellite: {
    id: "satellite",
    title: "Satellite",
    attribution: [
      { text: "Powered by " },
      {
        text: "Esri",
        href: "https://www.esri.com/",
      },
      {
        text:
          " · Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
    ],
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/d6977ca5-1423-4ed4-8e27-5c4cf26cf8ee",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/d6977ca5-1423-4ed4-8e27-5c4cf26cf8ee/formatters/xml?approved=true",
    metadataStatus: "Provider documentation",
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
