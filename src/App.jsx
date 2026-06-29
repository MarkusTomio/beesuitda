/**
 * Main dashboard component.
 *
 * This file connects the visible React interface to the OpenLayers map. It
 * imports layer definitions from data/layers.js, basemap definitions from
 * data/basemaps.js, and renders the panels, walkthrough, map, legend, and
 * feature-information workflow that make up the BeeSuitDa dashboard.
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
  createWmsLayer,
  formatFeatureInfo,
  getLayerWmsUrl,
  getLayerZIndex,
  getLegendUrl,
  getWmsCapabilitiesUrl,
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

// Each walkthrough step points to one visible part of the dashboard.
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
    position: "beside-basemap",
    pointer: "left",
    text:
      "Use the basemap selector to change the background map. Basemaps are only used for orientation; the analytical BeeSuitDa layers remain on top.",
  },
  {
    id: "resources",
    title: "Project resources",
    position: "under-topbar",
    pointer: "up",
    text:
      "The top-right buttons provide access to project resources. About opens project details and author contacts, Metadata will link to metadata records once available, and GitLab Wiki opens the project documentation.",
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
      padding: [24, 24, 24, 24],
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

  markerLayer.setZIndex(2000);

  return markerLayer;
}

export default function App() {
  // Refs store OpenLayers objects. React state stores values that must update the UI.
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapBasemapsRef = useRef({});
  const mapProjectLayersRef = useRef({});
  const clickMarkerLayerRef = useRef(null);
  const copyFeedbackTimeoutRef = useRef(null);

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

      setClickMarker(event.coordinate);

      setSelectedLocation({
        status: "loading",
        lon: lon.toFixed(5),
        lat: lat.toFixed(5),
        title: "Querying GeoServer...",
        result: null,
        error: null,
      });

      const layerConfig = getTopmostQueryableLayerConfig();

      if (!layerConfig) {
        setSelectedLocation({
          status: "empty",
          lon: lon.toFixed(5),
          lat: lat.toFixed(5),
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
            lon: lon.toFixed(5),
            lat: lat.toFixed(5),
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
          lon: lon.toFixed(5),
          lat: lat.toFixed(5),
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
          lon: lon.toFixed(5),
          lat: lat.toFixed(5),
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
    const timeoutId = window.setTimeout(() => {
      mapInstanceRef.current?.updateSize();
    }, 100);

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

  function getTopmostActiveLayer(layerList) {
    // The topmost layer is the visible project layer with the highest map z-index.
    const activeLayerList = layerList.filter((layer) => layer.active);

    activeLayerList.sort((a, b) => getLayerZIndex(b) - getLayerZIndex(a));

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
    }, 1800);
  }

  async function copyWmsAccess(layerConfig) {
    await copyTextToClipboard(getLayerWmsUrl(layerConfig), "wmsAccess");
  }

  const activeBasemap = basemaps[selectedBasemap];
  const activeLayers = layers.filter((layer) => layer.active);
  const topmostActiveLayer = getTopmostActiveLayer(layers);

  // If the user has not chosen a legend, show the legend for the top visible layer.
  const selectedLegendLayer =
    activeLayers.find((layer) => layer.id === selectedLegendLayerId) ??
    topmostActiveLayer;

  const currentActiveLayerInfo = activeLayerInfo
    ? layers.find((layer) => layer.id === activeLayerInfo.id) ?? activeLayerInfo
    : null;

  return (
    <div className="app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

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

      {isAboutOpen && (
        <div className="modal-backdrop" onClick={() => setIsAboutOpen(false)}>
          <section
            className="about-modal glass"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">About the project</p>
                <h2>BeeSuitDa SDI Dashboard</h2>
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

            <div className="modal-actions">
              <button className="primary" onClick={startWalkthrough}>
                Repeat walkthrough
              </button>

              <a
                href={gitlabWikiUrl}
                target="_blank"
                rel="noreferrer"
                className="link-button"
              >
                Open GitLab Wiki
              </a>
            </div>
          </section>
        </div>
      )}

      {isMetadataNoticeOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsMetadataNoticeOpen(false)}
        >
          <section
            className="metadata-modal glass"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Metadata</p>
                <h2>GeoNetwork records pending</h2>
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
              Metadata records will be provided through GeoNetwork. HTML and
              XML metadata links are currently pending.
            </p>
          </section>
        </div>
      )}

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
                href={getWmsCapabilitiesUrl()}
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
          </section>
        </div>
      )}

      <header className={`topbar glass${highlightClass("resources")}`}>
        <div>
          <p className="eyebrow">26S856263: SDI Services Implementation</p>
          <h1>BeeSuitDa — SDI-Based Beekeeping Suitability Dashboard</h1>
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
        <aside className="panel glass">
          <div className={`info-block${highlightClass("basemaps")}`}>
            <p className="eyebrow">Basemap</p>

            <select
              value={selectedBasemap}
              onChange={(event) => changeBasemap(event.target.value)}
            >
              {Object.entries(basemaps).map(([id, basemap]) => (
                <option key={id} value={id}>
                  {basemap.title}
                </option>
              ))}
            </select>
          </div>

          <div className="panel-header">
            <h2>Layers</h2>
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

        <section className={`map-card glass${highlightClass("map")}`}>
          <div className="map-toolbar">
            <div>
              <p className="eyebrow">Interactive map</p>
              <h2>Suitability Explorer</h2>
              <p className="map-hint">
                Click the map to query the topmost active layer.
              </p>
            </div>

            <button onClick={resetView}>Reset View</button>
          </div>

          <div ref={mapRef} className="map" />

          <footer className="map-footer">
            <span>Data © BeeSuitDa Project</span>
            <span>
              Basemap: {activeBasemap.title} · {activeBasemap.attribution}
            </span>
          </footer>
        </section>

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
