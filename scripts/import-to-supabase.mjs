import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const source = process.argv[2] || "inventory-import.json";

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY");
  process.exit(1);
}

const raw = readFileSync(source, "utf8");
const data = JSON.parse(raw);
const employees = data.employees || [];
const items = (data.items || []).map((item) => ({
  id: item.id,
  name: item.name || "",
  model: item.model || "",
  inv_number: item.invNumber || "",
  working: !!item.working,
  site: item.site || "Ігорівська",
  employee_id: item.employeeId || "",
  specs: item.specs || "",
  note: item.note || "",
  action: item.action || "",
  problems: item.problems || "",
  created_at: item.createdAt || new Date().toISOString(),
  updated_at: item.updatedAt || new Date().toISOString(),
}));

const supabase = createClient(url, key);

console.log(`Importing ${employees.length} employees and ${items.length} items from ${source}...`);

const { error: employeesError } = await supabase.from("employees").upsert(
  employees.map((employee) => ({ id: employee.id, name: employee.name }))
);
if (employeesError) throw employeesError;

const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const { error } = await supabase.from("items").upsert(batch);
  if (error) throw error;
  console.log(`  items ${Math.min(i + batchSize, items.length)}/${items.length}`);
}

const employeeIds = employees.map((employee) => employee.id);
const itemIds = items.map((item) => item.id);

const { data: dbEmployees, error: dbEmployeesError } = await supabase.from("employees").select("id");
if (dbEmployeesError) throw dbEmployeesError;
const orphanEmployeeIds = (dbEmployees || [])
  .map((row) => row.id)
  .filter((id) => !employeeIds.includes(id));
if (orphanEmployeeIds.length) {
  const { error } = await supabase.from("employees").delete().in("id", orphanEmployeeIds);
  if (error) throw error;
}

const { data: dbItems, error: dbItemsError } = await supabase.from("items").select("id");
if (dbItemsError) throw dbItemsError;
const orphanItemIds = (dbItems || [])
  .map((row) => row.id)
  .filter((id) => !itemIds.includes(id));
if (orphanItemIds.length) {
  for (let i = 0; i < orphanItemIds.length; i += batchSize) {
    const batch = orphanItemIds.slice(i, i + batchSize);
    const { error } = await supabase.from("items").delete().in("id", batch);
    if (error) throw error;
  }
}

console.log("Import complete.");
console.log(`Removed ${orphanEmployeeIds.length} extra employees, ${orphanItemIds.length} extra items.`);
