import { createBrowserRouter, Outlet } from "react-router";
import { ScrollToTop } from "./app/components/ScrollToTop";
import { Root } from "./app/pages/Root";
import { Landing } from "./app/pages/Landing";
import { Demo } from "./app/pages/Demo";
import { Dashboard } from "./app/pages/Dashboard";
import { BoardDetail } from "./app/pages/BoardDetail";
import { ConceptDetail } from "./app/pages/ConceptDetail";
import { AllConcepts } from "./app/pages/AllConcepts";
import { AllTags } from "./app/pages/AllTags";
import { Sessions } from "./app/pages/Sessions";
import { SessionDetail } from "./app/pages/SessionDetail";
import { SessionPlay } from "./app/pages/SessionPlay";
import { Logs } from "./app/pages/Logs";
import { NewBoard } from "./app/pages/NewBoard";
import { UserSettings } from "./app/pages/UserSettings";
import { BoardSettings } from "./app/pages/BoardSettings";
import { Profile } from "./app/pages/Profile";
import { Login } from "./app/pages/Login";
import { Signup } from "./app/pages/Signup";
import { Verify } from "./app/pages/Verify";
import { ForgotPassword } from "./app/pages/ForgotPassword";
import { ResetPassword } from "./app/pages/ResetPassword";

export const router = createBrowserRouter([
  {
    Component: () => (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    ),
    children: [
      { path: "/", Component: Landing },
      { path: "/demo", Component: Demo },
      {
        path: "/app",
        Component: Root,
        children: [
          { index: true, Component: Dashboard },
          { path: "settings", Component: UserSettings },
          { path: "profile", Component: Profile },
          { path: "board/new", Component: NewBoard },
          { path: "board/:id", Component: BoardDetail },
          { path: "board/:id/settings", Component: BoardSettings },
          { path: "board/:id/concepts", Component: AllConcepts },
          { path: "board/:id/tags", Component: AllTags },
          { path: "board/:id/sessions", Component: Sessions },
          { path: "board/:id/sessions/play", Component: SessionPlay },
          { path: "board/:id/sessions/:sessionId", Component: SessionDetail },
          { path: "board/:id/logs", Component: Logs },
          { path: "board/:id/concept/:conceptId", Component: ConceptDetail },
        ],
      },
      { path: "/login", Component: Login },
      { path: "/signup", Component: Signup },
      { path: "/verify", Component: Verify },
      { path: "/forgot-password", Component: ForgotPassword },
      { path: "/reset-password", Component: ResetPassword },
    ],
  },
]);
