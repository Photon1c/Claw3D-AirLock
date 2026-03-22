import { useState } from "react";
import PixelOffice from "./components/PixelOffice";
import GenealogyLab from "./components/GenealogyLab";
import AdminAssistant from "./components/AdminAssistant";
import StockForecasts from "./components/StockForecasts";

type ViewType = "main" | "genealogy" | "admin" | "stocks";

function App() {
  const [currentView, setCurrentView] = useState<ViewType>("main");

  if (currentView === "genealogy") {
    return <GenealogyLab onNavigate={(view) => setCurrentView(view as ViewType)} />;
  }

  if (currentView === "admin") {
    return <AdminAssistant onNavigate={(view) => setCurrentView(view as ViewType)} />;
  }

  if (currentView === "stocks") {
    return <StockForecasts />;
  }

  return (
    <PixelOffice
      config={{
        mockMode: true,
        mockToggleSpeed: 5000,
        showStatusBar: true,
        showNames: true,
        animationSpeed: 2,
        canvasScale: 1,
      }}
    />
  );
}

export default App;
