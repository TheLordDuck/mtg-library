import { cpSync } from "fs";

// Copy public/ into standalone so collection.csv is accessible
cpSync("public", ".next/standalone/public", { recursive: true });

// Copy static assets
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });