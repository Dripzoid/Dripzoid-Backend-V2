import {
  getJobsService,
  getJobBySlugService,
  createJobService,
  updateJobService,
  deleteJobService,
} from "./jobs.service.js";

// 📦 GET ALL JOBS
export const getJobs = async (
  req,
  res
) => {
  try {
    const jobs =
      await getJobsService();

    res.json(jobs);
  } catch (err) {
    console.error(
      "getJobs error:",
      err
    );

    res.status(500).json({
      message:
        err.message ||
        "Failed to fetch jobs",
    });
  }
};

// 📦 GET SINGLE JOB
export const getJobBySlug =
  async (req, res) => {
    try {
      const job =
        await getJobBySlugService(
          req.params.slug
        );

      res.json(job);
    } catch (err) {
      console.error(
        "getJobBySlug error:",
        err
      );

      res.status(404).json({
        message:
          err.message ||
          "Job not found",
      });
    }
  };

// ➕ CREATE JOB
export const createJob =
  async (req, res) => {
    try {
      const result =
        await createJobService(
          req.body
        );

      res.status(201).json(result);
    } catch (err) {
      console.error(
        "createJob error:",
        err
      );

      res.status(400).json({
        message:
          err.message ||
          "Failed to create job",
      });
    }
  };

// ✏️ UPDATE JOB
export const updateJob =
  async (req, res) => {
    try {
      await updateJobService(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        message:
          "Job updated successfully",
      });
    } catch (err) {
      console.error(
        "updateJob error:",
        err
      );

      res.status(400).json({
        message:
          err.message ||
          "Failed to update job",
      });
    }
  };

// ❌ DELETE JOB
export const deleteJob =
  async (req, res) => {
    try {
      await deleteJobService(
        req.params.id
      );

      res.json({
        success: true,
        message:
          "Job deleted successfully",
      });
    } catch (err) {
      console.error(
        "deleteJob error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to delete job",
      });
    }
  };