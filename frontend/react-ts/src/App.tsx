import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./app/context/AuthContext";
import { ThemeProvider } from "./app/context/ThemeContext";
import { BoardProvider } from "./app/context/BoardContext";
import { TagProvider } from "./app/context/TagContext";
import { ConceptProvider } from "./app/context/ConceptContext";
import { SessionProvider } from "./app/context/SessionContext";
import { LogProvider } from "./app/context/LogContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Provider order follows dependencies: ConceptContext reads boards
            (for mastery thresholds) and tag pools, so its providers must
            wrap it. */}
        <BoardProvider>
          <TagProvider>
            <ConceptProvider>
              <SessionProvider>
                <LogProvider>
                  <RouterProvider router={router} />
                </LogProvider>
              </SessionProvider>
            </ConceptProvider>
          </TagProvider>
        </BoardProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
