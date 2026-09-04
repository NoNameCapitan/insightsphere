import { writeFileSync, readFileSync } from "node:fs";
// crude parse of generated places to grab store/pharmacy ids
const src = readFileSync("src/lib/data/places.ts", "utf8");
const marker = "export const PLACES: Place[] = ";
const start = src.indexOf(marker) + marker.length;
const json = src.slice(start, src.lastIndexOf("]") + 1);
const places = JSON.parse(json);
const stores = places.filter((p) => p.category === "pet_store" || p.category === "vet_pharmacy").map((p) => p.id);

let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const PRODUCTS = [
  ["Royal-style Cat Adult", "cat_food", "cat", "AlphaPet"],
  ["Kitten Care Formula", "cat_food", "cat", "AlphaPet"],
  ["Dog Active Maxi", "dog_food", "dog", "BravoVet"],
  ["Puppy Growth Mix", "dog_food", "dog", "BravoVet"],
  ["Bird Daily Seeds", "bird_food", "bird", "WingNutri"],
  ["Clumping Litter 10L", "litter", "cat", "CleanPaw"],
  ["Silica Litter 5L", "litter", "cat", "CleanPaw"],
  ["Travel Carrier M", "carriers", "other", "GoPet"],
  ["Reflective Collar", "collars", "dog", "SafeWalk"],
  ["Cat Collar Bell", "collars", "cat", "SafeWalk"],
  ["Detangling Shampoo", "grooming_products", "dog", "FurCare"],
  ["Slicker Brush", "grooming_products", "other", "FurCare"],
  ["Vet Diet Renal (placeholder)", "vet_diet", "cat", "ClinNutri"],
  ["Vet Diet Gastro (placeholder)", "vet_diet", "dog", "ClinNutri"],
  ["OTC Vitamin Complex (placeholder)", "pharmacy_otc", "other", "VetPharma"],
  ["OTC Anti-tick Drops (placeholder)", "pharmacy_otc", "dog", "VetPharma"],
  ["Chew Toy Rope", "accessories", "dog", "PlayPet"],
  ["Scratching Post", "accessories", "cat", "PlayPet"],
  ["Rodent Bedding", "other_product", "rodent", "SmallPet"],
  ["Reptile Heat Mat", "accessories", "reptile", "ExoTerra-style"],
];

const products = PRODUCTS.map((p, i) => ({
  id: `prod-${i + 1}`,
  sku: `SKU-${1000 + i}`,
  barcode: `48230${String(10000 + i)}`,
  title: p[0],
  brand: p[3],
  category: p[1],
  animalType: p[2],
  description: `${p[0]} — синтетичний товар для демонстрації каталогу.`,
}));

const AVAIL = ["in_stock", "in_stock", "low_stock", "out_of_stock", "unknown"];
const inventory = [];
let invId = 0;
for (const prod of products) {
  // each product stocked in 2-4 random stores
  const n = 2 + Math.floor(rnd() * 3);
  const chosen = [...stores].sort(() => rnd() - 0.5).slice(0, n);
  for (const placeId of chosen) {
    invId++;
    const daysAgo = Math.floor(rnd() * 30);
    inventory.push({
      id: `inv-${invId}`,
      productId: prod.id,
      placeId,
      price: +(80 + rnd() * 900).toFixed(0),
      currency: "UAH",
      stockQty: Math.floor(rnd() * 40),
      availability: pick(AVAIL),
      updatedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      dataSource: "mock",
    });
  }
}

const out = `// AUTO-GENERATED synthetic product + inventory data (Module 6).
import type { InventoryItem, Product } from "@/lib/types";

export const PRODUCTS: Product[] = ${JSON.stringify(products, null, 2)};

export const INVENTORY: InventoryItem[] = ${JSON.stringify(inventory, null, 2)};
`;
writeFileSync("src/lib/data/products.ts", out);
console.log("products", products.length, "inventory", inventory.length, "across", stores.length, "stores");
