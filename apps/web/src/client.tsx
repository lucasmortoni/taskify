/**
 * Browser hydration entrypoint for `@taskify/web`.
 */

import React from "react";
import { hydrateRoot } from "react-dom/client";
import { RootShell, type TaskifyInitialState } from "../app/routes/__root.tsx";

const bootstrapEl = document.getElementById("__TASKIFY_INITIAL_DATA__");
if (bootstrapEl?.textContent) {
  const initialState = JSON.parse(bootstrapEl.textContent) as TaskifyInitialState;
  const rootEl = document.getElementById("root");
  if (rootEl) {
    hydrateRoot(rootEl, <RootShell initialState={initialState} />);
  }
}
