import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Strip channel_binding param — node-postgres does not support it.
  const cleaned = connectionString.replace(/[?&]channel_binding=[^&]*/g, "");

  const isLocal = /@(localhost|127\.0\.0\.1)/.test(cleaned);

  // Supabase's pooler presents a cert chain Node doesn't recognize as
  // trusted by default ("self-signed certificate in certificate chain").
  // The connection is still encrypted; we just skip CA-validation.
  const pool = new Pool({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    keepAlive: true,
    max: 5,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  });

  pool.on("error", (err) => {
    console.error("[pg pool] error", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
