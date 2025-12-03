import "@xyflow/react/dist/style.css";
import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { LoadingPage } from "./pages/LoadingPage";
import { useTenantInitialization } from "./hooks/use-tenant-initialization";
import router from "./routes";
import { useDarkStore } from "./stores/darkStore";

function AppContent() {
  const dark = useDarkStore((state) => state.dark);
  // ... existing code ...
  useTenantInitialization(); // Initialize tenant context on app load
  
  useEffect(() => {
    if (!dark) {
      document.getElementById("body")!.classList.remove("dark");
    } else {
      document.getElementById("body")!.classList.add("dark");
    }
  }, [dark]);
  return (
    <Suspense fallback={<LoadingPage />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default function App() {
  return <AppContent />;
}
