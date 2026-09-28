import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.mts does not set `test.globals`, so Testing Library's own
// automatic afterEach-cleanup detection (which looks for a global `afterEach`)
// never fires. Without this, every component test in a file after the first
// would find its predecessors' DOM output still mounted.
afterEach(() => {
  cleanup();
});
