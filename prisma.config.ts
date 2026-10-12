import "dotenv/config";
import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      // Session-mode pooler; the transaction pooler can't run migrations.
      connection: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
    },
  }),
});
