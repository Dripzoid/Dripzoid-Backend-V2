import fs from "fs";

import path from "path";

import { exec } from "child_process";

import prisma from "../../lib/prisma.js";

/* =====================================================
   EXPORT DATABASE
===================================================== */

export const exportDatabase = async (
  req,
  res
) => {
  try {
    const databaseUrl =
      process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        message:
          "DATABASE_URL is missing",
      });
    }

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const backupFileName =
      `backup-${timestamp}.sql`;

    const backupDir =
      path.join(process.cwd(), "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, {
        recursive: true,
      });
    }

    const backupPath =
      path.join(
        backupDir,
        backupFileName
      );

    /* =========================
       PG DUMP
    ========================= */

    const command =
      `pg_dump "${databaseUrl}" > "${backupPath}"`;

    exec(
      command,
      async (error, stdout, stderr) => {
        if (error) {
          console.error(
            "pg_dump error:",
            error
          );

          return res
            .status(500)
            .json({
              message:
                "Database export failed",
              error:
                stderr ||
                error.message,
            });
        }

        /* =========================
           SEND FILE
        ========================= */

        res.download(
          backupPath,
          backupFileName,
          (downloadError) => {
            if (downloadError) {
              console.error(
                "Download error:",
                downloadError
              );
            }

            /* =========================
               CLEANUP
            ========================= */

            fs.unlink(
              backupPath,
              (unlinkError) => {
                if (unlinkError) {
                  console.error(
                    "Cleanup error:",
                    unlinkError
                  );
                }
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Failed to export database",
    });
  }
};

/* =====================================================
   IMPORT DATABASE
===================================================== */

export const importDatabase = async (
  req,
  res
) => {
  try {
    /* =========================
       TOKEN VALIDATION
    ========================= */

    const uploadToken =
      req.headers["x-upload-token"];

    if (
      uploadToken !==
      process.env.UPLOAD_SECRET
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    /* =========================
       FILE VALIDATION
    ========================= */

    if (!req.file) {
      return res.status(400).json({
        message:
          "SQL backup file required",
      });
    }

    const filePath =
      req.file.path;

    const databaseUrl =
      process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        message:
          "DATABASE_URL missing",
      });
    }

    /* =========================
       DISCONNECT PRISMA
    ========================= */

    await prisma.$disconnect();

    /* =========================
       RESTORE DATABASE
    ========================= */

    const command =
      `psql "${databaseUrl}" < "${filePath}"`;

    exec(
      command,
      async (error, stdout, stderr) => {
        /* =========================
           DELETE TEMP FILE
        ========================= */

        fs.unlink(
          filePath,
          (unlinkError) => {
            if (unlinkError) {
              console.error(
                "File cleanup error:",
                unlinkError
              );
            }
          }
        );

        if (error) {
          console.error(
            "psql restore error:",
            error
          );

          return res
            .status(500)
            .json({
              message:
                "Database restore failed",
              error:
                stderr ||
                error.message,
            });
        }

        /* =========================
           RECONNECT PRISMA
        ========================= */

        try {
          await prisma.$connect();
        } catch (connectError) {
          console.error(
            "Prisma reconnect error:",
            connectError
          );
        }

        return res.json({
          message:
            "Database restored successfully",
        });
      }
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Failed to restore database",
    });
  }
};
