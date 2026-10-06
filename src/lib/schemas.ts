import { z } from "zod";

export const createOrderSchema = z.object({
  recipeId: z.number().int("Select a recipe").positive("Select a recipe"),
  targetQty: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than 0")
    .max(100000, "Quantity is too large"),
  fabricRollId: z
    .string()
    .trim()
    .min(1, "Fabric roll ID is required")
    .max(40, "Fabric roll ID is too long")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  actualFabricYds: z
    .number()
    .positive("Fabric used must be greater than 0")
    .max(1000000, "Value is too large")
    .refine((v) => Math.round(v * 100) / 100 === v, "Maximum 2 decimal places"),
});

export const saveCountsSchema = z.object({
  counts: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        actualQty: z
          .number()
          .int("Whole numbers only")
          .min(0, "Count cannot be negative")
          .max(10000000, "Count is too large"),
      })
    )
    .min(1)
    .max(50),
});

export const rejectSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(500, "Rejection reason is too long"),
});