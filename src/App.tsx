import "./App.css";
import { useEffect, useState } from "react";
import { DirectionOnePage } from "./pages/DirectionOnePage";
import { DirectionTwoPage } from "./pages/DirectionTwoPage";

type PageRoute = "main" | "secondary";

const MAIN_ROUTE = "#/";
const SECOND_ROUTE = "#/secondary";

function resolveRoute(hash: string): PageRoute {
  return hash === SECOND_ROUTE ? "secondary" : "main";
}

function App() {
  const [route, setRoute] = useState<PageRoute>(() => resolveRoute(window.location.hash));

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = MAIN_ROUTE;
    }

    const onHashChange = () => {
      setRoute(resolveRoute(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    route === "main" ? (
      <DirectionOnePage
        onNavigate={() => {
          window.location.hash = SECOND_ROUTE;
        }}
      />
    ) : (
      <DirectionTwoPage
        onNavigate={() => {
          window.location.hash = MAIN_ROUTE;
        }}
      />
    )
  );
}

export default App;
