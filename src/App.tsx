import { useEffect, useState } from "react";
import NeonAiLanding from "./components/NeonAiLanding";
import VerifyPage from "./components/VerifyPage";
import DownloadPage from "./components/DownloadPage";

function currentRoute(): string {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path.toLowerCase();
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (route === "/verify") {
    return <VerifyPage />;
  }

  if (route === "/download") {
    return <DownloadPage />;
  }

  return <NeonAiLanding />;
}
