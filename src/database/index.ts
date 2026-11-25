import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const globalDatabase = globalThis as typeof globalThis & { questionBankPool?: ReturnType<typeof postgres> };
const url = process.env.DATABASE_URL;
export const pool = globalDatabase.questionBankPool ?? postgres(url ?? "postgresql://127.0.0.1:55432/question_bank", { max: 8 });
if (process.env.NODE_ENV !== "production") globalDatabase.questionBankPool = pool;
export const db = drizzle(pool);
