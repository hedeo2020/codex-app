import type { AttendanceAction, AttendanceRecord, Dashboard, Employee, Tokens } from "./types";

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

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error ?? "Something went wrong. Please try again.");
  return body.data ?? body;
}

function dashboard(): Dashboard {
  const today = new Date().toDateString();
  const todayRecords = demoRecords.filter((record) => new Date(record.eventTime).toDateString() === today);
  const last = todayRecords[0];
  const working = last?.attendanceType === "CHECK_IN";
  return { user: demoEmployee, todayStatus: todayRecords.length === 0 ? "NOT_STARTED" : working ? "WORKING" : "COMPLETED", allowedActions: [working ? "CHECK_OUT" : "CHECK_IN"], weeklyCheckIns: 4, recentRecords: demoRecords.slice(0, 4) };
}

export const api = {
  async login(identity: string, password: string): Promise<Tokens> {
    if (isDemo) {
      await delay(450);
      if (!identity.trim() || password.length < 8) throw new Error("Enter your employee ID and an eight-character password.");
      return { accessToken: "demo-access", refreshToken: "demo-refresh" };
    }
    return request("/api/mobile/v1/auth/login", { method: "POST", body: JSON.stringify({ identity, password }) });
  },
  async logout(accessToken: string) {
    if (isDemo) return delay(200);
    await request("/api/mobile/v1/auth/logout", { method: "POST" }, accessToken);
  },
  async dashboard(accessToken: string): Promise<Dashboard> {
    if (isDemo) return delay(300).then(dashboard);
    return request("/api/mobile/v1/dashboard", {}, accessToken);
  },
  async history(accessToken: string): Promise<AttendanceRecord[]> {
    if (isDemo) return delay(300).then(() => demoRecords);
    const result = await request<{ records: AttendanceRecord[] }>("/api/mobile/v1/attendance", {}, accessToken);
    return result.records;
  },
  async recordAttendance(accessToken: string, input: { action: AttendanceAction; pin: string; latitude?: number; longitude?: number; accuracy?: number; locationLabel: string }): Promise<AttendanceRecord> {
    if (isDemo) {
      await delay(650);
      if (input.pin.length < 4) throw new Error("Enter your attendance PIN.");
      const record: AttendanceRecord = { id: String(Date.now()), attendanceType: input.action, eventTime: new Date().toISOString(), captureLocationLabel: input.locationLabel, verificationMethod: "PIN", verificationStatus: "SUCCESS" };
      demoRecords = [record, ...demoRecords];
      return record;
    }
    return request("/api/mobile/v1/attendance", { method: "POST", body: JSON.stringify({ ...input, method: "PIN", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, idempotencyKey: createId() }) }, accessToken);
  },
  async updateProfile(accessToken: string, input: { personalEmail: string; mobile: string }) {
    if (isDemo) { Object.assign(demoEmployee, input); return delay(350); }
    await request("/api/mobile/v1/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken);
  },
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

