import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "../src/lib/prisma.js";

import {
  generateEmbedding,
} from "../src/modules/semantic-search/embedding.service.js";

/**
 * PATH SETUP
 */

const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );

const kbDirectory =
  path.join(
    __dirname,
    "../src/knowledge-base"
  );

/**
 * ROUTE MAPPING
 */

const ROUTE_MAP = {
  "color_rag.txt":
    "/color",

  "chat_rag.txt":
    "/chat",

  "outfit_rag.txt":
    "/outfit",

  "recommendation_rag.txt":
    "/recommendation",
};

/**
 * FACT EXTRACTION
 */

function extractFacts(
  content
) {
  return content
    .split("\n")
    .map((line) =>
      line.trim()
    )
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith("#")
    )
    .filter(
      (line) =>
        !line.startsWith("=")
    )
    .filter(
      (line) =>
        line.length > 10
    );
}

/**
 * SEED SINGLE KB
 */

async function seedKB(
  route,
  filePath
) {
  console.log(
    "\nProcessing " +
    route
  );

  const content =
    await fs.readFile(
      filePath,
      "utf8"
    );

  const facts =
    extractFacts(
      content
    );

  console.log(
    "Found " +
    facts.length +
    " facts"
  );

  let inserted = 0;
  let skipped = 0;

  for (const fact of facts) {
    try {
      const existing = await prisma.kBVector.findUnique({
        where: {
          route_factText: {
            route,
            factText: fact,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const embedding =
        await generateEmbedding(
          fact
        );

      await prisma.kBVector.create({
        data: {
          route,
          factText: fact,
          embedding,
        },
      });

      inserted++;

      if (
        inserted %
          20 ===
        0
      ) {
        console.log(
          "Inserted " +
          inserted +
          " facts"
        );
      }
    } catch (error) {
      console.error(
        "Failed fact:",
        error.message
      );
    }
  }

  console.log(
    "Inserted: " +
    inserted
  );

  console.log(
    "Skipped: " +
    skipped
  );
}

/**
 * MAIN ENTRY
 */

async function main() {
  for (const [
    fileName,
    route,
  ] of Object.entries(
    ROUTE_MAP
  )) {
    const filePath =
      path.join(
        kbDirectory,
        fileName
      );

    await seedKB(
      route,
      filePath
    );
  }

  const total = await prisma.kBVector.count();

  console.log(
    "\nKB Seeding Complete\n"
  );

  console.log(
    "Total KB Vectors: " +
    total
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error
      );

      process.exit(
        1
      );
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );
