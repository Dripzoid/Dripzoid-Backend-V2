```js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import prisma from "../src/lib/prisma.js";

import {
  generateEmbedding,
} from "../src/modules/semantic-search/embedding.service.js";

/**
 * ======================================================
 * PATH SETUP
 * ======================================================
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
 * ======================================================
 * ROUTE MAPPING
 * ======================================================
 */

const ROUTE_MAP = {
  "color_rag.txt":
    "/color",

  "fashion_knowledge.txt":
    "/fashion",

  "outfit_rag.txt":
    "/outfit",

  "recommendation_rag.txt":
    "/recommendation",
};

/**
 * ======================================================
 * FACT EXTRACTION
 * ======================================================
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
    );
}

/**
 * ======================================================
 * SEED SINGLE KB
 * ======================================================
 */

async function seedKB(
  route,
  filePath
) {
  console.log(
  "\nProcessing " + route
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
    `Found ${facts.length} facts`
  );

  let inserted = 0;
  let skipped = 0;

  for (const fact of facts) {
    try {

      const existing =
        await prisma.kb_vectors.findFirst({
          where: {
            route,
            fact_text:
              fact,
          },
          select: {
            id: true,
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

      await prisma.kb_vectors.create({
        data: {
          route,
          fact_text:
            fact,
          embedding,
        },
      });

      inserted++;

      console.log(
       "Inserted " +
inserted +
"/" +
facts.length
      );

    } catch (error) {

      console.error(
        "Failed: " + fact
      );

      console.error(
        error
      );

    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━
Route   : ${route}
Inserted: ${inserted}
Skipped : ${skipped}
━━━━━━━━━━━━━━━━━━━━━━
`);
}

/**
 * ======================================================
 * MAIN
 * ======================================================
 */

async function main() {

  console.log(
    "\nKB Vector Seeding Started\n"
  );

  console.log(
    "Working Directory:",
    process.cwd()
  );

  console.log(
    "KB Directory:",
    kbDirectory
  );

  const exists =
    await fs
      .access(
        kbDirectory
      )
      .then(
        () => true
      )
      .catch(
        () => false
      );

  console.log(
    "KB Directory Exists:",
    exists
  );

  if (!exists) {
    throw new Error(
      `KB directory not found: ${kbDirectory}`
    );
  }

  const files =
    await fs.readdir(
      kbDirectory
    );

  const txtFiles =
    files.filter(
      (file) =>
        file.endsWith(
          ".txt"
        )
    );

  if (
    !txtFiles.length
  ) {
    throw new Error(
      "No KB files found"
    );
  }

  console.log(
    `Found ${txtFiles.length} KB files`
  );

  for (const file of txtFiles) {

    const route =
      ROUTE_MAP[
        file
      ];

    if (!route) {

      console.warn(
        "Skipping unmapped file: " + file
      );

      continue;
    }

    const filePath =
      path.join(
        kbDirectory,
        file
      );

    await seedKB(
      route,
      filePath
    );
  }

  const total =
    await prisma.kb_vectors.count();

  console.log(`
KB Seeding Complete

Total KB Vectors:
${total}
`);
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
```
