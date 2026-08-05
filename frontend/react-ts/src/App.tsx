import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AppProvider } from "./app/context/AppContext";
import { AuthProvider } from "./app/context/AuthContext";
import { ThemeProvider } from "./app/context/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
