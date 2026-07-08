import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps } from "react-native";
import { colors } from "./theme";

export function Button({ label, loading, variant = "primary", ...props }: PressableProps & { label: string; loading?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  return <Pressable accessibilityRole="button" disabled={loading || props.disabled} {...props} style={({ pressed }) => [styles.button, styles[variant], pressed && { opacity: 0.85 }, (loading || props.disabled) && { opacity: 0.55 }]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? colors.forestDark : colors.ink} /> : <Text style={[styles.buttonLabel, variant !== "primary" && { color: variant === "danger" ? colors.danger : colors.ink }]}>{label}</Text>}
  </Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor="#98A19D" {...props} style={[styles.input, props.style]} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function Tag({ children, tone = "green" }: { children: string; tone?: "green" | "gray" }) {
  return <View style={[styles.tag, tone === "gray" && { backgroundColor: "#EEF0ED" }]}><Text style={[styles.tagText, tone === "gray" && { color: colors.muted }]}>{children}</Text></View>;
}

export function LoadingScreen() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.forest} /></View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primary: { backgroundColor: colors.lime }, secondary: { backgroundColor: "#EEF1EC" }, danger: { backgroundColor: "#FBE9E7" },
  buttonLabel: { color: colors.forestDark, fontSize: 15, fontWeight: "800" },
  label: { color: colors.ink, fontWeight: "700", fontSize: 13 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 15, fontSize: 16, color: colors.ink },
  error: { color: colors.danger, fontSize: 12 },
  tag: { alignSelf: "flex-start", borderRadius: 99, backgroundColor: "#E5F3EA", paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.success, fontWeight: "800", fontSize: 11 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream },
});

