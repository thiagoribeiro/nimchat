import { t } from "@nimchat/i18n";
import React from "react";
import { Hash } from "lucide-react";

interface ChatWelcomeProps {
  name: string;
}

export function ChatWelcome({ name }: ChatWelcomeProps) {
  const displayName = name === "direct" ? t("this conversation") : name;
  return (
    <div className="space-y-2 px-4 mb-4">
      <div className="h-[75px] w-[75px] rounded-full bg-zinc-500 dark:bg-zinc-700 flex items-center justify-center">
        <Hash className="h-12 w-12 text-white" />
      </div>
      <p className="text-xl md:text-3xl font-bold">{t("Welcome to {name}", { name: displayName })}</p>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm">
        {t("This is the first message of {name}.", { name: displayName })}
      </p>
    </div>
  );
}
