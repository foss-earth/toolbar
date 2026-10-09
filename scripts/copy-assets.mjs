import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync(new URL("../dist/styles/", import.meta.url), { recursive: true });
copyFileSync(new URL("../src/styles/toolbar.css", import.meta.url), new URL("../dist/styles/toolbar.css", import.meta.url));
