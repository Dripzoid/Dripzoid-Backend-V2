import fs from "fs/promises";
import path from "path";

import prisma from "../src/lib/prisma.js";

import {
  generateEmbedding,
} from "../src/modules/semantic-search/embedding.service.js";

/**
 * Extract facts from KB file
 */
function extractFacts(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
}

/**
 * Seed a single KB file
 */
async function seedKB(route, filePath) {
  console.log(`\n📚 Processing ${route}`);

  const content = await fs.readFile(
    filePath,
    "utf8"
  );

  const facts = extractFacts(content);

  console.log(
    `Found ${facts.length} facts`
  );

  let inserted = 0;
  let skipped = 0;

  for (const fact of facts) {
    try {
      const existing =
        await prisma.$queryRawUnsafe(
          `
          SELECT id
          FROM kb_vectors
          WHERE route = $1
          AND fact_text = $2
          LIMIT 1
          `,
          route,
          fact
        );

      if (existing.length) {
        skipped++;
        continue;
      }

      const embedding =
        await generateEmbedding(
          fact
        );

      const vector =
        `[${embedding.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO kb_vectors (
          route,
          fact_text,
          embedding
        )
        VALUES (
          $1,
          $2,
          $3::vector
        )
        `,
        route,
        fact,
        vector
      );

      inserted++;

      console.log(
        `✅ ${inserted}/${facts.length}`
      );

    } catch (error) {
      console.error(
        `❌ Failed: ${fact}`
      );

      console.error(error);
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
 * Main
 */
async function main() {
  console.log(
    "\n🚀 KB Vector Seeding Started\n"
  );

  const kbDirectory =
    path.resolve(
      "../src/knowledge-base"
    );

  const files =
    await fs.readdir(
      kbDirectory
    );

  const txtFiles =
    files.filter(
      (file) =>
        file.endsWith(".txt")
    );

  if (!txtFiles.length) {
    throw new Error(
      "No KB files found"
    );
  }

  for (const file of txtFiles) {
    const route =
      "/" +
      file.replace(
        ".txt",
        ""
      );

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

  const count =
    await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM kb_vectors
    `);

  console.log(`
🎉 KB Seeding Complete

Total KB Vectors:
${count[0].total}
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
