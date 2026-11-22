
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Pill,
  Package,
  Truck,
  ShoppingCart,
  BookOpen,
  Bot,
  LogOut,
} from "lucide-react";

import { logout } from "../../lib/auth";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Medicines", path: "/medicines", icon: Pill },
  { label: "Inventory", path: "/inventory", icon: Package },
  { label: "Suppliers", path: "/suppliers", icon: Truck },
  { label: "Purchases", path: "/purchases", icon: ShoppingCart },
  { label: "Knowledge", path: "/knowledge", icon: BookOpen },
  { label: "AI Assistant", path: "/ai-chat", icon: Bot },
];

export default function DashboardLayout() {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Pill size={25} />
          <span>PharmaPilot</span>
        </div>

        <div className="sidebar-caption">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <strong>Pharmacy Workspace</strong>
            <span>Operations overview</span>
          </div>

          <div className="status-indicator">
            <span className="status-dot" />
            Connected workspace
          </div>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
