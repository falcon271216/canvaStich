import type { PrismaClient } from "@prisma/client";

let prismaClient: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaClient) {
    prismaClient = require("@repo/db/client").prismaClient as PrismaClient;
  }
  return prismaClient;
}
