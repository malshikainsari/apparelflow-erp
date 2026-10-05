import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Demo@1234";

const users: { email: string; fullName: string; role: Role }[] = [
  { email: "supervisor@apparelflow.test", fullName: "Nimali Perera (Cutting Supervisor)", role: "cutting_supervisor" },
  { email: "verifier@apparelflow.test", fullName: "Kasun Silva (Cutting Verifier)", role: "cutting_verifier" },
  { email: "sewing@apparelflow.test", fullName: "Dilani Fernando (Sewing Supervisor)", role: "sewing_supervisor" },
];

const recipes = [
  {
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: 1.8,
    wastageCap: 5.0,
    components: [
      { componentName: "Front Body Panel", piecesPerGarment: 1 },
      { componentName: "Back Body Panel", piecesPerGarment: 1 },
      { componentName: "Sleeves (Left & Right)", piecesPerGarment: 2 },
      { componentName: "Collar & Stand", piecesPerGarment: 1 },
      { componentName: "Sleeve Cuffs", piecesPerGarment: 2 },
    ],
  },
  {
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: 1.1,
    wastageCap: 8.0,
    components: [
      { componentName: "Front Chest Panel", piecesPerGarment: 1 },
      { componentName: "Back Support Panel", piecesPerGarment: 1 },
      { componentName: "Neck Binding Strip", piecesPerGarment: 1 },
      { componentName: "Hem Elastic Casing", piecesPerGarment: 1 },
      { componentName: "Side Strap Accents", piecesPerGarment: 2 },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role },
      create: { ...u, passwordHash },
    });
  }

  for (const r of recipes) {
    const { components, ...data } = r;
    const recipe = await prisma.recipe.upsert({
      where: { recipeCode: r.recipeCode },
      update: data,
      create: data,
    });
    const existing = await prisma.recipeComponent.count({
      where: { recipeId: recipe.id },
    });
    if (existing === 0) {
      await prisma.recipeComponent.createMany({
        data: components.map((c) => ({ ...c, recipeId: recipe.id })),
      });
    }
  }

  console.log("Seed complete: 3 users, 2 recipes");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());