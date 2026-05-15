import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  assessments as initialAssessments,
  auditLogs as initialAuditLogs,
  carePlans as initialCarePlans,
  conflicts as initialConflicts,
  dailyRecords as initialDailyRecords,
  elders as initialElders,
  events as initialEvents,
  tasks as initialTasks,
  users,
} from '../data/mock';
import type {
  AuditLog,
  CareConflict,
  CareEvent,
  CarePlan,
  CareTask,
  DailyRecord,
  Elder,
  RoleAssessment,
  Role,
  User,
} from '../types';

type AppState = {
  currentUser: User | null;
  users: User[];
  elders: Elder[];
  records: DailyRecord[];
  events: CareEvent[];
  assessments: RoleAssessment[];
  conflicts: CareConflict[];
  carePlans: CarePlan[];
  tasks: CareTask[];
  auditLogs: AuditLog[];
  login: (userId: string) => void;
  logout: () => void;
  addRecord: (record: Omit<DailyRecord, 'id' | 'time' | 'authorId' | 'authorRole'>) => void;
  submitAssessment: (assessmentId: string, opinion: string) => void;
  resolveConflict: (conflictId: string) => void;
  approvePlanItem: (planId: string, itemId: string, approved: boolean) => void;
  confirmPlan: (planId: string) => void;
  completeTask: (taskId: string, feedback: string) => void;
  closeEvent: (eventId: string) => void;
  can: (action: PermissionAction, role?: Role) => boolean;
};

type PermissionAction =
  | 'record:create'
  | 'assessment:submit'
  | 'plan:approve'
  | 'plan:confirm'
  | 'task:update'
  | 'audit:view'
  | 'event:close';

const permissions: Record<Role, PermissionAction[]> = {
  caregiver: ['record:create', 'task:update'],
  nurse: ['record:create', 'assessment:submit', 'plan:confirm', 'task:update', 'event:close'],
  doctor: ['assessment:submit', 'plan:approve', 'task:update'],
  rehab: ['assessment:submit', 'plan:approve', 'task:update'],
  nutritionist: ['assessment:submit', 'task:update'],
  pharmacist: ['assessment:submit', 'plan:approve', 'task:update'],
  socialWorker: ['assessment:submit', 'task:update'],
  assessor: ['assessment:submit', 'task:update'],
  admin: ['record:create', 'assessment:submit', 'plan:approve', 'plan:confirm', 'task:update', 'audit:view', 'event:close'],
};

const AppContext = createContext<AppState | null>(null);

const nowText = () =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(/\//g, '-');

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(users[2]);
  const [elders, setElders] = useState(initialElders);
  const [records, setRecords] = useState(initialDailyRecords);
  const [events, setEvents] = useState(initialEvents);
  const [assessments, setAssessments] = useState(initialAssessments);
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [carePlans, setCarePlans] = useState(initialCarePlans);
  const [tasks, setTasks] = useState(initialTasks);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);

  const appendLog = (action: string, target: string, detail: string, user = currentUser?.name ?? '系统') => {
    setAuditLogs((prev) => [
      { id: `log${Date.now()}`, time: nowText(), user, action, target, detail },
      ...prev,
    ]);
  };

  const can = (action: PermissionAction, role = currentUser?.role) => {
    if (!role) return false;
    return permissions[role].includes(action);
  };

  const addRecord: AppState['addRecord'] = (record) => {
    if (!currentUser || !can('record:create')) return;
    const newRecord: DailyRecord = {
      ...record,
      id: `r${Date.now()}`,
      time: nowText(),
      authorId: currentUser.id,
      authorRole: currentUser.role,
    };
    setRecords((prev) => [newRecord, ...prev]);
    appendLog('录入日常记录', record.elderId, `异常标记：${record.abnormalFlags.join('、') || '无'}`);

    const elderRecords = [newRecord, ...records.filter((item) => item.elderId === record.elderId)].slice(0, 2);
    const abnormalCount = elderRecords.filter((item) => item.abnormalFlags.length >= 2).length;
    const hasOpenEvent = events.some((item) => item.elderId === record.elderId && item.status !== 'closed');

    if (abnormalCount >= 2 && !hasOpenEvent) {
      const event: CareEvent = {
        id: `ce${Date.now()}`,
        elderId: record.elderId,
        title: '连续日常异常触发跨专业协同',
        status: 'new',
        createdAt: nowText(),
        triggerEvidence: newRecord.abnormalFlags.map((flag) => `连续观察出现：${flag}`),
        aiSummary: 'AI 根据连续观察记录识别到多维风险升高，建议护士牵头组织跨专业评估。',
        mainRole: 'nurse',
        supportRoles: ['doctor', 'nutritionist', 'rehab', 'pharmacist'],
      };
      setEvents((prev) => [event, ...prev]);
      setElders((prev) => prev.map((elder) => (elder.id === record.elderId ? { ...elder, status: 'event' } : elder)));
      appendLog('自动创建协同事件', record.elderId, '连续异常记录达到触发规则', '系统');
    }
  };

  const submitAssessment: AppState['submitAssessment'] = (assessmentId, opinion) => {
    setAssessments((prev) =>
      prev.map((item) => (item.id === assessmentId ? { ...item, status: 'submitted', professionalOpinion: opinion } : item)),
    );
    appendLog('提交角色评估', assessmentId, opinion);
  };

  const resolveConflict = (conflictId: string) => {
    setConflicts((prev) => prev.map((item) => (item.id === conflictId ? { ...item, resolved: true } : item)));
    appendLog('标记冲突已处理', conflictId, '已纳入统一照护方案');
  };

  const approvePlanItem: AppState['approvePlanItem'] = (planId, itemId, approved) => {
    setCarePlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              items: plan.items.map((item) =>
                item.id === itemId ? { ...item, approvalStatus: approved ? 'approved' : 'rejected' } : item,
              ),
            }
          : plan,
      ),
    );
    appendLog(approved ? '批准方案项' : '退回方案项', itemId, `所属方案：${planId}`);
  };

  const confirmPlan: AppState['confirmPlan'] = (planId) => {
    const plan = carePlans.find((item) => item.id === planId);
    if (!plan) return;
    const allSafe = plan.items.every((item) => !item.requiresApproval || item.approvalStatus === 'approved');
    if (!allSafe) return;
    setCarePlans((prev) => prev.map((item) => (item.id === planId ? { ...item, confirmed: true } : item)));
    setEvents((prev) => prev.map((item) => (item.id === plan.eventId ? { ...item, status: 'tasking' } : item)));
    const newTasks = plan.items.map<CareTask>((item) => ({
      id: `t${Date.now()}${item.id}`,
      eventId: plan.eventId,
      elderId: events.find((event) => event.id === plan.eventId)?.elderId ?? 'e1',
      role: item.role,
      owner: users.find((user) => user.role === item.role)?.name ?? '待分配',
      title: item.title,
      due: '2026-05-16 18:00',
      status: 'pending',
    }));
    setTasks((prev) => [...newTasks, ...prev]);
    appendLog('确认统一照护方案', planId, `生成 ${newTasks.length} 个任务`);
  };

  const completeTask: AppState['completeTask'] = (taskId, feedback) => {
    setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, status: 'done', feedback } : item)));
    appendLog('完成任务', taskId, feedback);
  };

  const closeEvent: AppState['closeEvent'] = (eventId) => {
    setEvents((prev) => prev.map((item) => (item.id === eventId ? { ...item, status: 'closed' } : item)));
    const elderId = events.find((item) => item.id === eventId)?.elderId;
    if (elderId) {
      setElders((prev) =>
        prev.map((elder) =>
          elder.id === elderId
            ? { ...elder, status: 'watch', cells: { ...elder.cells, risk: Math.max(20, elder.cells.risk - 8), sleep: elder.cells.sleep + 6 } }
            : elder,
        ),
      );
    }
    appendLog('关闭协同事件', eventId, '复盘完成并更新 Elder Cells');
  };

  const value = useMemo<AppState>(
    () => ({
      currentUser,
      users,
      elders,
      records,
      events,
      assessments,
      conflicts,
      carePlans,
      tasks,
      auditLogs,
      login: (userId) => setCurrentUser(users.find((user) => user.id === userId) ?? null),
      logout: () => setCurrentUser(null),
      addRecord,
      submitAssessment,
      resolveConflict,
      approvePlanItem,
      confirmPlan,
      completeTask,
      closeEvent,
      can,
    }),
    [currentUser, elders, records, events, assessments, conflicts, carePlans, tasks, auditLogs],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
