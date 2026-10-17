import { msg } from "@nimchat/i18n";

// Messages that agent-blocks plugins publish in English (form errors, sharing
// errors, rejection reasons, reference titles). Clients pass them through t();
// listing them here keeps them in the translation catalogs.
export const SERVER_MESSAGES = [
  msg("Required"),
  msg("Invalid value"),
  msg("Open shared surface"),
  msg("Could not share. Check the participants and try again."),
  msg("Sharing unavailable"),
  msg("Creation not authorized or invalid data"),
  msg("Choose who to share with. No invitation was sent."),
  msg("Review the participants before sharing."),
] as const;
