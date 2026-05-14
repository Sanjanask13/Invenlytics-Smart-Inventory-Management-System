import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import WelcomePage from "./pages/WelcomePage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import BarcodeScanner from "./pages/BarcodeScanner";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ReorderRecommendations from "./pages/ReorderRecommendations";
import Predictions from "./pages/Predictions";
import Discussion from "./pages/Discussion";
import { isMerchantAuthenticated } from "./utils/auth";

function MerchantProtectedRoute({ children }) {
  if (!isMerchantAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function MerchantPublicRoute({ children }) {
  if (isMerchantAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MerchantPublicRoute><WelcomePage /></MerchantPublicRoute>} />
        <Route path="/login" element={<MerchantPublicRoute><Login /></MerchantPublicRoute>} />
        <Route path="/signup" element={<MerchantPublicRoute><Register /></MerchantPublicRoute>} />
        <Route path="/register" element={<MerchantPublicRoute><Register /></MerchantPublicRoute>} />
        <Route path="/dashboard" element={<MerchantProtectedRoute><Dashboard /></MerchantProtectedRoute>} />
        <Route path="/products" element={<MerchantProtectedRoute><Products /></MerchantProtectedRoute>} />
        <Route path="/barcode-scanner" element={<MerchantProtectedRoute><BarcodeScanner /></MerchantProtectedRoute>} />
        <Route path="/discussion" element={<MerchantProtectedRoute><Discussion /></MerchantProtectedRoute>} />
        <Route path="/predictions" element={<MerchantProtectedRoute><Predictions /></MerchantProtectedRoute>} />
        <Route path="/reorder" element={<MerchantProtectedRoute><ReorderRecommendations /></MerchantProtectedRoute>} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
