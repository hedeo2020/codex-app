import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "./src/api";
import { AuthProvider, useAuth } from "./src/auth";
import { Button, Field, LoadingScreen, Tag } from "./src/components";
import { colors } from "./src/theme";
import type { AttendanceAction, AttendanceRecord, Dashboard } from "./src/types";

type Tab = "home" | "history" | "face" | "profile";

export default function App() {
  return <AuthProvider><StatusBar style="dark" /><Root /></AuthProvider>;
}

function Root() {
  const { ready, tokens } = useAuth();
  if (!ready) return <LoadingScreen />;
  return tokens ? <EmployeeApp /> : <Login />;
}

function Login() {
  const { signIn, serverUrl: savedServerUrl } = useAuth();
  const [serverUrl, setServerUrl] = useState(savedServerUrl);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    setLoading(true);
    try {
      await signIn(identity, password, serverUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <SafeAreaView style={styles.loginPage}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.loginBody}>
    <View style={styles.brandMark}><Ionicons name="checkmark" size={28} color={colors.forestDark} /></View>
    <View><Text style={styles.eyebrow}>CLOCKWISE EMPLOYEE</Text><Text style={styles.loginTitle}>Attendance, without the fuss.</Text><Text style={styles.subtitle}>Sign in to record your day and review your attendance.</Text></View>
    {!serverUrl.trim() ? <View style={styles.demo}><Ionicons name="cloud-outline" size={18} color={colors.forest} /><Text style={styles.demoText}>Enter your deployed Clockwise website URL to use real employee accounts.</Text></View> : null}
    <View style={{ gap: 15 }}><Field label="Website URL" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" keyboardType="url" placeholder="https://your-clockwise-site.com" /><Field label="Employee ID or email" value={identity} onChangeText={setIdentity} autoCapitalize="none" placeholder="EMP-0021" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" onSubmitEditing={submit} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button label="Sign in online" loading={loading} onPress={submit} /></View>
    <Text style={styles.fine}>Your website session is kept by the device. Sign out when using a shared phone.</Text>
  </KeyboardAvoidingView></SafeAreaView>;
}

function EmployeeApp() {
  const { tokens } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!tokens) return;
    try {
      setError("");
      setData(await api.dashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your account.");
    }
  }, [tokens]);

  useEffect(() => { void load(); }, [load]);

  if (!data && !error) return <LoadingScreen />;
  if (!data) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><Button label="Try again" onPress={load} /></SafeAreaView>;

  return <SafeAreaView style={styles.app}><View style={{ flex: 1 }}>
    {tab === "home" ? <Home data={data} reload={load} openHistory={() => setTab("history")} /> : null}
    {tab === "history" ? <History records={data.recentRecords} reload={load} /> : null}
    {tab === "face" ? <Face data={data} /> : null}
    {tab === "profile" ? <Profile data={data} reload={load} /> : null}
  </View><TabBar value={tab} onChange={setTab} /></SafeAreaView>;
}

function Page({ children, refresh }: { children: React.ReactNode; refresh?: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  return <ScrollView contentContainerStyle={styles.page} refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor={colors.forest} /> : undefined}>{children}</ScrollView>;
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return <View style={{ gap: 4 }}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

function Home({ data, reload, openHistory }: { data: Dashboard; reload(): Promise<void>; openHistory(): void }) {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const action = data.allowedActions[0] ?? "CHECK_IN";
  const jobTitle = data.user.jobTitle ?? "Employee";

  return <><Page refresh={reload}><Header eyebrow={new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase()} title={`Good day, ${data.user.firstName}.`} subtitle="Here is your attendance at a glance." />
    <View style={styles.hero}><View style={{ gap: 8, flex: 1 }}><Text style={styles.heroEyebrow}>TODAY</Text><Text style={styles.heroTitle}>{data.todayStatus === "WORKING" ? "You are checked in" : data.todayStatus === "COMPLETED" ? "Day completed" : "Ready when you are"}</Text><Text style={styles.heroText}>{data.user.shift.startTime}-{data.user.shift.endTime} - {data.user.location}</Text></View><View style={styles.weekBubble}><Text style={styles.weekNumber}>{data.weeklyCheckIns}</Text><Text style={styles.weekLabel}>THIS WEEK</Text></View></View>
    <Button label={action === "CHECK_IN" ? "Check in now" : "Check out now"} onPress={() => setAttendanceOpen(true)} />
    <View style={styles.metrics}><Metric icon="time-outline" value={data.user.shift.name} label={`${data.user.shift.startTime}-${data.user.shift.endTime}`} /><Metric icon="business-outline" value={data.user.department} label={jobTitle} /></View>
    <SectionTitle title="Recent attendance" action="View all" onPress={openHistory} />{data.recentRecords.slice(0, 3).map((item) => <RecordRow key={item.id} item={item} />)}
  </Page>{attendanceOpen ? <AttendanceSheet action={action} onClose={() => setAttendanceOpen(false)} onRecorded={async () => { setAttendanceOpen(false); await reload(); }} /> : null}</>;
}

function AttendanceSheet({ action, onClose, onRecorded }: { action: AttendanceAction; onClose(): void; onRecorded(): Promise<void> }) {
  const { tokens } = useAuth();
  const [pin, setPin] = useState("");
  const [location, setLocation] = useState("Location not captured");
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number; accuracy?: number }>({});
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function findLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location permission was not granted. You can still use PIN if policy allows.");
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: point.coords.latitude, longitude: point.coords.longitude, accuracy: point.coords.accuracy ?? undefined });
      setLocation(await api.reverseLocation(point.coords.latitude, point.coords.longitude));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location is unavailable.");
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!tokens) return;
    setError("");
    setLoading(true);
    try {
      await api.recordAttendance(undefined, { action, pin, locationLabel: location, ...coords });
      await onRecorded();
      Alert.alert("Attendance recorded", action === "CHECK_IN" ? "You are checked in." : "You are checked out.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record attendance.");
    } finally {
      setLoading(false);
    }
  }

  return <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={styles.sheet}><View style={styles.sheetHandle} /><Header eyebrow="PIN ATTENDANCE" title={action === "CHECK_IN" ? "Check in" : "Check out"} subtitle="We will verify your PIN and record the current place." /><View style={styles.locationBox}><Ionicons name="location-outline" size={22} color={colors.forest} /><View style={{ flex: 1 }}><Text style={styles.locationTitle}>{location}</Text><Text style={styles.fine}>{coords.accuracy ? `Accuracy +/- ${Math.round(coords.accuracy)} m` : "Capture your foreground location"}</Text></View><Pressable onPress={findLocation}><Text style={styles.link}>{locating ? "Locating..." : "Refresh"}</Text></Pressable></View><Field label="Attendance PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry placeholder="PIN" />{error ? <Text style={styles.error}>{error}</Text> : null}<Button label={action === "CHECK_IN" ? "Confirm check in" : "Confirm check out"} loading={loading} onPress={submit} /><Button label="Cancel" variant="secondary" onPress={onClose} /></View></View>;
}

function History({ records, reload }: { records: AttendanceRecord[]; reload(): Promise<void> }) {
  return <Page refresh={reload}><Header eyebrow="ATTENDANCE HISTORY" title="Your records" subtitle="Verified events from the attendance system." />{records.length ? records.map((item) => <RecordRow key={item.id} item={item} />) : <Empty icon="calendar-outline" title="No attendance yet" text="Your verified records will appear here." />}</Page>;
}

function Face({ data }: { data: Dashboard }) {
  const bio = data.user.biometric;
  return <Page><Header eyebrow="PRIVACY CENTER" title="Your face, your choice" subtitle="Face attendance is optional. PIN attendance remains available." /><View style={styles.card}><View style={styles.rowBetween}><Ionicons name="scan-outline" size={30} color={colors.forest} /><Tag tone={bio.consentStatus ? "green" : "gray"}>{bio.enrollmentStatus.replaceAll("_", " ")}</Tag></View><Text style={styles.cardTitle}>Face profile</Text><Text style={styles.subtitle}>{bio.consentStatus ? "Your explicit consent is on file." : "Consent has not been granted."}</Text><InfoRow label="Consent" value={bio.consentStatus ? "Recorded" : "Not recorded"} /><InfoRow label="Expiry" value={bio.expiresAt ? new Date(bio.expiresAt).toLocaleDateString() : "Not set"} /></View><View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={22} color={colors.forest} /><Text style={styles.noticeText}>Your captured face is sent for verification. PIN attendance remains available.</Text></View><Button label="Face enrollment coming next" disabled /></Page>;
}

function Profile({ data, reload }: { data: Dashboard; reload(): Promise<void> }) {
  const { signOut, tokens } = useAuth();
  const user = data.user;
  const [email, setEmail] = useState(user.personalEmail ?? "");
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!tokens) return;
    setSaving(true);
    try {
      await api.updateProfile(undefined, { personalEmail: email, mobile });
      await reload();
      Alert.alert("Profile updated", "Your contact details were saved.");
    } catch (e) {
      Alert.alert("Unable to save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <Page><Header eyebrow="MY PROFILE" title={`${user.firstName} ${user.lastName}`} subtitle={`${user.employeeId} - ${user.jobTitle ?? "Employee"}`} /><View style={styles.card}><InfoRow label="Work email" value={user.email} /><InfoRow label="Department" value={user.department} /><InfoRow label="Assigned site" value={user.location} /></View><Field label="Personal email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Field label="Mobile number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" /><Button label="Save changes" loading={saving} onPress={save} /><Button label="Sign out" variant="danger" onPress={() => Alert.alert("Sign out?", "You will need your password to return.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut }])} /></Page>;
}

function Metric({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }) { return <View style={styles.metric}><Ionicons name={icon} size={22} color={colors.forest} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.fine}>{label}</Text></View>; }
function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress(): void }) { return <View style={styles.rowBetween}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action}</Text></Pressable></View>; }
function RecordRow({ item }: { item: AttendanceRecord }) { const checkIn = item.attendanceType === "CHECK_IN"; return <View style={styles.record}><View style={[styles.recordIcon, !checkIn && { backgroundColor: "#F1EFE7" }]}><Ionicons name={checkIn ? "log-in-outline" : "log-out-outline"} size={21} color={colors.forest} /></View><View style={{ flex: 1 }}><Text style={styles.recordTitle}>{checkIn ? "Check in" : "Check out"}</Text><Text numberOfLines={1} style={styles.fine}>{item.captureLocationLabel ?? "Location not captured"}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.recordTime}>{new Date(item.eventTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text><Text style={styles.fine}>{new Date(item.eventTime).toLocaleDateString([], { month: "short", day: "numeric" })}</Text></View></View>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.fine}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }
function Empty({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={38} color={colors.muted} /><Text style={styles.cardTitle}>{title}</Text><Text style={styles.subtitle}>{text}</Text></View>; }
function TabBar({ value, onChange }: { value: Tab; onChange(tab: Tab): void }) { const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [{ key: "home", label: "Home", icon: "home-outline" }, { key: "history", label: "History", icon: "calendar-outline" }, { key: "face", label: "Face", icon: "scan-outline" }, { key: "profile", label: "Profile", icon: "person-outline" }]; return <View style={styles.tabBar}>{tabs.map((tab) => <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}><Ionicons name={tab.icon} size={23} color={value === tab.key ? colors.forest : "#8B9590"} /><Text style={[styles.tabText, value === tab.key && { color: colors.forest, fontWeight: "800" }]}>{tab.label}</Text></Pressable>)}</View>; }

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.cream }, page: { padding: 20, paddingBottom: 34, gap: 18 }, center: { flex: 1, justifyContent: "center", padding: 30, gap: 16, backgroundColor: colors.cream },
  loginPage: { flex: 1, backgroundColor: colors.forest }, loginBody: { flex: 1, justifyContent: "center", gap: 25, padding: 26, backgroundColor: colors.cream, marginTop: 64, borderTopLeftRadius: 34, borderTopRightRadius: 34 }, brandMark: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.success, fontWeight: "900", letterSpacing: 1.2, fontSize: 11 }, loginTitle: { color: colors.ink, fontSize: 38, lineHeight: 43, fontWeight: "900", letterSpacing: -1.2 }, title: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: "900", letterSpacing: -0.8 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 }, fine: { color: colors.muted, fontSize: 12, lineHeight: 17 }, error: { color: colors.danger, fontSize: 13, lineHeight: 18 }, link: { color: colors.forest, fontWeight: "800", fontSize: 13 },
  demo: { flexDirection: "row", gap: 10, alignItems: "center", padding: 13, borderRadius: 14, backgroundColor: "#E9F0E8" }, demoText: { flex: 1, color: colors.forest, fontSize: 12, lineHeight: 17 },
  hero: { flexDirection: "row", alignItems: "center", padding: 20, borderRadius: 24, backgroundColor: colors.forest, minHeight: 150 }, heroEyebrow: { color: colors.lime, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, heroTitle: { color: "white", fontSize: 24, fontWeight: "900" }, heroText: { color: "#C9D9D2", fontSize: 12, lineHeight: 18 }, weekBubble: { width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: "#4D7767", alignItems: "center", justifyContent: "center" }, weekNumber: { color: "white", fontSize: 25, fontWeight: "900" }, weekLabel: { color: "#C9D9D2", fontSize: 8, fontWeight: "800" },
  metrics: { flexDirection: "row", gap: 12 }, metric: { flex: 1, gap: 6, backgroundColor: colors.card, padding: 16, borderRadius: 19, borderWidth: 1, borderColor: colors.line }, metricValue: { color: colors.ink, fontSize: 15, fontWeight: "800" }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" }, rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  record: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: 17, borderWidth: 1, borderColor: colors.line }, recordIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E5F3EA", alignItems: "center", justifyContent: "center" }, recordTitle: { color: colors.ink, fontWeight: "800", marginBottom: 2 }, recordTime: { color: colors.ink, fontWeight: "900", fontSize: 14 },
  card: { gap: 14, padding: 18, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }, cardTitle: { color: colors.ink, fontSize: 20, fontWeight: "900" }, infoRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, gap: 3 }, infoValue: { color: colors.ink, fontSize: 14, fontWeight: "700" }, notice: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 17, backgroundColor: "#E9F0E8" }, noticeText: { flex: 1, color: colors.forest, fontSize: 13, lineHeight: 19 }, empty: { alignItems: "center", gap: 8, padding: 35, backgroundColor: colors.card, borderRadius: 20 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, justifyContent: "flex-end", backgroundColor: "rgba(8,20,15,0.45)" }, sheet: { gap: 16, padding: 22, paddingBottom: 28, backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28 }, sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 5, backgroundColor: "#CCD1CD" }, locationBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line }, locationTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  tabBar: { flexDirection: "row", paddingTop: 9, paddingBottom: Platform.OS === "android" ? 10 : 3, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card }, tab: { flex: 1, alignItems: "center", gap: 3 }, tabText: { color: "#8B9590", fontSize: 10, fontWeight: "600" },
});
