import type {
  AuditLog,
  CareConflict,
  CareEvent,
  CarePlan,
  CareTask,
  DailyRecord,
  Elder,
  RoleAssessment,
  User,
} from '../types';

export const roleLabels = {
  doctor: '医生',
  nurse: '护士',
  caregiver: '护理员',
  rehab: '康复师',
  nutritionist: '营养师',
  pharmacist: '药师',
  socialWorker: '社工',
  assessor: '评估师',
  admin: '管理员',
} as const;

export const users: User[] = [
  { id: 'u1', name: '陈医生', role: 'doctor', title: '老年医学医生' },
  { id: 'u2', name: '李护士', role: 'nurse', title: '护理组长' },
  { id: 'u3', name: '王护理员', role: 'caregiver', title: '二区护理员' },
  { id: 'u4', name: '赵康复师', role: 'rehab', title: '康复治疗师' },
  { id: 'u5', name: '周营养师', role: 'nutritionist', title: '临床营养师' },
  { id: 'u6', name: '孙药师', role: 'pharmacist', title: '药师' },
  { id: 'u7', name: '吴社工', role: 'socialWorker', title: '社工' },
  { id: 'u8', name: '郑评估师', role: 'assessor', title: '能力评估师' },
  { id: 'u9', name: '管理员', role: 'admin', title: '机构运营管理员' },
];

export const elders: Elder[] = [
  {
    id: 'e1',
    name: '张秀兰',
    age: 83,
    room: '2F-218',
    careLevel: '二级护理',
    diagnoses: ['高血压', '轻度认知障碍', '骨质疏松'],
    primaryNurse: '李护士',
    status: 'event',
    cells: { mobility: 61, cognition: 68, nutrition: 54, medication: 77, emotion: 48, sleep: 42, risk: 72 },
  },
  {
    id: 'e2',
    name: '刘国强',
    age: 79,
    room: '3F-306',
    careLevel: '三级护理',
    diagnoses: ['2型糖尿病', '脑梗后遗症'],
    primaryNurse: '李护士',
    status: 'watch',
    cells: { mobility: 46, cognition: 73, nutrition: 62, medication: 71, emotion: 66, sleep: 70, risk: 58 },
  },
  {
    id: 'e3',
    name: '何美珍',
    age: 88,
    room: '1F-112',
    careLevel: '一级护理',
    diagnoses: ['冠心病', '慢阻肺'],
    primaryNurse: '李护士',
    status: 'stable',
    cells: { mobility: 52, cognition: 59, nutrition: 69, medication: 82, emotion: 74, sleep: 64, risk: 43 },
  },
];

export const dailyRecords: DailyRecord[] = [
  {
    id: 'r1',
    elderId: 'e1',
    authorId: 'u3',
    authorRole: 'caregiver',
    time: '2026-05-13 08:20',
    appetite: '早餐少于半份',
    sleep: '夜间醒来 4 次',
    mobility: '晨起步态不稳',
    mood: '烦躁，拒绝活动',
    vitals: 'BP 146/86, HR 82',
    note: '连续第二天食量下降，起身需要更多扶助。',
    abnormalFlags: ['食欲下降', '睡眠中断', '跌倒风险'],
  },
  {
    id: 'r2',
    elderId: 'e1',
    authorId: 'u3',
    authorRole: 'caregiver',
    time: '2026-05-14 08:15',
    appetite: '早餐约三分之一',
    sleep: '夜间醒来 5 次',
    mobility: '走廊训练中途停下',
    mood: '情绪低落',
    vitals: 'BP 152/88, HR 86',
    note: '异常持续，建议发起跨专业查看。',
    abnormalFlags: ['食欲下降', '睡眠中断', '康复耐受下降'],
  },
];

export const events: CareEvent[] = [
  {
    id: 'ce1',
    elderId: 'e1',
    title: '连续食欲下降伴睡眠中断与活动耐受下降',
    status: 'approval',
    createdAt: '2026-05-14 09:05',
    triggerEvidence: ['两日早餐摄入少于半份', '夜醒次数从 2 次升至 5 次', '步态不稳且康复训练提前终止'],
    aiSummary:
      '系统根据连续日常观察识别到营养、睡眠、情绪与跌倒风险的组合变化，建议由护士牵头，医生、营养师、康复师、药师共同评估。',
    mainRole: 'nurse',
    supportRoles: ['doctor', 'nutritionist', 'rehab', 'pharmacist', 'socialWorker'],
  },
];

export const assessments: RoleAssessment[] = [
  {
    id: 'a1',
    eventId: 'ce1',
    role: 'nurse',
    assignee: '李护士',
    status: 'submitted',
    focus: '连续异常与照护可执行性',
    aiSummary: '护理风险集中在夜间巡视、跌倒预防和进食协助强度。',
    professionalOpinion: '需增加晚间巡视并复核近三天排便、疼痛和饮水情况。',
    confidence: 88,
  },
  {
    id: 'a2',
    eventId: 'ce1',
    role: 'doctor',
    assignee: '陈医生',
    status: 'submitted',
    focus: '疾病和药物相关风险',
    aiSummary: '血压波动与睡眠变差可能互相影响，需排除感染、疼痛、药物副作用。',
    professionalOpinion: '建议测体温、疼痛评分，必要时安排门诊复评降压及助眠相关用药。',
    confidence: 82,
  },
  {
    id: 'a3',
    eventId: 'ce1',
    role: 'nutritionist',
    assignee: '周营养师',
    status: 'submitted',
    focus: '摄入不足与营养补充',
    aiSummary: '短期摄入不足可能加重体力下降，需调整餐型与补充策略。',
    professionalOpinion: '改为少量多餐，午后增加高蛋白点心，连续三天记录摄入量。',
    confidence: 84,
  },
  {
    id: 'a4',
    eventId: 'ce1',
    role: 'rehab',
    assignee: '赵康复师',
    status: 'waiting',
    focus: '康复强度与跌倒风险',
    aiSummary: '当前活动耐受下降，训练强度可能需要临时下调。',
    professionalOpinion: '',
    confidence: 76,
  },
  {
    id: 'a5',
    eventId: 'ce1',
    role: 'pharmacist',
    assignee: '孙药师',
    status: 'submitted',
    focus: '用药相互作用与不良反应',
    aiSummary: '需关注降压药服用时间、镇静类药物和夜间跌倒风险。',
    professionalOpinion: '建议医生确认近期是否新增镇静或影响食欲药物，避免自行调整。',
    confidence: 79,
  },
];

export const conflicts: CareConflict[] = [
  {
    id: 'c1',
    eventId: 'ce1',
    severity: 'high',
    title: '康复训练强度与跌倒风险冲突',
    roles: ['rehab', 'nurse', 'doctor'],
    detail: '继续原训练强度可能维持功能，但睡眠不足和步态不稳会增加跌倒风险。',
    recommendation: '先由医生排除急性问题，康复师将训练调整为坐站转换和平衡保护训练。',
    resolved: false,
  },
  {
    id: 'c2',
    eventId: 'ce1',
    severity: 'medium',
    title: '营养补充与血压/血糖管理需协调',
    roles: ['nutritionist', 'doctor', 'pharmacist'],
    detail: '高蛋白补充和加餐需要结合慢病管理，避免影响血糖与夜间睡眠。',
    recommendation: '选择低糖高蛋白点心，药师和医生复核用药时间。',
    resolved: true,
  },
];

export const carePlans: CarePlan[] = [
  {
    id: 'p1',
    eventId: 'ce1',
    goal: '72 小时内降低跌倒和营养恶化风险，稳定睡眠与活动耐受。',
    summary: '由护士牵头执行短周期照护调整，医生和药师确认医疗/用药风险，康复与营养同步降强度、增支持。',
    confirmed: false,
    items: [
      {
        id: 'pi1',
        role: 'nurse',
        title: '夜间巡视与跌倒预防',
        detail: '22:00-06:00 增加两次巡视，床旁放置助行器，晨起先坐稳再站立。',
        requiresApproval: false,
        approvalStatus: 'approved',
      },
      {
        id: 'pi2',
        role: 'doctor',
        title: '急性问题排查与用药复核',
        detail: '复测生命体征、体温、疼痛评分，并判断是否需要调整药物或外诊。',
        requiresApproval: true,
        approvalStatus: 'pending',
      },
      {
        id: 'pi3',
        role: 'rehab',
        title: '临时下调康复强度',
        detail: '暂停长距离走廊训练，改为保护下坐站转换和平衡训练，每次不超过 15 分钟。',
        requiresApproval: true,
        approvalStatus: 'pending',
      },
      {
        id: 'pi4',
        role: 'nutritionist',
        title: '少量多餐与摄入记录',
        detail: '增加低糖高蛋白点心，连续三天记录每餐摄入比例。',
        requiresApproval: false,
        approvalStatus: 'approved',
      },
    ],
  },
];

export const tasks: CareTask[] = [
  {
    id: 't1',
    eventId: 'ce1',
    elderId: 'e1',
    role: 'nurse',
    owner: '李护士',
    title: '执行夜间巡视与跌倒预防',
    due: '2026-05-15 22:00',
    status: 'in_progress',
  },
  {
    id: 't2',
    eventId: 'ce1',
    elderId: 'e1',
    role: 'nutritionist',
    owner: '周营养师',
    title: '制定三日加餐与摄入记录表',
    due: '2026-05-15 18:00',
    status: 'pending',
  },
];

export const auditLogs: AuditLog[] = [
  {
    id: 'log1',
    time: '2026-05-14 09:05',
    user: '系统',
    action: '创建协同事件',
    target: '张秀兰',
    detail: '连续异常触发事件 ce1',
  },
  {
    id: 'log2',
    time: '2026-05-14 10:30',
    user: '李护士',
    action: '提交角色评估',
    target: 'ce1',
    detail: '补充护理巡视与跌倒预防意见',
  },
];
