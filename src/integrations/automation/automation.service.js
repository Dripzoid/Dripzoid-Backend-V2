// integrations/automation/automation.service.js

export async function triggerAutomationEvent(
  eventType,
  payload
) {
  return axios.post(
    `${process.env.AUTOMATION_URL}/api/events/trigger`,
    {
      eventType,
      payload,
    },
    {
      headers: {
        "x-internal-key":
          process.env.AUTOMATION_API_KEY,
      },
    }
  );
}
