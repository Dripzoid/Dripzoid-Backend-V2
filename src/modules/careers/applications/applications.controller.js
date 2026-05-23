import {
  getApplicationsService,
  getApplicationByIdService,
  createApplicationService,
  updateApplicationStatusService,
  deleteApplicationService,
} from "./applications.service.js";

// 📦 GET ALL APPLICATIONS
export const getApplications =
  async (req, res) => {
    try {
      const data =
        await getApplicationsService();

      res.json(data);
    } catch (err) {
      console.error(
        "getApplications error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to fetch applications",
      });
    }
  };

// 📦 GET SINGLE APPLICATION
export const getApplicationById =
  async (req, res) => {
    try {
      const data =
        await getApplicationByIdService(
          req.params.id
        );

      res.json(data);
    } catch (err) {
      console.error(
        "getApplicationById error:",
        err
      );

      res.status(404).json({
        message:
          err.message ||
          "Application not found",
      });
    }
  };

// ➕ CREATE APPLICATION
export const createApplication =
  async (req, res) => {
    try {
      const {
        jobId,
        name,
        email,
        phone,
        portfolio,
        cover,
      } = req.body;

      const resume_url =
        req.file
          ? `/uploads/${req.file.filename}`
          : null;

      const data =
        await createApplicationService({
          jobId,
          name,
          email,
          phone,
          portfolio,
          cover,
          resume_url,
        });

      res.status(201).json(data);
    } catch (err) {
      console.error(
        "createApplication error:",
        err
      );

      res.status(400).json({
        message:
          err.message ||
          "Failed to submit application",
      });
    }
  };

// ✏️ UPDATE APPLICATION STATUS
export const updateApplicationStatus =
  async (req, res) => {
    try {
      const { status } =
        req.body;

      if (!status) {
        return res.status(400).json({
          message:
            "Status is required",
        });
      }

      await updateApplicationStatusService(
        req.params.id,
        status
      );

      res.json({
        success: true,
        message:
          "Application updated successfully",
      });
    } catch (err) {
      console.error(
        "updateApplicationStatus error:",
        err
      );

      res.status(400).json({
        message:
          err.message ||
          "Failed to update application",
      });
    }
  };

// ❌ DELETE APPLICATION
export const deleteApplication =
  async (req, res) => {
    try {
      await deleteApplicationService(
        req.params.id
      );

      res.json({
        success: true,
        message:
          "Application deleted successfully",
      });
    } catch (err) {
      console.error(
        "deleteApplication error:",
        err
      );

      res.status(500).json({
        message:
          err.message ||
          "Failed to delete application",
      });
    }
  };