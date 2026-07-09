import type { AttendanceAction, AttendanceRecord, Dashboard, Employee, SessionMarker } from "./types";

const envBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
let runtimeBaseUrl = envBaseUrl;

export function configureServerUrl(url?: string | null) {
  const raw = url?.trim() || envBaseUrl;
  const normalized = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
  runtimeBaseUrl = normalized.replace(/\/$/, "");
}

export function getServerUrl() {
  return runtimeBaseUrl;
}

export function hasServerUrl() {
  return Boolean(runtimeBaseUrl);
}

type WebsiteUser = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail?: string | null;
  mobile?: string | null;
  profilePhotoUrl?: string | null;
  jobTitle?: string | null;
  preferredAttendanceMethod?: Employee["preferredAttendanceMethod"];
  department?: { name: string } | null;
  shift?: { name: string; startTime: string; endTime: string } | null;
  biometricProfile?: { consentStatus: boolean; enrollmentStatus: string; expiresAt?: string | null } | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!runtimeBaseUrl) throw new Error("Enter your Clockwise website URL before signing in.");
  const response = await fetch(`${runtimeBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error ?? "Something went wrong. Please try again.");
  return body.data ?? body;
}

function toEmployee(user: WebsiteUser): Employee {
  return {
    id: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    personalEmail: user.personalEmail,
    mobile: user.mobile,
    profilePhotoUrl: user.profilePhotoUrl,
    jobTitle: user.jobTitle,
    department: user.department?.name ?? "Unassigned",
    shift: user.shift ?? { name: "No shift assigned", startTime: "--:--", endTime: "--:--" },
    location: "Assigned workplace",
    preferredAttendanceMethod: user.preferredAttendanceMethod ?? "PIN",
    biometric: {
      consentStatus: user.biometricProfile?.consentStatus ?? false,
      enrollmentStatus: user.biometricProfile?.enrollmentStatus ?? "NOT_ENROLLED",
      expiresAt: user.biometricProfile?.expiresAt ?? null,
    },
  };
}

function buildDashboard(user: Employee, records: AttendanceRecord[]): Dashboard {
  const today = new Date().toDateString();
  const todayRecords = records.filter((record) => new Date(record.eventTime).toDateString() === today);
  const last = todayRecords[0];
  const working = last?.attendanceType === "CHECK_IN";
  const weekStart = Date.now() - 7 * 86400000;
  const weeklyCheckIns = records.filter((record) => record.attendanceType === "CHECK_IN" && new Date(record.eventTime).getTime() >= weekStart).length;
  return { user, todayStatus: todayRecords.length === 0 ? "NOT_STARTED" : working ? "WORKING" : "COMPLETED", allowedActions: [working ? "CHECK_OUT" : "CHECK_IN"], weeklyCheckIns, recentRecords: records };
}

export const api = {
  async login(identity: string, password: string): Promise<SessionMarker> {
    if (!hasServerUrl()) {
      await delay(450);
      throw new Error("Enter your Clockwise website URL before signing in.");
    }
    await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identity, password }) });
    return { signedIn: true };
  },
  async logout() {
    if (!hasServerUrl()) return delay(200);
    await request("/api/auth/logout", { method: "POST" });
  },
  async dashboard(_session?: string): Promise<Dashboard> {
    if (!hasServerUrl()) throw new Error("Enter your Clockwise website URL before signing in.");
    const [{ user }, { records }] = await Promise.all([
      request<{ user: WebsiteUser }>("/api/employees/me"),
      request<{ records: AttendanceRecord[] }>("/api/employees/me/attendance"),
    ]);
    return buildDashboard(toEmployee(user), records);
  },
  async history(_session?: string): Promise<AttendanceRecord[]> {
    if (!hasServerUrl()) throw new Error("Enter your Clockwise website URL before signing in.");
    const result = await request<{ records: AttendanceRecord[] }>("/api/employees/me/attendance");
    return result.records;
  },
  async recordAttendance(_session: string | undefined, input: { action: AttendanceAction; pin: string; latitude?: number; longitude?: number; accuracy?: number; locationLabel: string }): Promise<AttendanceRecord> {
    if (!hasServerUrl()) {
      await delay(650);
      throw new Error("Enter your Clockwise website URL before recording attendance.");
    }
    const result = await request<{ record: AttendanceRecord }>("/api/employees/me/attendance", { method: "POST", body: JSON.stringify({ type: input.action, method: "PIN", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, pin: input.pin, captureLocationLabel: input.locationLabel, latitude: input.latitude, longitude: input.longitude }) });
    return result.record;
  },
  async updateProfile(_session: string | undefined, input: { personalEmail: string; mobile: string }) {
    if (!hasServerUrl()) throw new Error("Enter your Clockwise website URL before updating your profile.");
    await request("/api/employees/me", { method: "PATCH", body: JSON.stringify(input) });
  },
  async reverseLocation(latitude: number, longitude: number): Promise<string> {
    if (!hasServerUrl()) return "Current area";
    const result = await request<{ locationLabel: string }>(`/api/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
    return result.locationLabel;
  },
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
