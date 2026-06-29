/**
 * React entry point.
 *
 * index.html provides the empty #root element, and this file mounts App.jsx
 * into that element. It also imports index.css so the dashboard styles are
 * loaded once for the whole application.
 */
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

// This is the hand-off point between the HTML page and the React application.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
