import { t } from "@nimchat/i18n";
import {
  emailBatchLabel,
  emailFailure,
  emailItemDetail,
  emailPriorityLabel,
  emailTabs,
} from "@nimchat/brian";
import type { Block } from "@nimchat/brian";
import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space, touch } from "@/theme/tokens";
import { type } from "@/theme/typography";
import { Button } from "./button";
import { styles as shared } from "./styles";
import type { PluginViewProps } from "./types";

type Tab = "important" | "recent" | "cleanup";

// R2-D2's mailbox surface. Sender, subject and dates only — never a body — and
// no way to hand it to an agent. Every tap is a plugin command the producer
// carries out and reports back.
export function EmailTriageView({
  view,
  owner,
  disabled,
  send,
  commands,
}: PluginViewProps & { commands: readonly Block[] }) {
  const [tab, setTab] = useState<Tab>("important");
  const [open, setOpen] = useState<string | null>(null);
  const tabs = useMemo(() => emailTabs(view, commands as any), [view, commands]);
  const can = owner && !disabled;
  const act = (command: string, payload: Block) => {
    if (can) void send(command, payload);
  };
  const item = (it: Block, actions: React.ReactNode) => (
    <View key={it.id} style={s.row}>
      <Text style={shared.body}>
        {it.priority === "act" ? "⚠ " : ""}
        <Text style={s.strong}>{it.from}</Text> — {it.subject}
      </Text>
      {!!(emailItemDetail(it) || it.priority) && (
        <Text style={s.muted}>
          {[it.priority && emailPriorityLabel(it.priority), emailItemDetail(it)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
      <View style={shared.actions}>
        {!!it.gmail_url && (
          <Button
            label={t("Open in Gmail")}
            action={() => void Linking.openURL(it.gmail_url)}
          />
        )}
        {actions}
      </View>
    </View>
  );
  const group = (g: Block, kind: "review" | "wrong") => (
    <View key={g.id} style={s.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open === g.id }}
        onPress={() => setOpen(open === g.id ? null : g.id)}
        style={{ minHeight: touch, justifyContent: "center" }}
      >
        <Text style={shared.body}>
          <Text style={s.strong}>{g.name}</Text>
          {g.domain ? ` · ${g.domain}` : ""} · {t("{count} emails", { count: g.count })}
        </Text>
        {!!g.why && <Text style={s.muted}>{g.why}</Text>}
      </Pressable>
      {open === g.id &&
        (g.samples ?? []).map((x: Block, i: number) => (
          <Text key={i} style={s.muted}>
            {x.date} · {x.from} — {x.subject}
          </Text>
        ))}
      <View style={shared.actions}>
        <Button label={t("It's mine")} disabled={!can} action={() => act("group_mine", { group_id: g.id })} />
        {kind === "review" && (
          <>
            <Button label={t("Not mine")} disabled={!can} action={() => act("group_not_mine", { group_id: g.id })} />
            <Button label={t("Not sure")} disabled={!can} action={() => act("group_unsure", { group_id: g.id })} />
          </>
        )}
      </View>
    </View>
  );
  const tabButton = (id: Tab, label: string) => (
    <Pressable
      key={id}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab === id }}
      onPress={() => setTab(id)}
      style={[s.tab, tab === id && s.tabOn]}
    >
      <Text style={[shared.body, tab === id && { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: space.md }}>
      <View accessibilityRole="tablist" style={shared.actions}>
        {tabButton("important", t("Important ({count})", { count: tabs.important.length }))}
        {tabButton("recent", t("Recent"))}
        {tabButton("cleanup", t("Cleanup"))}
      </View>
      {!!tabs.notice && <Text style={[shared.body, { color: colors.warning }]}>{tabs.notice}</Text>}
      {tabs.failures.map((f) => (
        <Text key={f.target} accessibilityRole="alert" style={shared.error}>
          {emailFailure(f.error)}
        </Text>
      ))}
      {tabs.pending > 0 && (
        <Text style={s.muted}>
          {t("Applying {count} decision(s) to the mailbox…", { count: tabs.pending })}
        </Text>
      )}
      {tab === "important" &&
        (tabs.important.length ? (
          tabs.important.map((it) =>
            item(
              it,
              <>
                <Button
                  label={it.priority === "act" ? t("I paid") : t("Seen")}
                  disabled={!can}
                  action={() => act("mark_done", { item_id: it.id })}
                />
                <Button
                  label={t("Wasn't important")}
                  disabled={!can}
                  action={() => act("not_important", { item_id: it.id })}
                />
              </>,
            ),
          )
        ) : (
          <Text style={s.muted}>{t("No important email open.")}</Text>
        ))}
      {tab === "recent" &&
        (tabs.recent.length ? (
          <>
            <Text style={s.muted}>{t("Inbox mail from the last 48 h that did not alert you.")}</Text>
            {tabs.recent.map((it) =>
              item(
                it,
                <Button
                  label={t("Should have alerted")}
                  disabled={!can}
                  action={() => act("should_alert", { item_id: it.id })}
                />,
              ),
            )}
          </>
        ) : (
          <Text style={s.muted}>{t("Nothing recent without an alert.")}</Text>
        ))}
      {tab === "cleanup" && (
        <View style={{ gap: space.md }}>
          <Text style={shared.body}>
            {t("This week: {wrong} wrong-recipient and {bulk} bulk archived; {review} to review.", {
              wrong: tabs.week.archived_wrong ?? 0,
              bulk: tabs.week.archived_bulk ?? 0,
              review: tabs.week.review ?? 0,
            })}
          </Text>
          <Text style={s.heading}>{t("Review")}</Text>
          {tabs.review.length ? (
            tabs.review.map((g) => group(g, "review"))
          ) : (
            <Text style={s.muted}>{t("Nothing to review.")}</Text>
          )}
          <Text style={s.heading}>{t("Wrong recipient")}</Text>
          {tabs.wrong.map((g) => group(g, "wrong"))}
          <Text style={s.heading}>{t("Batches")}</Text>
          {tabs.batches.map((b) => (
            <View key={b.id} style={s.row}>
              <Text style={shared.body}>
                {emailBatchLabel(b.kind)} · {t("{count} emails", { count: b.count })}
              </Text>
              <Text style={s.muted}>{b.id}</Text>
              <View style={shared.actions}>
                <Button
                  label={t("Undo")}
                  variant="danger"
                  disabled={!can}
                  action={() =>
                    Alert.alert(
                      t("Undo"),
                      t("Undo this batch? Labels come off and archived mail returns to the Inbox."),
                      [
                        { text: t("Cancel"), style: "cancel" },
                        { text: t("Undo"), style: "destructive", onPress: () => act("undo_batch", { batch_id: b.id, confirmed: true }) },
                      ],
                    )
                  }
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  strong: { ...type.bodyStrong },
  muted: { ...type.caption, color: colors.textMuted },
  heading: { ...type.label, color: colors.textSecondary },
  tab: {
    minHeight: touch,
    paddingHorizontal: space.md,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  tabOn: { backgroundColor: colors.primary },
});
