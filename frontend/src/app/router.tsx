import { createBrowserRouter, Navigate } from "react-router";

import { isAuthenticated } from "../lib/auth";

import DashboardLayout from "../components/layout/DashboardLayout";

import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import MedicinesPage from "../features/medicines/MedicinesPage";
import InventoryPage from "../features/inventory/InventoryPage";
import SuppliersPage from "../features/suppliers/SuppliersPage";
import PurchasesPage from "../features/purchases/PurchasesPage";
import KnowledgePage from "../features/knowledge/KnowledgePage";
import ChatPage from "../features/ai-chat/ChatPage";
// import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";

function ProtectedLayout() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "medicines",
        element: <MedicinesPage />,
      },
      {
        path: "inventory",
        element: <InventoryPage />,
      },
      {
        path: "suppliers",
        element: <SuppliersPage />,
      },
      {
        path: "purchases",
        element: <PurchasesPage />,
      },
      {
        path: "knowledge",
        element: <KnowledgePage />,
      },
      {
        path: "ai-chat",
        element: <ChatPage />,
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
