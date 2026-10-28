import { z } from "zod";
import { bech32m } from "bech32";

export const PrepareSchema = z.object({
  address: z.string().refine((val) => {
    try {
      const decoded = bech32m.decode(val);
      return decoded.prefix === "xch" || decoded.prefix === "txch";
    } catch { 
      return false; 
    }
  }, { message: "Invalid Chia address format" }),
  publicKeyHex: z.string().min(1, "publicKeyHex is required"),
  // Принимаем строго строку или число (внутри должны быть mojo, без точек)
  amount: z.string().or(z.number()), 
  minFee: z.string().or(z.number()).optional(),
});

export type PrepareInput = z.infer<typeof PrepareSchema>;
