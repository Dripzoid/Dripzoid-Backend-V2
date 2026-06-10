import * as schedulerService
  from "./scheduler.service.js";

export async function getPendingScheduledTasks(
  req,
  res,
  next
) {
  try {
    const tasks =
      await schedulerService
        .getPendingScheduledTasks();

    res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateScheduledTask(
  req,
  res,
  next
) {
  try {
    const task =
      await schedulerService
        .updateScheduledTask(
          req.params.id,
          req.body
        );

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAutomationLog(
  req,
  res,
  next
) {
  try {
    const log =
      await schedulerService
        .createAutomationLog(
          req.body
        );

    res.status(201).json({
      success: true,
      log,
    });
  } catch (error) {
    next(error);
  }
}
