export type AttendanceAction = "CHECK_IN" | "CHECK_OUT";
export type AttendanceMethod = "PIN" | "FACE";

export type Employee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail?: string;
  mobile?: string;
  jobTitle: string;
  department: string;
  shift: { name: string; startTime: string; endTime: string };
  location: string;
  preferredAttendanceMethod: AttendanceMethod;
  biometric: { consentStatus: boolean; enrollmentStatus: string; expiresAt?: string };
};

export type AttendanceRecord = {
  id: string;
  attendanceType: AttendanceAction;
  eventTime: string;
  captureLocationLabel: string;
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

export type Tokens = { accessToken: string; refreshToken: string };

