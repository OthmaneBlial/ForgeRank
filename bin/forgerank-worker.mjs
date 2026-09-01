#!/usr/bin/env node

import { runForgeRank } from "./runtime.mjs";

await runForgeRank("dist/worker/index.js");
