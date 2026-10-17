import { Button as UIButton } from "@/components/ui/button";

// Plugin action button: the design-system button with an `action` callback.
export function Button({
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
