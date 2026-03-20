import { readFileSync, writeFileSync, existsSync } from "fs";
import { CACHE_FILE, ERRORS_FILE } from "./config.js";

export function loadCache() {
  if (!existsSync(CACHE_FILE)) return [];
  return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
}

export function saveCache(entries) {
  writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2));
}

export function loadErrors() {
  if (!existsSync(ERRORS_FILE)) return [];
  return JSON.parse(readFileSync(ERRORS_FILE, "utf-8"));
}

export function saveErrors(entries) {
  writeFileSync(ERRORS_FILE, JSON.stringify(entries, null, 2));
}
