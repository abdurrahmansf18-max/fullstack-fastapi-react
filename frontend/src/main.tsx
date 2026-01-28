// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import PublicApp from "./user/PublicApp";
import AdminApp from "./admin/AdminApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/admin" element={<AdminApp />} />
      <Route path="/" element={<PublicApp />} />
    </Routes>
  </BrowserRouter>
);
