import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

/**
 * main.jsx
 * --------
 * Einstiegspunkt der Anwendung: hängt die App in die HTML-Seite (das
 * <div id="root"> aus index.html) und stellt über BrowserRouter die
 * URL-basierte Navigation für die ganze App bereit.
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
