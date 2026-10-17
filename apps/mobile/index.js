import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import {
  BACKGROUND_NOTIFICATION_TASK,
  handleBackgroundNotificationTaskPayload,
} from "./src/lib/push-notifications";

// Must be defined and registered here, at module scope of the app's entry file — see
// expo-notifications' registerTaskAsync docs. This is what lets a data-only push
// build and show a notification even when the app is backgrounded or fully killed.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ("actionIdentifier" in data) {
    // A notification tap while backgrounded/terminated — there's no live app state
    // to navigate here; setupNotificationTapListener (src/lib/push-notifications.ts)
    // handles deep-linking once the app actually opens.
    return;
  }
  await handleBackgroundNotificationTaskPayload(data.data ?? {});
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {
  // Can legitimately fail before the user has granted notification permission —
  // registerForPushNotificationsAsync (called after login) is what actually matters
  // for whether push ends up working; this is just best-effort at cold start.
});

// A plain require(), not a static import: static `import` declarations are hoisted
// above this file's own statements by the ES module transform, which would boot the
// app (and any headless invocation) before the task registration above ever runs.
// require() executes exactly where it's written, so the ordering here is real.
require("expo-router/entry");
