#!/usr/bin/env node
import { migrate } from "./migrations.js";

const command = process.argv[2];

switch (command) {
  case "migrate":
    (async () => {
      await migrate();
    })();
    break;
  default:
    console.log("Usage: pixel_memory migrate");
    console.log("  Runs all pending database migrations");
    process.exit(1);
}
