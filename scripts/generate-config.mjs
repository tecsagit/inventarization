import { writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

const config = {
  supabaseUrl: url,
  supabaseAnonKey: key,
};

writeFileSync("config.js", `window.INVENTORY_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
console.log(`config.js generated (supabaseUrl: ${url ? "set" : "empty"})`);
