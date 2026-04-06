// frontend/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";

// Google Font
const link  = document.createElement("link");
link.rel    = "stylesheet";
link.href   = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap";
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
