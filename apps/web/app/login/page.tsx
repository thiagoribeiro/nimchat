"use client";

import { t } from "@nimchat/i18n";
import { useAuthStore } from "@nimchat/sdk";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getNimletClient } from "@/lib/nimlet";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const client = getNimletClient();
      if (mode === "login") {
        await login(client, { username, password, device_name: "web" });
      } else {
        await register(client, {
          username,
          password,
          display_name: displayName || username,
          device_name: "web",
        });
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-white dark:bg-[#313338]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 p-8 rounded-md border border-zinc-200 dark:border-zinc-800"
      >
        <h1 className="text-xl font-bold text-center">
          {mode === "login" ? t("Log in to NimChat") : t("Create an account")}
        </h1>

        <input
          className="w-full p-2 rounded-md bg-zinc-100 dark:bg-zinc-700/50 text-sm outline-none"
          placeholder={t("Username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        {mode === "register" && (
          <input
            className="w-full p-2 rounded-md bg-zinc-100 dark:bg-zinc-700/50 text-sm outline-none"
            placeholder={t("Display name")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          className="w-full p-2 rounded-md bg-zinc-100 dark:bg-zinc-700/50 text-sm outline-none"
          placeholder={t("Password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full p-2 rounded-md bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {mode === "login" ? t("Log in") : t("Register")}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="w-full text-xs text-zinc-500 dark:text-zinc-400 hover:underline"
        >
          {mode === "login"
            ? t("Need an account? Register")
            : t("Already have an account? Log in")}
        </button>
      </form>
    </div>
  );
}
