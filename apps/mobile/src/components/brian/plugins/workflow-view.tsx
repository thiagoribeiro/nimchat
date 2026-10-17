import { t } from "@nimchat/i18n";
import { Text, View } from "react-native";
import type { Block } from "@nimchat/brian";
import { Markdown } from "@/components/chat/markdown";
import { toneColor } from "@/components/ui/status";
import { type } from "@/theme/typography";
import { Button } from "./button";
import { styles } from "./styles";
import type { PluginViewProps } from "./types";

export function WorkflowView({ view, disabled, send }: PluginViewProps) {
  return (
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
