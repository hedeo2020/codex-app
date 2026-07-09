import type { AttendanceAction, AttendanceRecord, Dashboard, Employee, SessionMarker } from "./types";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const isDemo = !baseUrl;

const demoEmployee: Employee = {
  id: "demo-employee",
  employeeId: "EMP-0021",
  firstName: "Maya",
  lastName: "Santos",
  email: "maya.santos@clockwise.demo",
  personalEmail: "maya@example.com",
  mobile: "+63 917 555 0142",
  jobTitle: "Operations Associate",
  department: "Operations",
  shift: { name: "Morning shift", startTime: "08:00", endTime: "17:00" },
  location: "Makati Office",
  preferredAttendanceMethod: "FACE",
  biometric: { consentStatus: true, enrollmentStatus: "ACTIVE", expiresAt: "2027-05-30T00:00:00Z" },
};

let demoRecords: AttendanceRecord[] = [
  { id: "3", attendanceType: "CHECK_OUT", eventTime: new Date(Date.now() - 86400000 + 9 * 3600000).toISOString(), captureLocationLabel: "Poblacion,Makati,Philippines", verificationMethod: "FACE", verificationStatus: "SUCCESS" },
  { id: "2", attendanceType: "CHECK_IN", eventTime: new Date(Date.now() - 86400000).toISOString(), captureLocationLabel: "Poblacion,Makati,Philippines", verificationMethod: "FACE", verificationStatus: "SUCCESS" },
];

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
  const response = await fetch(`${baseUrl}${path}`, {
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

function dashboard(): Dashboard {
  return buildDashboard(demoEmployee, demoRecords);
}

export const api = {
  async login(identity: string, password: string): Promise<SessionMarker> {
    if (isDemo) {
      await delay(450);
      if (!identity.trim() || password.length < 8) throw new Error("Enter your employee ID and an eight-character password.");
      return { signedIn: true };
    }
    await request("/api/auth/login", { method: "POST", body: JSON.stringify({ identity, password }) });
    return { signedIn: true };
  },
  async logout() {
    if (isDemo) return delay(200);
    await request("/api/auth/logout", { method: "POST" });
  },
  async dashboard(_session?: string): Promise<Dashboard> {
    if (isDemo) return delay(300).then(dashboard);
    const [{ user }, { records }] = await Promise.all([
      request<{ user: WebsiteUser }>("/api/employees/me"),
      request<{ records: AttendanceRecord[] }>("/api/employees/me/attendance"),
    ]);
    return buildDashboard(toEmployee(user), records);
  },
  async history(_session?: string): Promise<AttendanceRecord[]> {
    if (isDemo) return delay(300).then(() => demoRecords);
    const result = await request<{ records: AttendanceRecord[] }>("/api/employees/me/attendance");
    return result.records;
  },
  async recordAttendance(_session: string | undefined, input: { action: AttendanceAction; pin: string; latitude?: number; longitude?: number; accuracy?: number; locationLabel: string }): Promise<AttendanceRecord> {
    if (isDemo) {
      await delay(650);
      if (input.pin.length < 4) throw new Error("Enter your attendance PIN.");
      const record: AttendanceRecord = { id: String(Date.now()), attendanceType: input.action, eventTime: new Date().toISOString(), captureLocationLabel: input.locationLabel, verificationMethod: "PIN", verificationStatus: "SUCCESS" };
      demoRecords = [record, ...demoRecords];
      return record;
    }
    const result = await request<{ record: AttendanceRecord }>("/api/employees/me/attendance", { method: "POST", body: JSON.stringify({ type: input.action, method: "PIN", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, pin: input.pin, captureLocationLabel: input.locationLabel, latitude: input.latitude, longitude: input.longitude }) });
    return result.record;
  },
  async updateProfile(_session: string | undefined, input: { personalEmail: string; mobile: string }) {
    if (isDemo) { Object.assign(demoEmployee, input); return delay(350); }
    await request("/api/employees/me", { method: "PATCH", body: JSON.stringify(input) });
  },
  async reverseLocation(latitude: number, longitude: number): Promise<string> {
    if (isDemo) return "Current area";
    const result = await request<{ locationLabel: string }>(`/api/location/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
    return result.locationLabel;
  },
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
