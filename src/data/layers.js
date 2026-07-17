/**
 * Project WMS layer catalog and value formatter.
 *
 * App.jsx reads this file to know which BeeSuitDa GeoServer layers exist, how
 * they should be grouped in the layer panel, how legends and capabilities URLs
 * are built, and how raw GetFeatureInfo values should become readable labels.
 */
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";

export const wmsEndpoint =
  "https://geoserver22s.zgis.at/geoserver/ipsdi_st26/wms";

export const gitlabWikiUrl =
  "https://git.sbg.ac.at/st26_856.213/beesuitda/-/wikis/home";

const NATURA_LAYER_Z_INDEX = 1000;
const SPECIES_LAYER_Z_INDEX_BASE = 900;

// These groups become the collapsible headings in the layer panel.
export const layerGroups = [
  {
    id: "analysis",
    title: "Analysis result",
  },
  {
    id: "climate",
    title: "Climatic layers (2015-2025)",
  },
  {
    id: "topography",
    title: "Topographic layers",
  },
  {
    id: "landcover",
    title: "Land cover / land use",
  },
  {
    id: "species",
    title: "Species observation densities",
  },
  {
    id: "protected",
    title: "Natura 2000 areas",
  },
];

// CORINE Land Cover is stored as numeric raster classes. This lookup turns the
// raw cell value from GeoServer into the readable class name shown in the
// feature-information panel after a map click.
export const clcClassMap = {
  0: "Outside study area",
  1: "Continuous urban fabric",
  2: "Discontinuous urban fabric",
  3: "Industrial or commercial units",
  4: "Road and rail networks and associated land",
  5: "Port areas",
  6: "Airports",
  7: "Mineral extraction sites",
  8: "Dump sites",
  9: "Construction sites",
  10: "Green urban areas",
  11: "Sport and leisure facilities",
  12: "Non-irrigated arable land",
  13: "Permanently irrigated land",
  14: "Rice fields",
  15: "Vineyards",
  16: "Fruit trees and berry plantations",
  17: "Olive groves",
  18: "Pastures",
  19: "Annual crops associated with permanent crops",
  20: "Complex cultivation patterns",
  21: "Land principally occupied by agriculture with significant areas of natural vegetation",
  22: "Agro-forestry areas",
  23: "Broad-leaved forest",
  24: "Coniferous forest",
  25: "Mixed forest",
  26: "Natural grasslands",
  27: "Moors and heathland",
  28: "Sclerophyllous vegetation",
  29: "Transitional woodland-shrub",
  30: "Beaches, dunes, sands",
  31: "Bare rocks",
  32: "Sparsely vegetated areas",
  33: "Burnt areas",
  34: "Glaciers and perpetual snow",
  35: "Inland marshes",
  36: "Peat bogs",
  37: "Salt marshes",
  38: "Salines",
  39: "Intertidal flats",
  40: "Water courses",
  41: "Water bodies",
  42: "Coastal lagoons",
  43: "Estuaries",
  44: "Sea and ocean",
  48: "NoData",
  128: "Unknown / background",
};

/**
 * Project layer catalog.
 *
 * Each object below describes one GeoServer WMS layer: where it appears in the
 * panel, how it is queried, how transparent it starts, and how raw values should
 * be translated into readable text.
 *
 * Important fields:
 * - id: stable key used by React state and OpenLayers layer refs.
 * - group: connects the layer to one layerGroups entry.
 * - geoserverLayer: workspace:layer name passed to GeoServer WMS.
 * - valueType: tells formatFeatureInfo() how to display raw raster values.
 * - active and opacity: initial UI/map state when the dashboard loads.
 *
 * The array order controls panel order. Rendering order is handled separately
 * by getLayerZIndex().
 */
export const projectLayers = [
  {
    id: "suitability",
    group: "analysis",
    name: "Suitability Layer",
    description:
      "Raster-based beekeeping suitability layer for Salzburg Province. Values range from 0 to 5, where higher values indicate higher suitability.",
    geoserverLayer: "ipsdi_st26:suitability_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "suitability",
    active: true,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/6730bd19-fca4-40d1-aa07-5779f8d1f901",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/6730bd19-fca4-40d1-aa07-5779f8d1f901/formatters/xml?approved=true",
    metadataStatus: "Published in GeoNetwork",
    licenseNote:
      "Mixed-source derived analytical layer. Reuse is subject to the licences of the underlying input datasets, including non-commercial restrictions from CC BY-NC GBIF data.",
    valueMap: {
      0: "NoData / Water bodies",
      1: "Very low suitability",
      2: "Low suitability",
      3: "Moderate suitability",
      4: "High suitability",
      5: "Very high suitability",
    },
  },

  {
    id: "rr_mean",
    group: "climate",
    name: "Mean Precipitation",
    description:
      "Mean precipitation layer for the 2015–2025 period, used as a climatic criterion in the suitability assessment.",
    geoserverLayer: "ipsdi_st26:rr_mean_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "precipitation",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/2e153dc4-4547-42b1-ba9b-775d6c702283",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/2e153dc4-4547-42b1-ba9b-775d6c702283/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "sa_mean",
    group: "climate",
    name: "Mean Sunshine Duration",
    description:
      "Mean sunshine duration layer for the 2015–2025 period. Raw values are stored in seconds and displayed as hours and minutes.",
    geoserverLayer: "ipsdi_st26:sa_mean_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "sunshine_seconds",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/8bdd56d7-7239-4ef0-abc0-e7b7e6a15dce",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/8bdd56d7-7239-4ef0-abc0-e7b7e6a15dce/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "tm_mean",
    group: "climate",
    name: "Mean Temperature",
    description:
      "Mean temperature layer for the 2015–2025 period, used as a climatic criterion in the suitability assessment.",
    geoserverLayer: "ipsdi_st26:tm_mean_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "temperature",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/802cde45-699c-46c3-b476-15ae9fd6d870",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/802cde45-699c-46c3-b476-15ae9fd6d870/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },

  {
    id: "elevation",
    group: "topography",
    name: "Elevation",
    description:
      "Elevation layer used to describe the topographic context of beekeeping suitability patterns.",
    geoserverLayer: "ipsdi_st26:elevation_dashboard_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "elevation",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/f417a16f-5ebd-48ee-8297-91bc8f343975",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/f417a16f-5ebd-48ee-8297-91bc8f343975/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "slope",
    group: "topography",
    name: "Slope",
    description:
      "Slope layer representing terrain steepness as a topographic criterion.",
    geoserverLayer: "ipsdi_st26:slope_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "slope",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/def7721f-89bd-4b5d-9253-87d2310fb140",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/def7721f-89bd-4b5d-9253-87d2310fb140/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },

  {
    id: "clc",
    group: "landcover",
    name: "Corine Land Cover",
    description:
      "Land cover layer using CLC class indices. Values are displayed as land-cover class names.",
    geoserverLayer: "ipsdi_st26:clc_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "clc",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/b1a733bb-c650-437f-be9c-b22a85ef0250",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/b1a733bb-c650-437f-be9c-b22a85ef0250/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "water_proximity",
    group: "landcover",
    name: "Water Proximity",
    description:
      "Distance-based layer representing proximity to water features. Values are displayed in metres.",
    geoserverLayer: "ipsdi_st26:water_prox_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "distance_m",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/ee2a7e5f-3dfb-4e36-a361-3edf88458b5a",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/ee2a7e5f-3dfb-4e36-a361-3edf88458b5a/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "roads_proximity",
    group: "landcover",
    name: "Road Proximity",
    description:
      "Distance-based layer representing proximity to road infrastructure. Values are displayed in metres.",
    geoserverLayer: "ipsdi_st26:roads_prox_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "distance_m",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/92f53e7b-a8a8-427f-983c-327845ae9bc3",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/92f53e7b-a8a8-427f-983c-327845ae9bc3/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },

  {
    id: "honeybee_density",
    group: "species",
    name: "Honeybee",
    description:
      "Density layer generated from honeybee observation point data. Values represent relative observation density and should be interpreted comparatively within the study area.",
    geoserverLayer: "ipsdi_st26:honeybee_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "density",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/643f8d9a-d277-4811-be99-bb502fde8971",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/643f8d9a-d277-4811-be99-bb502fde8971/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "wildbee_density",
    group: "species",
    name: "Wild Bee",
    description:
      "Density layer generated from wild bee observation point data. Values represent relative observation density and should be interpreted comparatively within the study area.",
    geoserverLayer: "ipsdi_st26:wildbee_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "density",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/249ec168-eaaa-446c-8f91-519e674311be",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/249ec168-eaaa-446c-8f91-519e674311be/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
  {
    id: "hornet_density",
    group: "species",
    name: "Hornet",
    description:
      "Density layer generated from hornet observation point data. Values represent relative observation density and should be interpreted comparatively within the study area.",
    geoserverLayer: "ipsdi_st26:hornet_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "density",
    active: false,
    opacity: 0.75,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/9a44ce5b-ae4c-4b7d-be8f-3854019c908b",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/9a44ce5b-ae4c-4b7d-be8f-3854019c908b/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },

  {
    id: "natura2000",
    group: "protected",
    name: "Natura 2000 Areas",
    description:
      "Natura 2000 protected areas. This layer is listed last but rendered above all other project layers when activated.",
    geoserverLayer: "ipsdi_st26:natura_beesuitda_3857",
    serviceType: "WMS",
    crs: "EPSG:3857",
    type: "wms",
    valueType: "natura_binary",
    active: false,
    opacity: 0.85,
    queryable: true,
    metadataHtmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/33b8f3f9-8f35-4223-b6ad-fda21f69cad9",
    metadataXmlUrl: "https://geoserver22s.zgis.at/geonetwork/srv/api/records/33b8f3f9-8f35-4223-b6ad-fda21f69cad9/formatters/xml?approved=true",
    metadataStatus: "Pending GeoNetwork publication",
  },
];

/**
 * Metadata records for original base datasets.
 *
 * These are not toggleable dashboard layers. They are source/input datasets
 * used to create the analysis layers, so App.jsx appends them to the metadata
 * modal after the project layer and basemap records.
 */
export const baseDataMetadataRecords = [
  {
    id: "corine_land_cover_2018",
    name: "CORINE Land Cover 2018",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/ebc99eb4-4bf8-43cc-a4a9-713808cd2349",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/ebc99eb4-4bf8-43cc-a4a9-713808cd2349/formatters/xml?approved=true",
  },
  {
    id: "natura_2000_2024",
    name: "Natura 2000",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/9b95cde3-86f0-4a6a-8247-a050e728ccf5",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/9b95cde3-86f0-4a6a-8247-a050e728ccf5/formatters/xml?approved=true",
  },
  {
    id: "spartacus_v2_1_yearly",
    name: "SPARTACUS v2.1 Jahresdaten",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/f8c76ace-b892-4de9-a625-4fc5d15c22a3",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/f8c76ace-b892-4de9-a625-4fc5d15c22a3/formatters/xml?approved=true",
  },
  {
    id: "copernicus_dem_30m_europe",
    name: "Copernicus DEM 30m for Europe",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/4e64636f-b190-444b-ba4f-469aacc60172",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/4e64636f-b190-444b-ba4f-469aacc60172/formatters/xml?approved=true",
  },
  {
    id: "osm_water_features_salzburg",
    name: "OSM Water Features for Land Salzburg",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/e9f04548-0ab8-4805-8f91-8003fdecb33c",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/e9f04548-0ab8-4805-8f91-8003fdecb33c/formatters/xml?approved=true",
  },
  {
    id: "osm_roads_salzburg",
    name: "OSM Roads for Land Salzburg",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/fca4c770-e6e1-4a0b-9397-5998e812e227",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/fca4c770-e6e1-4a0b-9397-5998e812e227/formatters/xml?approved=true",
  },
  {
    id: "gbif_hornet_occurrences_salzburg",
    name: "GBIF Hornet Occurrences for Land Salzburg",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/88b4fca1-1b01-45fe-9ee0-a6316fb98925",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/88b4fca1-1b01-45fe-9ee0-a6316fb98925/formatters/xml?approved=true",
  },
  {
    id: "gbif_wild_bee_occurrences_salzburg",
    name: "GBIF Wild Bee Occurrences for Land Salzburg",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/3b987183-97e5-46a1-a4df-5667377c9b5c",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/3b987183-97e5-46a1-a4df-5667377c9b5c/formatters/xml?approved=true",
  },
  {
    id: "gbif_honey_bee_occurrences_salzburg",
    name: "GBIF Honey Bee Occurrences for Land Salzburg",
    metadataHtmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/eng/catalog.search#/metadata/4f2ef8fd-179d-4b16-b081-664ad24956c5",
    metadataXmlUrl:
      "https://geoserver22s.zgis.at/geonetwork/srv/api/records/4f2ef8fd-179d-4b16-b081-664ad24956c5/formatters/xml?approved=true",
  },
];

export function createWmsLayer(layerConfig) {
  // Turn one layer description from the catalog into a real OpenLayers WMS layer.
  // React owns the checkbox state; OpenLayers owns the actual map rendering.
  return new TileLayer({
    visible: layerConfig.active,
    opacity: layerConfig.opacity,
    source: new TileWMS({
      url: wmsEndpoint,
      params: {
        LAYERS: layerConfig.geoserverLayer,
        TILED: true,
        FORMAT: "image/png",
        TRANSPARENT: true,
      },
      serverType: "geoserver",
      crossOrigin: "anonymous",
    }),
  });
}

export function getLayerZIndex(layerConfig) {
  // Higher z-index values draw above lower values. Natura 2000 is a boundary
  // style and should stay readable above all raster layers.
  if (layerConfig.id === "natura2000") {
    return NATURA_LAYER_Z_INDEX;
  }

  // Species density layers should sit above the other criteria when enabled.
  // Their relative order still follows the order in projectLayers.
  if (layerConfig.group === "species") {
    const speciesLayerIds = projectLayers
      .filter((layer) => layer.group === "species")
      .map((layer) => layer.id);
    const speciesIndex = speciesLayerIds.findIndex(
      (layerId) => layerId === layerConfig.id
    );

    return SPECIES_LAYER_Z_INDEX_BASE + (speciesLayerIds.length - speciesIndex);
  }

  // For all other layers, earlier panel entries render above later entries.
  const displayIndex = projectLayers.findIndex(
    (layer) => layer.id === layerConfig.id
  );

  return projectLayers.length - displayIndex;
}

export function getLayerLegendPriority(layerConfig) {
  // The legend selector follows almost the same priority as rendering. The only
  // special rule is that Natura 2000 stays the default legend when active.
  if (layerConfig.id === "natura2000") {
    return NATURA_LAYER_Z_INDEX;
  }

  const displayIndex = projectLayers.findIndex(
    (layer) => layer.id === layerConfig.id
  );

  return projectLayers.length - displayIndex;
}

export function getLegendUrl(layerConfig) {
  // GeoServer creates legend images from WMS query parameters.
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetLegendGraphic",
    VERSION: "1.0.0",
    FORMAT: "image/png",
    LAYER: layerConfig.geoserverLayer,
  });

  return `${wmsEndpoint}?${params.toString()}`;
}

export function getLayerWmsUrl(layerConfig) {
  // GeoServer exposes each layer through a layer-specific WMS endpoint:
  // /geoserver/{workspace}/{layerName}/wms.
  const [workspace, layerName] = layerConfig.geoserverLayer.split(":");
  const geoserverRoot = wmsEndpoint.replace(/\/[^/]+\/wms$/, "");

  return `${geoserverRoot}/${workspace}/${layerName}/wms`;
}

export function getLayerWmsCapabilitiesUrl(layerConfig) {
  // Capabilities XML describes this one layer endpoint and is useful for
  // debugging or consuming the layer in external GIS clients.
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetCapabilities",
    VERSION: "1.3.0",
  });

  return `${getLayerWmsUrl(layerConfig)}?${params.toString()}`;
}

export function getWmsCapabilitiesUrl() {
  // The capabilities document lists the WMS service metadata and available layers.
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetCapabilities",
    VERSION: "1.3.0",
  });

  return `${wmsEndpoint}?${params.toString()}`;
}

function getRawRasterValue(properties) {
  // GeoServer commonly returns raster cell values as GRAY_INDEX. The fallback
  // keeps the dashboard useful if a layer returns a differently named property.
  if (!properties) return null;

  if ("GRAY_INDEX" in properties) {
    return properties.GRAY_INDEX;
  }

  const values = Object.values(properties);

  if (values.length === 0) {
    return null;
  }

  return values[0];
}

function toNumber(value) {
  // UI formatting only works for real numbers; empty strings and NaN are ignored.
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatNumber(value, digits = 2) {
  // Centralized number formatting keeps map-query values visually consistent.
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatInteger(value) {
  // Raster values are often decimals internally, but most dashboard displays
  // should read as whole units such as metres, millimetres, or class values.
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatSecondsAsHoursMinutes(seconds) {
  // Sunshine duration is stored as seconds, but hours/minutes are easier to read.
  const totalSeconds = Math.max(0, Math.round(seconds));
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.round((totalSeconds % 3600) / 60);

  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  return `${formatInteger(hours)} h ${minutes} min`;
}

function outsideStudyArea() {
  // The analysis rasters use -9999 as a NoData/outside-study-area marker.
  return {
    primaryValue: "Outside study area",
  };
}

function noValue() {
  // Shared fallback for null, empty, or non-numeric GeoServer responses.
  return {
    primaryValue: "No value returned",
    note: "GeoServer did not return a usable raster value for this location.",
  };
}

/**
 * Converts raw GeoServer GetFeatureInfo properties into compact user-facing
 * display values.
 *
 * Example: GeoServer may return "4" for the suitability layer; the dashboard
 * shows "High suitability" so the user does not need to know the class code.
 * Each return object can include:
 * - primaryValue: main value shown in large text.
 * - secondaryValue: optional small context line above the main value.
 * - note: optional explanatory text below the main value.
 */
export function formatFeatureInfo(layerConfig, properties) {
  const rawValue = getRawRasterValue(properties);
  const numericValue = toNumber(rawValue);

  if (numericValue === null) {
    return noValue();
  }

  if (numericValue === -9999) {
    return outsideStudyArea();
  }

  switch (layerConfig.valueType) {
    case "suitability": {
      const suitabilityLabel =
        layerConfig.valueMap?.[numericValue] ?? "Unknown suitability class";

      return {
        primaryValue: suitabilityLabel,
        secondaryValue: `Class value: ${numericValue} / 5`,
      };
    }

    case "precipitation":
      return {
        primaryValue: `${formatInteger(numericValue)} mm`,
      };

    case "sunshine_seconds":
      return {
        primaryValue: formatSecondsAsHoursMinutes(numericValue),
      };

    case "temperature":
      return {
        primaryValue: `${formatNumber(numericValue, 1)} °C`,
      };

    case "elevation":
      return {
        primaryValue: `${formatInteger(numericValue)} m a.s.l.`,
      };

    case "slope":
      return {
        primaryValue: `${formatInteger(numericValue)}°`,
      };

    case "clc":
      return {
        primaryValue:
          clcClassMap[numericValue] ?? `Unknown land-cover class ${rawValue}`,
      };

    case "water_binary":
      return {
        primaryValue:
          numericValue === 1
            ? "Water body present"
            : "No water body at this location",
      };

    case "road_binary":
      return {
        primaryValue:
          numericValue === 1 ? "Road present" : "No road at this location",
      };

    case "distance_m":
      return {
        primaryValue: `${formatInteger(numericValue)} m`,
      };

    case "density":
      return {
        primaryValue: formatInteger(numericValue),
        secondaryValue: "Relative density value",
      };

    case "natura_binary":
      if (numericValue === 1) {
        return {
          primaryValue: "Inside Natura 2000 area",
        };
      }

      if (numericValue === 5) {
        return {
          primaryValue: "Outside Natura 2000 area",
        };
      }

      return {
        primaryValue: `Unknown Natura 2000 value: ${rawValue}`,
      };

    default:
      return {
        primaryValue: String(rawValue),
      };
  }
}
