import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import FloatingChatButton from "@/components/feature/FloatingChatButton";
import { AuthProvider } from "@/context/AuthContext";


function App() {
  return (
    <BrowserRouter basename={__BASE_PATH__}>
      <AuthProvider>
        <AppRoutes />
        <FloatingChatButton />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
