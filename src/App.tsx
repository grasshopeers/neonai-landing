import { useEffect, useState } from "react";
import NeonAiLanding from "./components/NeonAiLanding";
import VerifyPage from "./components/VerifyPage";

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

  return <NeonAiLanding />;
}
