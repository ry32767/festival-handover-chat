import "./styles/tokens.css";
import "./styles/app.css";
import { mountApp } from "./app.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root was not found");
mountApp(root);
