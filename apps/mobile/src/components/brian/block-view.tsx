import { t, locale } from "@nimchat/i18n";
import type { ReactNode } from "react";
import { commandStorage } from "@/lib/plugin-commands";
import { MonthlyBills } from "./monthly-bills";
import { router } from "expo-router";
import { useChatStore } from "@nimchat/sdk";
import { pluginCommands, usePluginCommands } from "@/lib/plugin-commands";
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { v4 as uuid } from "uuid";
import {
  fallback,
  supported,
  overlayView,
  canEdit,
  referenceTarget,
  formValues,
  reconcileDraft,
  formInputValue,
} from "@nimchat/brian";
import type { Block, Trust } from "@nimchat/brian";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { Markdown } from "@/components/chat/markdown";
import { Button as UIButton } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/feedback";
import { toneColor } from "@/components/ui/status";
import { useBrianRead, usePendingCommand } from "@/lib/brian";
import type { PendingCommand } from "@/lib/brian";
import { getNimletClient } from "@/lib/nimlet";
import { colors, radius, space, touch } from "@/theme/tokens";
import { font, type } from "@/theme/typography";

import { AgentStatus } from "./agent-status";

function Button({
  label,
  action,
  disabled = false,
  variant,
}: {
  label: string;
  action: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <UIButton
      label={label}
      onPress={action}
      disabled={disabled}
      variant={variant}
    />
  );
}
// Renders one BRIAN block. For plugin blocks this is the full interactive
// surface, shown in the focus view; the timeline uses SurfaceReference.
interface BlockViewProps {
  block: Block;
  roomId: string;
  trust: Trust;
  interactive?: boolean;
  focus?: boolean;
  management?: ReactNode;
}
export function BlockView(props: BlockViewProps) {
  // Core blocks are static: render them without subscribing to room events.
  if (props.block.type !== "plugin" || !supported(props.block))
    return <CoreBlock block={props.block} />;
  return <PluginBlock {...props} />;
}
function CoreBlock({ block }: { block: Block }) {
  const rooms = useChatStore((s) => s.rooms);
  if (block.type === "reference") {
    const target = referenceTarget(block);
    return (
      <View>
        <Text style={styles.body}>{t(block.title)}</Text>
        {target && rooms[target.roomId]?.state === "join" ? (
          <Button
            label={t("Open surface")}
            action={() =>
              router.push(
                `/rooms/${target.roomId}/surfaces/${target.plugin}/${target.instanceId}` as any,
              )
            }
          />
        ) : (
          <Text style={styles.body}>
            {t("Join the shared surface to open it.")}
          </Text>
        )}
      </View>
    );
  }

  if (!supported(block)) return <Markdown text={fallback(block)} />;
  if (block.type === "markdown") return <Markdown text={String(block.text)} />;
  if (block.type === "divider") return <View style={styles.divider} />;
  if (block.type === "key_value")
    return (
      <View>
        {block.items.map((item: Block, index: number) => (
          <Text key={index} style={styles.body}>
            {item.key}: {String(item.value ?? "—")}
          </Text>
        ))}
      </View>
    );
  if (block.type === "actions")
    return <Text style={styles.body}>{t("Actions are not available in this version.")}</Text>;
  if (["reference", "file", "image", "audio"].includes(block.type)) {
    const uri = block.uri ?? block.url;
    if (
      typeof uri === "string" &&
      uri.startsWith("mxc://") &&
      ["image", "file"].includes(block.type)
    )
      return (
        <AttachmentPreview
          content={{
            content_uri: uri,
            filename: block.filename ?? block.alt ?? t("Media"),
            mimetype:
              block.mime_type ??
              (block.type === "image" ? "image/*" : undefined),
          }}
        />
      );
    const safe = typeof uri === "string" && /^https?:\/\//.test(uri);
    return (
      <View>
        <Text style={styles.body}>
          {block.title ?? block.alt ?? block.filename ?? block.type}
        </Text>
        {safe && (
          <Button
            label={t("Open")}
            action={() => {
              void Linking.openURL(uri);
            }}
          />
        )}
      </View>
    );
  }
  return (
    <Text
      selectable
      style={[styles.body, block.type === "notice" && styles.notice]}
    >
      {block.text ?? block.message ?? fallback(block)}
    </Text>
  );
}
function PluginBlock({
  block,
  roomId,
  trust,
  interactive = true,
  focus = false,
  management,
}: BlockViewProps) {
  const [error, setError] = useState("");
  const { pending, key } = usePendingCommand(roomId, block);
  const commands = usePluginCommands((s) => s.commands);
  const sending = pending?.status === "sending";
  const view =
    block.plugin === "monthly_bills"
      ? block.view
      : overlayView(
          block.view ?? {},
          commands.filter(
            (c) =>
              c.roomId === roomId &&
              c.plugin === block.plugin &&
              c.instanceId === block.instance_id,
          ),
        );
  const [draft, setDraft] = useState(() => ({
    values: formValues(view),
    dirty: {} as Record<string, boolean>,
  }));
  const values = draft.values;
  const setValue = (id: string, value: unknown) =>
    setDraft((d) => ({
      values: { ...d.values, [id]: value },
      dirty: { ...d.dirty, [id]: true },
    }));
  const result = usePluginCommands((s) => s.results[key]);
  const acknowledged = useRef<string | undefined>(undefined);
  const revision = block.view?.revision;
  useEffect(() => {
    const own =
      !!result &&
      result.eventId !== acknowledged.current &&
      view.revision >= result.revision;
    if (own) acknowledged.current = result.eventId;
    setDraft((d) => reconcileDraft(d, view, own));
  }, [revision, block.instance_id, result]);
  const send = async (command: string, payload: Block = {}, retry = false) => {
    try {
      await pluginCommands
        .getState()
        .send(roomId, block, command, payload, retry);
    } catch {
      setError(
        t("Could not store the command. Free up space and try again."),
      );
    }
  };
  const rejected = pending?.rejected;
  const waiting = pending?.status === "queued" || pending?.status === "waiting";
  const failed = pending?.status === "failed";
  const disabled =
    !interactive ||
    !!block.view.transfer ||
    (!!pending && !["checklist", "monthly_bills"].includes(block.plugin));
  const owner = view.owner_id === trust.userId;
  const setPending = (_key: string, _value: unknown) =>
    pluginCommands.getState().dismiss(key);
  const expired =
    block.plugin === "approval" && Date.parse(view.expires_at) <= Date.now();
  if (block.plugin === "agent_status")
    return <AgentStatus block={block} roomId={roomId} trust={trust} />;
  return (
    <View style={[styles.card, focus && styles.focusCard]}>
      {!focus && <Text style={styles.title}>{view.title ?? block.plugin}</Text>}
      {block.plugin !== "monthly_bills" && !!view.description && (
        <Markdown text={String(view.description)} />
      )}
      {block.plugin === "monthly_bills" && (
        <MonthlyBills
          view={view}
          user={trust.userId}
          focus={focus}
          management={management}
          preferenceKey={JSON.stringify([
            "bills-group",
            trust.userId,
            roomId,
            block.instance_id,
          ])}
          storage={commandStorage}
          commands={commands.filter(
            (c) =>
              c.roomId === roomId &&
              c.plugin === block.plugin &&
              c.instanceId === block.instance_id,
          )}
          result={result}
          onOpen={() =>
            router.push(
              `/rooms/${roomId}/surfaces/monthly_bills/${block.instance_id}` as any,
            )
          }
          send={(cmd, p, retry) =>
            pluginCommands.getState().send(roomId, block, cmd, p, retry)
          }
        />
      )}
      {block.plugin === "approval" && (
        <>
          <Text style={styles.body}>
            {view.expires_at
              ? t("Deadline: {date}", { date: new Date(view.expires_at).toLocaleString(locale()) })
              : ""}
          </Text>
          {view.status === "pending" && !expired && owner ? (
            <View style={styles.actions}>
              <Button
                label={t("Approve")}
                variant="primary"
                disabled={disabled}
                action={() => void send("approve")}
              />
              <Button
                label={t("Reject")}
                variant="danger"
                disabled={disabled}
                action={() => void send("reject")}
              />
              <Button
                label={t("Cancel request")}
                disabled={disabled}
                action={() => void send("cancel")}
              />
            </View>
          ) : view.status === "pending" && !owner ? (
            <Text style={styles.body}>{t("Waiting for the requester.")}</Text>
          ) : null}
        </>
      )}
      {block.plugin === "workflow" && (
        <>
          <WorkflowSteps steps={view.steps ?? []} />
          {!!view.failure_description && (
            <Text style={styles.error}>{view.failure_description}</Text>
          )}
          {!!view.summary && <Markdown text={String(view.summary)} />}
          <Button
            label={t("Refresh")}
            disabled={disabled}
            action={() => void send("refresh")}
          />
        </>
      )}
      {block.plugin === "checklist" && (
        <>
          {(view.items ?? []).map((item: Block) => (
            <View key={item.id} style={styles.field}>
              <Switch
                trackColor={{
                  true: colors.primary,
                  false: colors.borderStrong,
                }}
                thumbColor={colors.text}
                accessibilityLabel={item.label}
                value={!!item.checked}
                disabled={
                  disabled || !["open", "completed"].includes(view.status)
                }
                onValueChange={(checked) =>
                  void send(checked ? "check_item" : "uncheck_item", {
                    item_id: item.id,
                  })
                }
              />
              <Text style={styles.body}>{item.label}</Text>
            </View>
          ))}
          {owner && ["open", "completed"].includes(view.status) && (
            <View style={styles.actions}>
              <Button
                label={t("Archive")}
                disabled={disabled}
                action={() => void send("archive")}
              />
              <Button
                label={t("Cancel list")}
                disabled={disabled}
                action={() => void send("cancel")}
              />
            </View>
          )}
        </>
      )}
      {block.plugin === "poll" && (
        <>
          {(view.options ?? []).map((option: Block) => {
            const selected = (
              view.votes_by_user?.[trust.userId] ?? []
            ).includes(option.id);
            return (
              <Button
                key={option.id}
                label={`${selected ? "✓ " : ""}${option.label} (${option.votes ?? 0})`}
                disabled={disabled || view.status !== "open"}
                action={() => {
                  const chosen = view.allow_multiple
                    ? new Set<string>(view.votes_by_user?.[trust.userId] ?? [])
                    : new Set<string>();
                  if (selected && view.allow_multiple) chosen.delete(option.id);
                  else chosen.add(option.id);
                  if (chosen.size)
                    void send("vote", { option_ids: [...chosen] });
                }}
              />
            );
          })}
          {owner && view.status === "open" && (
            <View style={styles.actions}>
              <Button
                label={t("Close poll")}
                disabled={disabled}
                action={() => void send("close")}
              />
              <Button
                label={t("Cancel poll")}
                disabled={disabled}
                action={() => void send("cancel")}
              />
            </View>
          )}
        </>
      )}
      {block.plugin === "form_stateful" && (
        <>
          {(view.fields ?? []).map((field: Block) => (
            <View key={field.id} style={styles.formField}>
              <Text style={styles.body}>
                {field.label}
                {field.required ? " *" : ""}
              </Text>
              {field.type === "boolean" ? (
                <View style={styles.actions}>
                  {[true, false].map((value) => (
                    <Button
                      key={String(value)}
                      label={`${values[field.id] === value ? "✓ " : ""}${value ? t("Yes") : t("No")}`}
                      disabled={
                        disabled ||
                        !owner ||
                        ["submitted", "cancelled"].includes(view.status)
                      }
                      action={() => setValue(field.id, value)}
                    />
                  ))}
                </View>
              ) : field.type === "select" ? (
                <View style={styles.actions}>
                  {(field.options ?? []).map((option: string) => (
                    <Button
                      key={option}
                      label={`${values[field.id] === option ? "✓ " : ""}${option}`}
                      disabled={
                        disabled ||
                        !owner ||
                        ["submitted", "cancelled"].includes(view.status)
                      }
                      action={() => setValue(field.id, option)}
                    />
                  ))}
                </View>
              ) : (
                <TextInput
                  accessibilityLabel={field.label}
                  style={styles.input}
                  value={
                    values[field.id] === undefined
                      ? ""
                      : String(values[field.id])
                  }
                  placeholder={field.type === "date" ? "AAAA-MM-DD" : ""}
                  placeholderTextColor={colors.textFaint}
                  editable={
                    !disabled &&
                    owner &&
                    !["submitted", "cancelled"].includes(view.status)
                  }
                  keyboardType={
                    field.type === "number" ? "decimal-pad" : "default"
                  }
                  onChangeText={(v) =>
                    setValue(field.id, formInputValue(field.type, v))
                  }
                />
              )}
              {!!view.errors?.[field.id] && (
                <Text style={styles.error}>{t(view.errors[field.id])}</Text>
              )}
            </View>
          ))}
          {owner && !["submitted", "cancelled"].includes(view.status) && (
            <View style={styles.actions}>
              <Button
                label={t("Save")}
                disabled={disabled}
                action={() => void send("save", { values })}
              />
              <Button
                label={t("Submit form")}
                variant="primary"
                disabled={disabled}
                action={() => void send("submit", { values })}
              />
              <Button
                label={t("Cancel form")}
                disabled={disabled}
                action={() => void send("cancel")}
              />
            </View>
          )}
        </>
      )}
      {(sending || waiting) && (
        <View style={styles.field} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.body}>
            {sending
              ? t("Sending…")
              : pending?.eventId
                ? t("Waiting for the plugin…")
                : t("Delivery not confirmed.")}
          </Text>
        </View>
      )}
      {!!rejected && (
        <ErrorBanner
          message={t("Command refused: {reason}", { reason: t(rejected) })}
          actionLabel={t("Got it")}
          onAction={() => setPending(key, null)}
        />
      )}
      {(!!error || failed) && pending && (
        <ErrorBanner
          message={
            error ||
            pending.error ||
            t("Result not confirmed. Try again with the same command.")
          }
          onAction={() => void send(pending.command, pending.payload, true)}
        />
      )}
      {waiting && !!pending?.eventId && !sending && !error && (
        <Button
          label={t("Check confirmation")}
          action={() => void send(pending!.command, pending!.payload, true)}
        />
      )}
    </View>
  );
}
// Workflow steps as a vertical progress list; status words come from the plugin.
function WorkflowSteps({ steps }: { steps: Block[] }) {
  if (!steps.length) return null;
  const done = steps.filter((s) =>
    ["completed", "succeeded", "skipped"].includes(s.status),
  ).length;
  return (
    <View style={styles.steps}>
      <Text style={type.caption}>
        {t("{done} of {total} steps", { done, total: steps.length })}
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(done / steps.length) * 100}%` },
          ]}
        />
      </View>
      {steps.map((step, index) => {
        const tone =
          step.status === "failed"
            ? toneColor.failed
            : ["completed", "succeeded"].includes(step.status)
              ? toneColor.done
              : step.status === "running"
                ? toneColor.active
                : toneColor.neutral;
        return (
          <View key={step.id ?? index} style={styles.step}>
            <View
              style={[
                styles.stepDot,
                { borderColor: tone, backgroundColor: tone + "33" },
              ]}
            />
            <View style={styles.stepText}>
              <Text style={styles.body}>{step.title}</Text>
              <Text style={[type.caption, { color: tone }]}>{step.status}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  focusCard: { marginTop: 0, padding: space.lg },
  title: { ...type.heading },
  body: { ...type.body },
  notice: {
    borderLeftWidth: 3,
    borderColor: colors.warning,
    backgroundColor: colors.surfaceRaised,
    padding: space.sm,
    borderRadius: radius.sm,
  },
  error: { ...type.label, color: colors.danger },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    flexWrap: "wrap",
    minHeight: touch,
  },
  formField: { gap: 6 },
  input: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    minHeight: touch,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: space.sm,
  },
  steps: { gap: space.sm },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  step: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 4,
  },
  stepText: { flex: 1 },
});
