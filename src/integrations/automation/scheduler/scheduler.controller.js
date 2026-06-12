import * as schedulerService
  from "./scheduler.service.js";

export async function getPendingAutomationEvents(
  req,
  res,
  next
) {
  try {
    const events =
      await schedulerService
        .getPendingAutomationEvents();

    res.status(200).json({
      success: true,
      events,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAutomationEvent(
  req,
  res,
  next
) {
  try {
    const event =
      await schedulerService
        .updateAutomationEvent(
          req.params.id,
          req.body
        );

    res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    next(error);
  }
}
