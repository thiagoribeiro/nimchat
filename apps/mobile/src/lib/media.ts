import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getNimletClient, getTokenStorage } from "./nimlet";

// Non-image attachments have no inline preview (mirrors apps/web's file-download link) —
// download the authenticated bytes to a temp file, then hand them to the OS share sheet so
// the user can save/open with another app.
export async function downloadAndShareAttachment(contentUri: string, filename: string) {
  const token = await getTokenStorage().getToken();
  const url = getNimletClient().getMediaUrl(contentUri);
  const localUri = FileSystem.cacheDirectory + filename;

  const { uri } = await FileSystem.downloadAsync(url, localUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
}
