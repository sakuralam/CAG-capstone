// Sets up MSW in the browser. main.jsx starts it when VITE_USE_MOCKS=true.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);