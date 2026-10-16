import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import RunDetail from "./pages/RunDetail";
import Compare from "./pages/Compare";
import Limits from "./pages/Limits";
import AuditLog from "./pages/AuditLog";
import Login from "./pages/Login";
import "./pages/pages.css";
import CadViewer from "./pages/CadViewer";

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <Link to="/">Back to overview</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login sits outside Layout, so it has no nav bar */}
        <Route path="/login" element={<Login />} />

        {/* Everything else renders inside Layout's <Outlet /> */}
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="runs/:runId" element={<RunDetail />} />
          <Route path="compare" element={<Compare />} />
          <Route path="limits" element={<Limits />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="*" element={<NotFound />} />
          <Route path="cad/:component" element={<CadViewer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}