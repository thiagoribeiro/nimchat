import { enUS, ptBR } from "date-fns/locale";
import { locale } from "@nimchat/i18n";

// date-fns locale matching the active UI locale.
export function dateLocale() {
  return locale() === "pt-BR" ? ptBR : enUS;
}
