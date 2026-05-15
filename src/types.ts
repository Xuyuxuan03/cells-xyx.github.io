export type Role =
  | 'doctor'
  | 'nurse'
  | 'caregiver'
  | 'rehab'
  | 'nutritionist'
  | 'pharmacist'
  | 'socialWorker'
  | 'assessor'
  | 'admin';

export type EventStatus = 'new' | 'assessing' | 'plan_ready' | 'approval' | 'tasking' | 'closed';
export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  title: string;
}

export interface ElderCells {
  mobility: number;
  cognition: number;
  nutrition: number;
  medication: number;
  emotion: number;
  sleep: number;
  risk: number;
}

export interface Elder {
  id: string;
  name: string;
  age: number;
  room: string;
  careLevel: string;
  diagnoses: string[];
  cells: ElderCells;
  primaryNurse: string;
  status: 'stable' | 'watch' | 'event';
}

export interface DailyRecord {
  id: string;
  elderId: string;
  authorId: string;
  authorRole: Role;
  time: string;
  appetite: string;
  sleep: string;
  mobility: string;
  mood: string;
  vitals: string;
  note: string;
  abnormalFlags: string[];
}

export interface RoleAssessment {
  id: string;
  eventId: string;
  role: Role;
  assignee: string;
  status: 'waiting' | 'submitted';
  focus: string;
  aiSummary: string;
  professionalOpinion: string;
  confidence: number;
}

export interface CareConflict {
  id: string;
  eventId: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  roles: Role[];
  detail: string;
  recommendation: string;
  resolved: boolean;
}

export interface CarePlanItem {
  id: string;
  role: Role;
  title: string;
  detail: string;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
}

export interface CarePlan {
  id: string;
  eventId: string;
  goal: string;
  summary: string;
  items: CarePlanItem[];
  confirmed: boolean;
}

export interface CareTask {
  id: string;
  eventId: string;
  elderId: string;
  role: Role;
  owner: string;
  title: string;
  due: string;
  status: TaskStatus;
  feedback?: string;
}

export interface CareEvent {
  id: string;
  elderId: string;
  title: string;
  status: EventStatus;
  createdAt: string;
  triggerEvidence: string[];
  aiSummary: string;
  mainRole: Role;
  supportRoles: Role[];
}

export interface AuditLog {
  id: string;
  time: string;
  user: string;
  action: string;
  target: string;
  detail: string;
}
