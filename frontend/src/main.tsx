import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./auth";
import AuthPage from "./pages/AuthPage";
import { Overview, Workspace } from "./pages/Workspace";
import Profile from "./pages/Profile";
import Users from "./pages/Users";
import "./styles.css";

function AuthRoute() {
  const location = useLocation();
  return <AuthPage key={location.pathname + location.hash} />;
}
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          {["login", "signup", "forgot", "reset", "verify", "resend"].map(
            (page) => (
              <Route key={page} path={`/${page}`} element={<AuthRoute />} />
            ),
          )}
          <Route path="/workspace" element={<Workspace />}>
            <Route index element={<Overview />} />
            <Route path="profile" element={<Profile />} />
            <Route path="users" element={<Users />} />
          </Route>
          <Route
            path="*"
            element={
              <main className="grid min-h-screen place-items-center p-6">
                <div>
                  <h1 className="text-3xl font-semibold">Page not found</h1>
                  <p className="mt-4 text-muted">
                    This page isn’t part of your RAHMA workspace.
                  </p>
                  <Link to="/workspace" className="button mt-6">
                    Go to workspace
                  </Link>
                </div>
              </main>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
