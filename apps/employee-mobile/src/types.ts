export type AttendanceAction = "CHECK_IN" | "CHECK_OUT";
export type AttendanceMethod = "PIN" | "FACE";

export type Employee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail?: string | null;
  mobile?: string | null;
  profilePhotoUrl?: string | null;
  jobTitle?: string | null;
  department: string;
  shift: { name: string; startTime: string; endTime: string };
  location: string;
  preferredAttendanceMethod: AttendanceMethod | "ADMIN_ASSISTED";
  biometric: { consentStatus: boolean; enrollmentStatus: string; expiresAt?: string | null };
};

export type AttendanceRecord = {
  id: string;
  attendanceType: AttendanceAction;
  eventTime: string;
  captureLocationLabel?: string | null;
  verificationMethod: AttendanceMethod;
  verificationStatus: "SUCCESS" | "FAILED" | "PENDING_REVIEW";
};

export type Dashboard = {
  user: Employee;
  todayStatus: "NOT_STARTED" | "WORKING" | "COMPLETED";
  allowedActions: AttendanceAction[];
  weeklyCheckIns: number;
  recentRecords: AttendanceRecord[];
};

export type SessionMarker = { signedIn: true };
