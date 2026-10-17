import { Linking } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import type { MarkdownStyle } from "react-native-enriched-markdown";
import { colors } from "@/theme/tokens";
import { font } from "@/theme/typography";

const text = { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 22 };
const heading = { color: colors.text, fontFamily: font.bold, marginTop: 10, marginBottom: 4 };
const theme: MarkdownStyle = {
  paragraph: { ...text, marginTop: 2, marginBottom: 6 },
  h1: { ...heading, fontSize: 24 },
  h2: { ...heading, fontSize: 21 },
  h3: { ...heading, fontSize: 18 },
  h4: { ...heading, fontSize: 16 },
  h5: { ...heading, fontSize: 15 },
  h6: { ...heading, fontSize: 14 },
  list: { ...text, bulletColor: text.color, markerColor: text.color, itemSpacing: 4 },
  blockquote: { ...text, borderColor: colors.textMuted, backgroundColor: colors.surface },
  code: { color: colors.text, backgroundColor: colors.surfaceRaised, borderColor: colors.surfaceRaised, fontFamily: "monospace", fontSize: 13 },
  codeBlock: { color: colors.textSecondary, backgroundColor: colors.surfaceSunken, fontFamily: "monospace", fontSize: 13, padding: 10 },
  link: { color: colors.link, underline: true },
  table: { ...text, headerTextColor: colors.text, headerBackgroundColor: colors.surfaceRaised, rowEvenBackgroundColor: colors.background, rowOddBackgroundColor: colors.surface, borderColor: colors.border },
  thematicBreak: { color: colors.border },
};

export function Markdown({ text }: { text: string }) {
  return (
    <EnrichedMarkdownText
      markdown={text}
      markdownStyle={theme}
      flavor="github"
      selectable
      onLinkPress={({ url }) => {
        if (/^(https?:|mailto:)/i.test(url)) {
          void Linking.openURL(url).catch(() => {});
        }
      }}
    />
  );
}
