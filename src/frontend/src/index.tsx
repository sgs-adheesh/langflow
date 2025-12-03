import ReactDOM from "react-dom/client";
import { BRAND_NAME } from "@/constants/branding";
import reportWebVitals from "./reportWebVitals";

import "./style/classes.css";
// @ts-ignore
import "./style/index.css";
// @ts-ignore
import "./App.css";
import "./style/applies.css";

// @ts-ignore
import App from "./customization/custom-App";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

document.title = BRAND_NAME;

root.render(<App />);
reportWebVitals();
