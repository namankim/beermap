import { z } from "zod";

export const beerSpotSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  beerType: z.string().trim().max(240).default(""),
  rating: z
    .number()
    .min(0.5)
    .max(5)
    .refine((value) => Number.isInteger(value * 2), {
      message: "Rating must be in 0.5 steps."
    }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
