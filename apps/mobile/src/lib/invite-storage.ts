import { File, Paths } from "expo-file-system";
import type { InviteStorage } from "@nimchat/sdk/invite-dismissals";

export const inviteStorage: InviteStorage = {
  getItem(key) {
    const file = new File(Paths.document, encodeURIComponent(key) + ".json");
    return file.exists ? file.textSync() : null;
  },
  setItem(key, value) {
    const file = new File(Paths.document, encodeURIComponent(key) + ".json");
    if (!file.exists) file.create();
    file.write(value);
  },
};
