/**
 * Main dashboard component.
 *
 * This file is the bridge between two worlds:
 * - React renders the user interface: panels, buttons, modals, legends, and
 *   text shown in the browser.
 * - OpenLayers renders the geographic map and talks to GeoServer WMS layers.
 *
 * The data catalogs in data/layers.js and data/basemaps.js describe what can
 * be shown. This component turns those descriptions into a working dashboard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Feature from "ol/Feature";
import Map from "ol/Map";
import View from "ol/View";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style, Circle as CircleStyle } from "ol/style";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import "ol/ol.css";

import { basemaps } from "./data/basemaps";
import {
  baseDataMetadataRecords,
  createWmsLayer,
  formatFeatureInfo,
  getLayerLegendPriority,
  getLayerWmsCapabilitiesUrl,
  getLayerWmsUrl,
  getLayerZIndex,
  getLegendUrl,
  gitlabWikiUrl,
  layerGroups,
  projectLayers,
} from "./data/layers";

const INITIAL_BASEMAP = "cartoLight";

// Approximate map boundary of the Austrian state of Salzburg in longitude/latitude.
const SALZBURG_EXTENT_4326 = [12.0, 46.85, 14.1, 48.15];

// The first map position shown before the map is fitted to Salzburg.
const INITIAL_CENTER = [13.1, 47.45];
const INITIAL_ZOOM = 8.3;
const MAP_FIT_PADDING = [24, 24, 24, 24];
const MAP_RESIZE_DELAY_MS = 100;
const COPY_FEEDBACK_DURATION_MS = 1800;
const CLICK_MARKER_Z_INDEX = 2000;

// Each walkthrough step points to one visible part of the dashboard. The
// position and pointer values are CSS class suffixes defined in index.css.
const WALKTHROUGH_STEPS = [
  {
    id: "layers",
    title: "Layer controls",
    position: "beside-left-panel",
    pointer: "left",
    text:
      "Use the layer panel to activate or deactivate project layers. The layers are grouped by analysis result, climate, topography, land cover, species observations, and protected areas. Open a group, enable a layer, adjust its opacity with the slider, or use the small information button to inspect service details.",
  },
  {
    id: "legend",
    title: "Legend selector",
    position: "beside-right-panel",
    pointer: "right",
    text:
      "The legend panel shows the legend for an active layer. By default, it follows the topmost active layer. If several layers are visible, use the dropdown to switch between their legends.",
  },
  {
    id: "map",
    title: "Map query",
    position: "map-bottom-left",
    pointer: "up-right",
    text:
      "Click anywhere on the map to query the topmost active project layer. A small marker shows the clicked location, and the formatted result appears in the feature information panel on the right.",
  },
  {
    id: "basemaps",
    title: "Basemaps",
    position: "under-basemap",
    pointer: "up",
    text:
      "Use the basemap selector to change the background map. Basemaps are only used for orientation; the analytical BeeSuitDa layers remain on top.",
  },
  {
    id: "resources",
    title: "Project resources",
    position: "under-topbar",
    pointer: "up",
    text:
      "The top-right buttons provide access to project resources. About opens project details and author contacts, Metadata provides links to HTML and XML metadata records, and GitLab Wiki opens the project documentation.",
  },
];

const PROJECT_AUTHORS = [
  {
    name: "Nikša Borovac",
    email: "niksa.borovac@stud.plus.ac.at",
  },
  {
    name: "Markus Tomio",
    email: "markus.tomio@student.plus.ac.at",
  },
  {
    name: "Adil Khan",
    email: "adil.khan@stud.plus.ac.at",
  },
];

const SOURCE_LICENSE_SUMMARY = [
  "Copernicus Land Monitoring Service / Copernicus DEM / CLC: derived and modified from Copernicus data; source attribution required under Copernicus data terms.",
  "GeoSphere Austria SPARTACUS: derived and modified from GeoSphere Austria SPARTACUS data; CC BY 4.0.",
  "OpenStreetMap-derived proximity layers: derived and modified from OpenStreetMap data; © OpenStreetMap contributors; ODbL.",
  "GBIF species observation layers: derived and modified from GBIF-mediated occurrence data; CC BY-NC; non-commercial reuse only.",
  "Natura 2000 / EEA protected areas: derived and modified from EEA/Natura 2000 data; source attribution required.",
];

// Some walkthrough targets are hidden inside collapsed groups. This map opens
// those groups only while the matching walkthrough step is active.
const WALKTHROUGH_FORCED_OPEN_GROUPS = {
  layers: ["analysis"],
};

function fitMapToSalzburg(map, duration = 500) {
  if (!map) return;

  // OpenLayers needs the latest element size before it can fit the view exactly.
  map.updateSize();

  map.getView().fit(
    transformExtent(SALZBURG_EXTENT_4326, "EPSG:4326", "EPSG:3857"),
    {
      padding: MAP_FIT_PADDING,
      duration,
    }
  );
}

function getInitialCollapsedGroups() {
  // Keep the analysis result open first; keep the other groups tucked away.
  return Object.fromEntries(
    layerGroups.map((group) => [group.id, group.id !== "analysis"])
  );
}

function createClickMarkerLayer() {
  // This separate vector layer draws the yellow dot after a user clicks the map.
  const markerLayer = new VectorLayer({
    source: new VectorSource(),
    style: [
      new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({
            color: "rgba(255, 255, 255, 0.85)",
          }),
          stroke: new Stroke({
            color: "rgba(58, 51, 36, 0.35)",
            width: 1,
          }),
        }),
      }),
      new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({
            color: "#ffd54f",
          }),
          stroke: new Stroke({
            color: "#3a3324",
            width: 1.5,
          }),
        }),
      }),
    ],
  });

  markerLayer.setZIndex(CLICK_MARKER_Z_INDEX);

  return markerLayer;
}

function createMetadataRows(layerList) {
  // The metadata modal shows project WMS layers first, then basemaps, then
  // original base datasets used in the analysis. The row shape is the same for
  // all three categories so the table can render them with one loop.
  return [
    ...layerList.map((layer) => ({
      id: `layer-${layer.id}`,
      name: layer.name,
      type: "Layer",
      metadataHtmlUrl: layer.metadataHtmlUrl,
      metadataXmlUrl: layer.metadataXmlUrl,
    })),
    ...Object.values(basemaps).map((basemap) => ({
      id: `basemap-${basemap.id}`,
      name: basemap.title,
      type: "Basemap",
      metadataHtmlUrl: basemap.metadataHtmlUrl,
      metadataXmlUrl: basemap.metadataXmlUrl,
    })),
    ...baseDataMetadataRecords.map((record) => ({
      id: `basedata-${record.id}`,
      name: record.name,
      type: "Basedata",
      metadataHtmlUrl: record.metadataHtmlUrl,
      metadataXmlUrl: record.metadataXmlUrl,
    })),
  ];
}

export default function App() {
  // Refs store OpenLayers objects. Updating a ref does not re-render React,
  // which is exactly what we want for map instances and map layer objects.
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapBasemapsRef = useRef({});
  const mapProjectLayersRef = useRef({});
  const clickMarkerLayerRef = useRef(null);
  const copyFeedbackTimeoutRef = useRef(null);

  // State stores values that the React interface must display immediately:
  // checked layers, selected basemap, modal visibility, and query results.
  const [layers, setLayers] = useState(projectLayers);
  const [selectedBasemap, setSelectedBasemap] = useState(INITIAL_BASEMAP);
  const [selectedLegendLayerId, setSelectedLegendLayerId] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [activeLayerInfo, setActiveLayerInfo] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMetadataNoticeOpen, setIsMetadataNoticeOpen] = useState(false);
  const [copiedAction, setCopiedAction] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(
    getInitialCollapsedGroups
  );

  // "intro" shows the opening modal. null means no walkthrough is active.
  const [walkthroughStep, setWalkthroughStep] = useState("intro");

  const activeWalkthroughStep = WALKTHROUGH_STEPS.find(
    (step) => step.id === walkthroughStep
  );
  const activeWalkthroughIndex = WALKTHROUGH_STEPS.findIndex(
    (step) => step.id === walkthroughStep
  );

  const setClickMarker = useCallback((coordinate) => {
    const markerSource = clickMarkerLayerRef.current?.getSource();

    if (!markerSource) return;

    markerSource.clear();
    markerSource.addFeature(new Feature(new Point(coordinate)));
  }, []);

  const getTopmostQueryableLayerConfig = useCallback(() => {
    // Map clicks query only one layer: the visible queryable layer on top.
    const queryableLayers = projectLayers.filter((layerConfig) => {
      const mapLayer = mapProjectLayersRef.current[layerConfig.id];

      return layerConfig.queryable && mapLayer?.getVisible();
    });

    queryableLayers.sort((a, b) => getLayerZIndex(b) - getLayerZIndex(a));

    return queryableLayers[0] ?? null;
  }, []);

  const handleMapClick = useCallback(
    async (map, event) => {
      // Convert from the map's projection to familiar longitude/latitude numbers.
      const [lon, lat] = toLonLat(event.coordinate);
      const clickedLon = lon.toFixed(5);
      const clickedLat = lat.toFixed(5);

      setClickMarker(event.coordinate);

      setSelectedLocation({
        status: "loading",
        lon: clickedLon,
        lat: clickedLat,
        title: "Querying GeoServer...",
        result: null,
        error: null,
      });

      const layerConfig = getTopmostQueryableLayerConfig();

      if (!layerConfig) {
        setSelectedLocation({
          status: "empty",
          lon: clickedLon,
          lat: clickedLat,
          title: "No queryable layer active",
          result: null,
          error: null,
        });

        return;
      }

      const view = map.getView();
      const resolution = view.getResolution();
      const projection = view.getProjection();

      try {
        const mapLayer = mapProjectLayersRef.current[layerConfig.id];
        const source = mapLayer.getSource();

        // WMS GetFeatureInfo asks GeoServer: "what value is under this click?"
        const url = source.getFeatureInfoUrl(
          event.coordinate,
          resolution,
          projection,
          {
            INFO_FORMAT: "application/json",
            FEATURE_COUNT: 10,
          }
        );

        if (!url) {
          throw new Error("No GetFeatureInfo URL generated.");
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `GeoServer returned ${response.status} ${response.statusText}`
          );
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "GeoServer did not return JSON. Check WMS GetFeatureInfo configuration."
          );
        }

        const data = await response.json();
        const features = data.features ?? [];

        if (features.length === 0) {
          setSelectedLocation({
            status: "empty",
            lon: clickedLon,
            lat: clickedLat,
            title: "No value found",
            result: {
              layerName: layerConfig.name,
              display: {
                primaryValue: "No value returned",
                note: "GeoServer did not return a feature value at this location.",
              },
            },
            error: null,
          });

          return;
        }

        setSelectedLocation({
          status: "success",
          lon: clickedLon,
          lat: clickedLat,
          title: "Feature information",
          result: {
            layerName: layerConfig.name,
            display: formatFeatureInfo(
              layerConfig,
              features[0].properties ?? {}
            ),
          },
          error: null,
        });
      } catch (error) {
        // Keep failures visible in the side panel instead of hiding them in the console.
        setSelectedLocation({
          status: "error",
          lon: clickedLon,
          lat: clickedLat,
          title: "GetFeatureInfo failed",
          result: null,
          error:
            error.message ||
            "The WMS layer could not be queried. Check GeoServer GetFeatureInfo and CORS settings.",
        });
      }
    },
    [getTopmostQueryableLayerConfig, setClickMarker]
  );

  useEffect(() => {
    // Build every map layer once when the app opens. React renders the controls;
    // OpenLayers renders the actual geographic map.
    const createdBasemaps = Object.fromEntries(
      Object.entries(basemaps).map(([id, basemap]) => [id, basemap.layer()])
    );

    const createdProjectLayers = Object.fromEntries(
      projectLayers.map((layerConfig) => {
        const layer = createWmsLayer(layerConfig);

        layer.setZIndex(getLayerZIndex(layerConfig));

        return [layerConfig.id, layer];
      })
    );

    const clickMarkerLayer = createClickMarkerLayer();

    mapBasemapsRef.current = createdBasemaps;
    mapProjectLayersRef.current = createdProjectLayers;
    clickMarkerLayerRef.current = clickMarkerLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [
        ...Object.values(createdBasemaps),
        ...Object.values(createdProjectLayers),
        clickMarkerLayer,
      ],
      view: new View({
        center: fromLonLat(INITIAL_CENTER),
        zoom: INITIAL_ZOOM,
      }),
    });

    map.on("singleclick", async (event) => {
      await handleMapClick(map, event);
    });

    mapInstanceRef.current = map;

    requestAnimationFrame(() => {
      fitMapToSalzburg(map, 0);
    });

    return () => {
      // Disconnect OpenLayers if React ever removes this component.
      map.setTarget(undefined);
      mapInstanceRef.current = null;
      clickMarkerLayerRef.current = null;
    };
  }, [handleMapClick]);

  useEffect(() => {
    if (!mapRef.current || !mapInstanceRef.current) return;

    // If the browser resizes a panel, tell OpenLayers to redraw its map canvas.
    const resizeObserver = new ResizeObserver(() => {
      mapInstanceRef.current?.updateSize();
    });

    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    // Modals and walkthrough cards can change available map space after rendering.
    // A short delay lets the browser finish layout before OpenLayers measures it.
    const timeoutId = window.setTimeout(() => {
      mapInstanceRef.current?.updateSize();
    }, MAP_RESIZE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [walkthroughStep, activeLayerInfo, isMetadataNoticeOpen]);

  useEffect(
    () => () => {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
    },
    []
  );

  function highlightClass(stepId) {
    // Adds the yellow outline only around the current walkthrough target.
    return walkthroughStep === stepId ? " walkthrough-highlight" : "";
  }

  function startWalkthrough() {
    setIsAboutOpen(false);
    setWalkthroughStep(WALKTHROUGH_STEPS[0].id);
  }

  function skipWalkthrough() {
    setWalkthroughStep(null);
  }

  function openAbout() {
    setWalkthroughStep(null);
    setIsAboutOpen(true);
  }

  function openMetadataNotice() {
    setWalkthroughStep(null);
    setIsMetadataNoticeOpen(true);
  }

  function goToPreviousWalkthroughStep() {
    if (activeWalkthroughIndex <= 0) {
      setWalkthroughStep("intro");
      return;
    }

    setWalkthroughStep(WALKTHROUGH_STEPS[activeWalkthroughIndex - 1].id);
  }

  function goToNextWalkthroughStep() {
    if (activeWalkthroughIndex >= WALKTHROUGH_STEPS.length - 1) {
      setWalkthroughStep(null);
      return;
    }

    setWalkthroughStep(WALKTHROUGH_STEPS[activeWalkthroughIndex + 1].id);
  }

  function getDefaultLegendLayer(layerList) {
    const activeLayerList = layerList.filter((layer) => layer.active);

    activeLayerList.sort(
      (a, b) => getLayerLegendPriority(b) - getLayerLegendPriority(a)
    );

    return activeLayerList[0] ?? null;
  }

  function changeBasemap(id) {
    // Basemaps sit underneath project layers, so only one should be visible at a time.
    setSelectedBasemap(id);

    Object.values(mapBasemapsRef.current).forEach((layer) => {
      layer.setVisible(false);
    });

    mapBasemapsRef.current[id]?.setVisible(true);
  }

  function updateLayerVisibility(layerId, checked) {
    // Keep React's checkbox state and OpenLayers' actual layer visibility in sync.
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, active: checked } : layer
      )
    );

    mapProjectLayersRef.current[layerId]?.setVisible(checked);
  }

  function updateLayerOpacity(layerId, opacity) {
    const numericOpacity = Number(opacity);

    // The slider value is stored in React and sent to OpenLayers immediately.
    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity: numericOpacity } : layer
      )
    );

    mapProjectLayersRef.current[layerId]?.setOpacity(numericOpacity);
  }

  function toggleLayerGroup(groupId) {
    setCollapsedGroups((currentGroups) => ({
      ...currentGroups,
      [groupId]: !currentGroups[groupId],
    }));
  }

  function resetView() {
    fitMapToSalzburg(mapInstanceRef.current, 500);
  }

  async function copyTextToClipboard(text, action) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");

      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    window.clearTimeout(copyFeedbackTimeoutRef.current);
    setCopiedAction(action);

    copyFeedbackTimeoutRef.current = window.setTimeout(() => {
      setCopiedAction(null);
    }, COPY_FEEDBACK_DURATION_MS);
  }

  async function copyWmsAccess(layerConfig) {
    await copyTextToClipboard(getLayerWmsUrl(layerConfig), "wmsAccess");
  }

  const activeBasemap = basemaps[selectedBasemap];
  const activeLayers = layers.filter((layer) => layer.active);
  const metadataRows = createMetadataRows(layers);
  const defaultLegendLayer = getDefaultLegendLayer(layers);

  // If the user has not chosen a legend, follow the layer panel hierarchy.
  const selectedLegendLayer =
    activeLayers.find((layer) => layer.id === selectedLegendLayerId) ??
    defaultLegendLayer;

  const currentActiveLayerInfo = activeLayerInfo
    ? layers.find((layer) => layer.id === activeLayerInfo.id) ?? activeLayerInfo
    : null;

  return (
    <div className="app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      {/* First-run introduction shown before the guided walkthrough begins. */}
      {walkthroughStep === "intro" && (
        <div className="modal-backdrop">
          <section className="welcome-modal glass">
            <p className="eyebrow">Dashboard walkthrough</p>
            <h2>Welcome to the BeeSuitDa SDI Dashboard</h2>
            <p>
              This dashboard provides access to beekeeping suitability data for
              Salzburg through interactive SDI map services. The walkthrough
              shows how to control layers, inspect map values, read legends,
              switch basemaps, and access project resources.
            </p>

            <div className="modal-actions walkthrough-intro-actions">
              <button className="primary" onClick={startWalkthrough}>
                Start walkthrough
              </button>

              <button
                className="secondary-button"
                onClick={skipWalkthrough}
              >
                Skip walkthrough
              </button>
            </div>
          </section>
        </div>
      )}

      {/* About modal: project context, licences, authors, and AI disclosure. */}
      {isAboutOpen && (
        <div className="modal-backdrop" onClick={() => setIsAboutOpen(false)}>
          <section
            className="about-modal glass"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="about-modal-scroll">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">About the project</p>
                  <h2>BeeSuitDa SDI Dashboard</h2>
                  <p className="version-line">Dashboard version: 1.0.0</p>
                </div>

                <button
                  className="icon-button"
                  onClick={() => setIsAboutOpen(false)}
                  aria-label="Close about dialog"
                >
                  ×
                </button>
              </div>

              <p>
                BeeSuitDa brings beekeeping suitability layers for Salzburg into
                one interactive SDI dashboard. The map combines GeoServer WMS
                services, legends, basemaps, and click queries so users can
                inspect suitability criteria directly in the browser.
              </p>

              <section className="licence-summary">
                <h3>Licensing & attribution</h3>
                <p>
                  BeeSuitDa dashboard layers are derived, modified, and
                  processed from multiple open geospatial datasets. Original
                  source licences and attribution requirements are retained.
                  Detailed lineage and metadata information are
                  provided through GeoNetwork metadata records.
                </p>

                <ul>
                  {SOURCE_LICENSE_SUMMARY.map((summary) => (
                    <li key={summary}>{summary}</li>
                  ))}
                </ul>
              </section>

              <section className="about-authors" aria-labelledby="authors-title">
                <h3 id="authors-title">Authors</h3>

                <div className="author-list">
                  {PROJECT_AUTHORS.map((author) => (
                    <a
                      key={author.email}
                      className="author-contact"
                      href={`mailto:${author.email}`}
                    >
                      <span>{author.name}</span>
                      <span>{author.email}</span>
                    </a>
                  ))}
                </div>
              </section>

              <section
                className="coding-assistance"
                aria-labelledby="coding-assistance-title"
              >
                <h3 id="coding-assistance-title">Coding assistance</h3>
                <p>
                  The dashboard implementation was developed by the project
                  authors with coding assistance from OpenAI Codex. The authors
                  reviewed, edited, and take responsibility for the final code
                  and content.
                </p>
              </section>

              <div className="modal-actions">
                <button className="primary" onClick={startWalkthrough}>
                  Repeat walkthrough
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Metadata modal: one table for layer, basemap, and base-data records. */}
      {isMetadataNoticeOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsMetadataNoticeOpen(false)}
        >
          <section
            className="metadata-modal glass"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="metadata-modal-scroll">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Metadata</p>
                  <h2>Metadata records</h2>
                </div>

                <button
                  className="icon-button"
                  onClick={() => setIsMetadataNoticeOpen(false)}
                  aria-label="Close metadata notice"
                >
                  ×
                </button>
              </div>

              <p>
                Project layer metadata records are provided through GeoNetwork.
                Basemap rows link to provider documentation where available.
              </p>

              <div className="metadata-link-table">
                <div className="metadata-link-row metadata-link-row-header">
                  <span>Dataset</span>
                  <span>Type</span>
                  <span>HTML</span>
                  <span>XML</span>
                </div>

                {metadataRows.map((item) => (
                  <div className="metadata-link-row" key={item.id}>
                    <span className="metadata-layer-name">{item.name}</span>
                    <span className="metadata-item-type">{item.type}</span>

                    {item.metadataHtmlUrl ? (
                      <a
                        href={item.metadataHtmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="metadata-link-button"
                      >
                        HTML
                      </a>
                    ) : (
                      <button
                        className="metadata-link-button disabled"
                        disabled
                      >
                        Pending
                      </button>
                    )}

                    {item.metadataXmlUrl ? (
                      <a
                        href={item.metadataXmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="metadata-link-button"
                      >
                        XML
                      </a>
                    ) : (
                      <button
                        className="metadata-link-button disabled"
                        disabled
                      >
                        Pending
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Walkthrough card shown beside the currently highlighted dashboard area. */}
      {activeWalkthroughStep && (
        <>
          <div className="walkthrough-backdrop" />

          <section
            className={`walkthrough-card glass walkthrough-card-${activeWalkthroughStep.position} walkthrough-pointer-${activeWalkthroughStep.pointer}`}
          >
            <p className="eyebrow">
              Step {activeWalkthroughIndex + 1} of {WALKTHROUGH_STEPS.length}
            </p>

            <h2>{activeWalkthroughStep.title}</h2>
            <p>{activeWalkthroughStep.text}</p>

            <div className="walkthrough-card-actions">
              <button
                className="secondary-button"
                onClick={skipWalkthrough}
              >
                Skip
              </button>

              <div className="walkthrough-card-actions-right">
                <button onClick={goToPreviousWalkthroughStep}>Back</button>

                <button className="primary" onClick={goToNextWalkthroughStep}>
                  {activeWalkthroughIndex === WALKTHROUGH_STEPS.length - 1
                    ? "Finish"
                    : "Next"}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Layer information modal opened from the small "i" buttons. */}
      {currentActiveLayerInfo && (
        <div
          className="modal-backdrop"
          onClick={() => setActiveLayerInfo(null)}
        >
          <section
            className="layer-info-modal glass"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Layer information</p>
                <h2>{currentActiveLayerInfo.name}</h2>
              </div>

              <button
                className="icon-button"
                onClick={() => setActiveLayerInfo(null)}
                aria-label="Close layer information"
              >
                ×
              </button>
            </div>

            <p>{currentActiveLayerInfo.description}</p>

            {currentActiveLayerInfo.licenseNote && (
              <p className="layer-licence-note">
                This is a mixed-source derived analytical layer. Reuse is
                subject to the licences of the underlying input datasets,
                including non-commercial restrictions from CC BY-NC GBIF data.
              </p>
            )}

            <dl className="layer-info-list">
              <div>
                <dt>Service type</dt>
                <dd>{currentActiveLayerInfo.serviceType}</dd>
              </div>

              <div>
                <dt>CRS</dt>
                <dd>{currentActiveLayerInfo.crs}</dd>
              </div>

              <div>
                <dt>GeoServer layer</dt>
                <dd>{currentActiveLayerInfo.geoserverLayer}</dd>
              </div>

              <div>
                <dt>Queryable</dt>
                <dd>{currentActiveLayerInfo.queryable ? "Yes" : "No"}</dd>
              </div>
            </dl>

            <div className="modal-actions">
              <a
                href={getLayerWmsCapabilitiesUrl(currentActiveLayerInfo)}
                target="_blank"
                rel="noreferrer"
                className="link-button"
              >
                WMS Capabilities
              </a>

              <button
                className="link-button"
                onClick={() => copyWmsAccess(currentActiveLayerInfo)}
              >
                {copiedAction === "wmsAccess"
                  ? "Copied WMS access"
                  : "Copy WMS access"}
              </button>

              <a
                href={getLegendUrl(currentActiveLayerInfo)}
                target="_blank"
                rel="noreferrer"
                className="link-button"
              >
                Open Legend
              </a>

              {currentActiveLayerInfo.metadataHtmlUrl ? (
                <a
                  href={currentActiveLayerInfo.metadataHtmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link-button primary-link"
                >
                  Metadata HTML
                </a>
              ) : (
                <button className="link-button disabled" disabled>
                  Metadata HTML pending
                </button>
              )}

              {currentActiveLayerInfo.metadataXmlUrl ? (
                <a
                  href={currentActiveLayerInfo.metadataXmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="link-button primary-link"
                >
                  Metadata XML
                </a>
              ) : (
                <button className="link-button disabled" disabled>
                  Metadata XML pending
                </button>
              )}
            </div>

            <p className="metadata-status-note">
              Detailed licence and lineage information pending GeoNetwork
              publication.
            </p>
          </section>
        </div>
      )}

      {/* Top navigation and project resource links. */}
      <header className={`topbar glass${highlightClass("resources")}`}>
        <div>
          <p className="eyebrow">26S856263: SDI Services Implementation</p>
          <h1>BeeSuitDa - SDI-Based Beekeeping Suitability Dashboard</h1>
        </div>

        <nav className="topbar-actions">
          <button onClick={openAbout}>About</button>
          <button onClick={openMetadataNotice}>Metadata</button>
          <a
            className="topbar-link primary"
            href={gitlabWikiUrl}
            target="_blank"
            rel="noreferrer"
          >
            GitLab Wiki
          </a>
        </nav>
      </header>

      <main className="dashboard">
        {/* Left panel: project layer categories, visibility toggles, opacity sliders. */}
        <aside className="panel glass">
          <div className="panel-header layer-panel-header">
            <h2>Choose What the Map Shows</h2>
            <p>
              Each layer shows a different part of the suitability analysis.
              Open a category and turn on a layer to explore it. For the
              clearest view, use one data layer at a time and adjust its
              transparency to reveal the map underneath.
            </p>
          </div>

          <div className={`layer-groups${highlightClass("layers")}`}>
            {layerGroups.map((group) => {
              const groupLayers = layers.filter(
                (layer) => layer.group === group.id
              );
              const forcedOpenGroups =
                WALKTHROUGH_FORCED_OPEN_GROUPS[walkthroughStep] ?? [];

              const isForcedOpen = forcedOpenGroups.includes(group.id);
              const isCollapsed = isForcedOpen
                ? false
                : collapsedGroups[group.id] ?? false;

              if (groupLayers.length === 0) return null;

              return (
                <section key={group.id} className="layer-group">
                  <button
                    type="button"
                    className="layer-group-toggle"
                    onClick={() => toggleLayerGroup(group.id)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.title}</span>
                    <span className="layer-group-icon">
                      {isForcedOpen ? "•" : isCollapsed ? "+" : "−"}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="layer-list">
                      {groupLayers.map((layer) => (
                        <div key={layer.id} className="layer-item">
                          <div className="layer-title-row">
                            <label className="layer-toggle">
                              <input
                                type="checkbox"
                                checked={layer.active}
                                onChange={(event) =>
                                  updateLayerVisibility(
                                    layer.id,
                                    event.target.checked
                                  )
                                }
                              />
                              <span>{layer.name}</span>
                            </label>

                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => setActiveLayerInfo(layer)}
                              aria-label={`Open information for ${layer.name}`}
                              title={`Layer information: ${layer.name}`}
                            >
                              i
                            </button>
                          </div>

                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={layer.opacity}
                            disabled={!layer.active}
                            onChange={(event) =>
                              updateLayerOpacity(layer.id, event.target.value)
                            }
                            aria-label={`${layer.name} opacity`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </aside>

        {/* Center panel: OpenLayers map plus basemap selector and attribution. */}
        <section className={`map-card glass${highlightClass("map")}`}>
          <div className="map-toolbar">
            <div>
              <p className="eyebrow">Interactive map</p>
              <h2>Suitability Explorer</h2>
              <p className="map-hint">
                Click the map to query the topmost active layer.
              </p>
            </div>

            <div className="map-toolbar-actions">
              <select
                className={`map-control map-basemap-select${highlightClass(
                  "basemaps"
                )}`}
                value={selectedBasemap}
                onChange={(event) => changeBasemap(event.target.value)}
                aria-label="Basemap"
              >
                <option value={selectedBasemap} hidden>
                  Basemap: {activeBasemap.title}
                </option>
                {Object.entries(basemaps).map(([id, basemap]) => (
                  <option key={id} value={id}>
                    {basemap.title}
                  </option>
                ))}
              </select>

              <button
                className="map-control map-reset-button"
                onClick={resetView}
              >
                Reset View
              </button>
            </div>
          </div>

          <div ref={mapRef} className="map" />

          <footer className="map-footer">
            <span>BeeSuitDa derived layers · source licences retained</span>
            <span className="map-attribution">
              Basemap: {activeBasemap.title} ·{" "}
              {activeBasemap.attribution.map((part, index) =>
                part.href ? (
                  <a
                    key={`${part.text}-${index}`}
                    href={part.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {part.text}
                  </a>
                ) : (
                  <span key={`${part.text}-${index}`}>{part.text}</span>
                )
              )}
            </span>
          </footer>
        </section>

        {/* Right panel: click-query results and the legend for visible layers. */}
        <aside className="panel glass">
          <div className="panel-header">
            <h2>Information</h2>
          </div>

          <div className={`info-block${highlightClass("map")}`}>
            <p className="eyebrow">Selected feature</p>

            {selectedLocation ? (
              <>
                <h3>{selectedLocation.title}</h3>

                {selectedLocation.status === "loading" && (
                  <p>Querying topmost active WMS layer...</p>
                )}

                {selectedLocation.error && (
                  <p className="error-text">{selectedLocation.error}</p>
                )}

                {selectedLocation.result && (
                  <div className="feature-result">
                    <p className="feature-meta">Queried layer</p>
                    <h4>{selectedLocation.result.layerName}</h4>

                    {selectedLocation.result.display.secondaryValue && (
                      <p className="feature-subvalue">
                        {selectedLocation.result.display.secondaryValue}
                      </p>
                    )}

                    <p className="feature-primary-value">
                      {selectedLocation.result.display.primaryValue}
                    </p>

                    {selectedLocation.result.display.note && (
                      <p className="feature-note">
                        {selectedLocation.result.display.note}
                      </p>
                    )}
                  </div>
                )}

                <div className="clicked-location">
                  <p className="feature-meta">Clicked location</p>
                  <p>
                    {selectedLocation.lat}° N
                    <br />
                    {selectedLocation.lon}° E
                  </p>
                </div>
              </>
            ) : (
              <>
                <h3>No feature selected</h3>
                <p>
                  Click the map to inspect the topmost active project layer.
                </p>
              </>
            )}
          </div>

          <div className={`info-block${highlightClass("legend")}`}>
            <p className="eyebrow">Legend</p>

            {activeLayers.length > 0 ? (
              <>
                <select
                  className="legend-select"
                  value={selectedLegendLayer?.id ?? ""}
                  onChange={(event) =>
                    setSelectedLegendLayerId(event.target.value)
                  }
                >
                  {activeLayers.map((layer) => (
                    <option key={layer.id} value={layer.id}>
                      {layer.name}
                    </option>
                  ))}
                </select>

                {selectedLegendLayer && (
                  <div className="legend-item">
                    <h3>{selectedLegendLayer.name}</h3>
                    <img
                      className="legend-image"
                      src={getLegendUrl(selectedLegendLayer)}
                      alt={`${selectedLegendLayer.name} legend`}
                    />
                  </div>
                )}
              </>
            ) : (
              <p>No visible project layer.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
