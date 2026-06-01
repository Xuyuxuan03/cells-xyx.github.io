import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  GitBranch,
  HeartPulse,
  Home,
  LogOut,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { AppProvider, useApp } from './store/AppContext';
import { roleLabels } from './data/mock';
import type { CareEvent, Elder, Role } from './types';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  { path: '/', label: '智能管家', icon: Home },
  { path: '/record', label: '现场记录', icon: ClipboardList },
  { path: '/handover', label: '交班中心', icon: GitBranch },
  { path: '/elders', label: '长者档案', icon: Users },
  { path: '/events', label: '事件协同', icon: HeartPulse },
  { path: '/plan', label: '方案调整', icon: ClipboardCheck },
  { path: '/tasks', label: '我的任务', icon: Activity },
  { path: '/approval', label: '待确认', icon: ShieldCheck },
  { path: '/family', label: '家属摘要', icon: FileClock },
  { path: '/decisions', label: '决策台账', icon: ClipboardCheck },
  { path: '/conflicts', label: '冲突检测', icon: AlertTriangle },
  { path: '/assessments', label: '角色评估', icon: Stethoscope },
  { path: '/dependency', label: '责任链路', icon: GitBranch },
  { path: '/audit', label: '审计日志', icon: FileClock },
];

const roleTone: Record<Role, string> = {
  doctor: 'bg-blue-50 text-blue-700 border-blue-100',
  nurse: 'bg-teal-50 text-teal-700 border-teal-100',
  caregiver: 'bg-amber-50 text-amber-700 border-amber-100',
  rehab: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  nutritionist: 'bg-lime-50 text-lime-700 border-lime-100',
  pharmacist: 'bg-violet-50 text-violet-700 border-violet-100',
  socialWorker: 'bg-rose-50 text-rose-700 border-rose-100',
  assessor: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  admin: 'bg-slate-100 text-slate-700 border-slate-200',
};

type RoleWorkflow = {
  scopeTitle: string;
  responsibility: string;
  upstream: { role: Role; input: string }[];
  outputs: string[];
  downstream: { role: Role; handoff: string }[];
  boundaries: string[];
};

const roleWorkflows: Record<Role, RoleWorkflow> = {
  caregiver: {
    scopeTitle: '日常观察与异常上报',
    responsibility: '记录老人真实日常状态，发现异常后把事实交给护士，不做专业判断。',
    upstream: [],
    outputs: ['进食、睡眠、活动、情绪、疼痛表达', '是否需要关注', '异常备注和现场照片'],
    downstream: [{ role: 'nurse', handoff: '提交连续异常、疑似跌倒、用药执行异常等事实证据' }],
    boundaries: ['不解释诊断', '不调整照护方案', '不向家属发送未经确认结论'],
  },
  nurse: {
    scopeTitle: '体征补充与照护可执行性判断',
    responsibility: '把护理员观察转化为可协同的专业输入，并判断护理执行风险。',
    upstream: [{ role: 'caregiver', input: '食量、夜醒、步态、情绪、异常备注' }],
    outputs: ['体温、血压、血糖、饮水、排便、睡眠复核', '跌倒风险和巡视建议', '需要其他专业补充的问题'],
    downstream: [
      { role: 'doctor', handoff: '提交急性问题排查所需体征和风险变化' },
      { role: 'pharmacist', handoff: '提交服药后嗜睡、食欲变化、夜间跌倒风险' },
      { role: 'rehab', handoff: '提交步态不稳、晨起扶助、训练耐受情况' },
    ],
    boundaries: ['不确认医疗诊断', '不修改处方', '涉及康复强度明显变化需医生确认'],
  },
  doctor: {
    scopeTitle: '医疗风险判断与最终确认',
    responsibility: '基于已补齐信息判断是否存在急性问题，并确认医疗、用药、康复强度相关方案。',
    upstream: [
      { role: 'nurse', input: '体征、疼痛评分、睡眠、饮水排便和跌倒风险' },
      { role: 'pharmacist', input: '近一周用药变化、疑似不良反应和相互作用' },
      { role: 'rehab', input: '训练耐受和强度调整建议' },
    ],
    outputs: ['是否需要进一步检查', '是否同意用药风险处理建议', '是否同意康复训练降级', '事件是否可关闭'],
    downstream: [
      { role: 'nurse', handoff: '确认护理观察重点和复盘时间' },
      { role: 'pharmacist', handoff: '确认是否继续核查或调整用药流程' },
      { role: 'rehab', handoff: '确认训练强度边界' },
    ],
    boundaries: ['AI 不替代诊断', 'AI 不直接修改处方', '所有医疗结论需医生人工确认'],
  },
  rehab: {
    scopeTitle: '康复耐受与训练强度调整',
    responsibility: '评估老人当前体力、步态和训练配合度，只处理康复训练相关动作。',
    upstream: [
      { role: 'nurse', input: '步态不稳、生命体征、跌倒风险、晨起状态' },
      { role: 'doctor', input: '是否排除急性问题，是否允许训练降级或恢复' },
    ],
    outputs: ['未来 24-48 小时训练强度建议', '安全保护动作', '训练完成度反馈'],
    downstream: [{ role: 'nurse', handoff: '同步训练注意事项和护理观察点' }],
    boundaries: ['不单独决定明显训练强度变化', '不忽略跌倒风险继续原训练', '需要医生确认后执行高风险调整'],
  },
  nutritionist: {
    scopeTitle: '摄入风险与饮食观察方案',
    responsibility: '围绕食欲下降和营养不足风险制定短期摄入观察与饮食优化。',
    upstream: [
      { role: 'caregiver', input: '每餐摄入比例、偏好、拒食表现' },
      { role: 'nurse', input: '血糖、饮水、排便、吞咽和精神状态' },
      { role: 'doctor', input: '慢病限制、肾功能等饮食边界' },
    ],
    outputs: ['24-72 小时摄入观察方案', '软食或低糖高蛋白加餐建议', '成功标准和复盘时间'],
    downstream: [{ role: 'nurse', handoff: '需要护理团队执行的饮食记录和观察指标' }],
    boundaries: ['特殊饮食需医生确认', '不忽略糖尿病、肾功能等疾病限制', '不向家属输出未经确认饮食承诺'],
  },
  pharmacist: {
    scopeTitle: '用药风险核查',
    responsibility: '核查近一周用药变化、疑似副作用和相互作用，把风险提交医生确认。',
    upstream: [
      { role: 'nurse', input: '服药后嗜睡、食欲下降、夜醒或跌倒风险时间关系' },
      { role: 'doctor', input: '近期处方变化和可确认的医疗边界' },
    ],
    outputs: ['疑似高风险药物清单', '相互作用和不良反应提醒', '需要医生确认的问题'],
    downstream: [{ role: 'doctor', handoff: '提交是否需要调整处方或继续观察的确认请求' }],
    boundaries: ['不直接改药', '不替代医生最终确认', '用药相关建议必须进入人工确认'],
  },
  socialWorker: {
    scopeTitle: '情绪社交与家属沟通准备',
    responsibility: '评估情绪、陪伴、家庭因素对异常事件的影响，只处理沟通和心理社会支持。',
    upstream: [
      { role: 'caregiver', input: '沉默少语、拒绝交流、家属探访变化' },
      { role: 'nurse', input: '睡眠、疼痛、精神状态等生理线索' },
    ],
    outputs: ['情绪访谈记录', '陪伴沟通建议', '是否需要家属沟通简报'],
    downstream: [{ role: 'nurse', handoff: '同步情绪诱因和照护沟通方式' }],
    boundaries: ['不把情绪解释替代生理排查', '正式家属说明需专业确认', '高风险情绪干预需人工确认'],
  },
  assessor: {
    scopeTitle: '风险复评与照护等级建议',
    responsibility: '在任务反馈后复评风险等级，并建议是否更新 Elder Cells 或照护等级。',
    upstream: [
      { role: 'nurse', input: '任务执行反馈和风险变化' },
      { role: 'doctor', input: '事件关闭判断和医疗边界' },
    ],
    outputs: ['风险等级复评', '照护等级建议', 'Elder Cells 更新项'],
    downstream: [{ role: 'admin', handoff: '提交机构管理视角的风险变化和资源需求' }],
    boundaries: ['不替代医生诊断', '照护等级调整需走审核', '不直接关闭未完成任务事件'],
  },
  admin: {
    scopeTitle: '机构级事件调度与任务监督',
    responsibility: '查看事件整体阶段、任务超时和权限流转，不替代专业角色提交医学判断。',
    upstream: [
      { role: 'nurse', input: '事件阶段和护理执行风险' },
      { role: 'doctor', input: '待确认方案和关闭判断' },
      { role: 'assessor', input: '风险复评和资源需求' },
    ],
    outputs: ['任务分派监督', '超时提醒', '审计与权限检查'],
    downstream: [{ role: 'nurse', handoff: '协调资源和跟进超时任务' }],
    boundaries: ['不代替医生确认医疗方案', '不绕过人工确认', '不向家属开放未经确认 AI 判断'],
  },
};

const cnRoleLabels: Record<Role, string> = {
  doctor: '医生',
  nurse: '护士',
  caregiver: '护理员',
  rehab: '康复师',
  nutritionist: '营养师',
  pharmacist: '药师',
  socialWorker: '社工',
  assessor: '评估师',
  admin: '管理员',
};

const simpleRoleGuide: Record<Role, { focus: string; first: string; second: string; third: string }> = {
  admin: {
    focus: '看全院风险、未闭环事项和人员负荷。',
    first: '先处理逾期任务和待确认建议。',
    second: '再查看重点长者和交班摘要。',
    third: '最后复盘事件和决策台账。',
  },
  nurse: {
    focus: '把现场记录转成可执行的护理判断。',
    first: '先看需要护士查看的长者。',
    second: '补齐体征、饮水、排便和睡眠信息。',
    third: '把需要医生、药师、康复师处理的事项交出去。',
  },
  caregiver: {
    focus: '快速记录现场情况，不做专业判断。',
    first: '先完成现场记录。',
    second: '把异常标记为“需要护士查看”或“加入交班”。',
    third: '继续执行我的任务并提交反馈。',
  },
  doctor: {
    focus: '确认医疗相关风险和高风险方案调整。',
    first: '先看待确认建议。',
    second: '查看护士、药师、康复师提供的证据。',
    third: '确认后交给执行角色并设置复盘时间。',
  },
  rehab: {
    focus: '处理训练耐受、跌倒风险和强度调整。',
    first: '先看康复相关任务和冲突。',
    second: '查看护士体征和医生确认边界。',
    third: '提交训练调整建议和完成反馈。',
  },
  nutritionist: {
    focus: '处理摄入下降和饮食观察。',
    first: '先看饮食记录和摄入趋势。',
    second: '判断是否需要加餐或三日观察。',
    third: '把可执行方案交给护理团队。',
  },
  pharmacist: {
    focus: '核查用药变化和疑似不良反应。',
    first: '先看用药相关提醒。',
    second: '核对近一周用药变化。',
    third: '把需要确认的问题交给医生。',
  },
  socialWorker: {
    focus: '处理情绪、家属沟通和解释材料。',
    first: '先看家属沟通提醒。',
    second: '确认哪些内容可以对家属说明。',
    third: '把未确认信息退回专业角色。',
  },
  assessor: {
    focus: '复评风险和照护等级变化。',
    first: '先看已完成任务和事件复盘。',
    second: '判断是否更新 Cells 画像。',
    third: '把等级或规则建议提交管理者。',
  },
};

const operationsMock = {
  focusResidents: [
    { elderId: 'e1', name: '张秀兰', room: '2F-218', risk: '中高', reason: '食量连续下降、夜醒增加、晨起扶墙', owner: '李护士', trend: '近 72 小时风险上升' },
    { elderId: 'e2', name: '刘国强', room: '3F-306', risk: '中', reason: '康复完成度下降、午后疲劳', owner: '赵康复师', trend: '需继续观察 48 小时' },
  ],
  openLoops: [
    { type: '逾期任务', title: '摄入记录缺 1 餐', owner: '王护理员', due: '今日 12:30', path: '/tasks' },
    { type: '待审批建议', title: '康复训练 48 小时降级', owner: '陈医生', due: '今日 18:00', path: '/approval' },
    { type: '异常事件', title: '连续性状态下滑未复盘', owner: '李护士', due: '明日 10:00', path: '/events' },
  ],
  familyAlerts: [
    { elder: '张秀兰', family: '张先生', issue: '连续两次询问进食情况，需给出已确认说明', owner: '吴社工', status: '待回复' },
    { elder: '何美珍', family: '何女士', issue: '希望调整视频沟通频率，需判断是否可排班', owner: '吴社工', status: '待评估' },
  ],
  workload: [
    { name: '王护理员', role: '护理员', tasks: 9, overdue: 1, load: 86 },
    { name: '李护士', role: '护士', tasks: 7, overdue: 0, load: 74 },
    { name: '赵康复师', role: '康复师', tasks: 6, overdue: 1, load: 81 },
    { name: '吴社工', role: '社工', tasks: 4, overdue: 0, load: 62 },
  ],
  shiftSummary: {
    night: ['张秀兰 02:10 夜醒一次，起身扶墙，已提醒晨起保护', '刘国强 夜间无跌倒，血糖记录完整'],
    day: ['补齐张秀兰早餐/午餐摄入比例', '康复师复评刘国强午后训练耐受', '社工准备张秀兰家属说明草稿'],
    watch: ['张秀兰：食量、睡眠、步态', '何美珍：咳嗽和皮肤受压点'],
  },
};

const cellsProfileMock = {
  health: [
    { title: '跌倒风险', value: '中高', evidence: '夜醒增加、晨起扶墙、步态不稳', confirmed: true },
    { title: '营养风险', value: '中', evidence: '两日早餐少于半份，午餐剩余较多', confirmed: false },
    { title: '用药观察', value: '需复核', evidence: '白天嗜睡与食欲下降同步出现', confirmed: false },
  ],
  behavior: [
    { title: '沟通方式', value: '温和解释，避免命令式提醒', evidence: '护理员交班备注 3 次提及', confirmed: true },
    { title: '活动规律', value: '上午配合度更高，下午容易疲劳', evidence: '康复完成记录连续两周显示', confirmed: true },
  ],
  emotion: [
    { title: '情绪触发', value: '家属探访减少后沉默少语', evidence: '家属沟通与护理备注交叉出现', confirmed: false },
  ],
  preferences: [
    { type: '硬性安全约束', title: '晨起先坐稳再站立', detail: '跌倒风险相关，不作为可选偏好', status: '已进入照护计划' },
    { type: '标准照护模板', title: '二级护理夜间巡视', detail: '按机构 SOP 执行', status: '执行中' },
    { type: '可执行个性化偏好', title: '上午洗澡更配合', detail: '需避开早餐后一小时和护理高峰', status: '待主管确认' },
    { type: '人性化细节', title: '喜欢被称呼“张阿姨”', detail: '新人交接提醒，不单独派任务', status: '已确认' },
  ],
};

const microRevisionSuggestions = [
  {
    id: 'adj1',
    title: '将康复训练临时调整为短时多次',
    original: '每日一次走廊训练 30 分钟',
    revised: '未来 48 小时改为保护下坐站转换和平衡训练，每次不超过 15 分钟',
    reason: '连续两次训练提前中止，夜间睡眠不足且晨起步态不稳',
    evidence: ['5月14日 康复训练提前终止', '5月15日 护理员记录晨起扶墙', '夜醒次数从 2 次升至 5 次'],
    workload: '减少单次训练强度，但增加复评记录 1 次',
    risk: '高',
    confidence: 82,
    approver: '医生',
    executor: '康复师',
    status: '待确认',
  },
  {
    id: 'adj2',
    title: '增加三日摄入观察与低糖高蛋白点心',
    original: '按二级护理常规饮食记录',
    revised: '连续三天记录每餐摄入比例，午后增加低糖高蛋白点心',
    reason: '早餐摄入连续下降，短期营养风险上升',
    evidence: ['5月13日 早餐少于半份', '5月14日 早餐约三分之一', '营养师评估建议少量多餐'],
    workload: '护理员每餐增加 10 秒记录，营养师复盘 1 次',
    risk: '中',
    confidence: 84,
    approver: '护理主管',
    executor: '护理员/营养师',
    status: '待确认',
  },
];

const handoverMock = {
  overview: { completed: 42, pending: 7, events: 3, watchResidents: 5 },
  keyResidents: [
    { name: '张秀兰', room: '2F-218', reason: '食量下降 + 夜醒 + 步态不稳', next: '白班补齐摄入记录，护士复测体征' },
    { name: '刘国强', room: '3F-306', reason: '午后训练耐受下降', next: '康复师改为短时训练并记录完成度' },
  ],
  unfinished: [
    { title: '张秀兰午餐摄入记录', owner: '王护理员', due: '12:30', reason: '餐厅协助临时调班' },
    { title: '康复训练降级确认', owner: '陈医生', due: '18:00', reason: '等待体征复测结果' },
  ],
  family: [
    { elder: '张秀兰', issue: '家属询问进食下降原因', next: '社工使用已确认信息回复' },
    { elder: '何美珍', issue: '家属希望增加视频频率', next: '评估排班可行性' },
  ],
};

const familyWeeklyMock = [
  { elder: '张秀兰', summary: '本周重点关注进食、睡眠和步态安全，已增加晨起保护和摄入观察。', evidence: '护理记录 6 条、任务反馈 2 条、护士确认 1 次', status: '待社工确认' },
  { elder: '刘国强', summary: '康复训练根据疲劳情况做短时调整，整体配合度稳定。', evidence: '康复记录 4 条、护理交班 2 条', status: '可发送草稿' },
];

function useHashRoute() {
  const [path, setPath] = useState(window.location.hash.replace('#', '') || '/');
  useEffect(() => {
    const onHash = () => setPath(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = (next: string) => {
    window.location.hash = next;
  };
  return { path, navigate };
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-14 items-center justify-between border-b border-slate-200 px-5">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function AiNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
      AI 辅助，仅供专业人员参考，需人工确认。
    </div>
  );
}

function WorkZone({
  kind,
  title,
  subtitle,
  children,
}: {
  kind: 'human' | 'ai' | 'chat' | 'context';
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const styles = {
    human: {
      shell: 'border-teal-200 bg-teal-50/50',
      tag: 'bg-care text-white',
      label: '我本人参与',
    },
    ai: {
      shell: 'border-blue-200 bg-blue-50/60',
      tag: 'bg-blue-600 text-white',
      label: '角色 AI 输出',
    },
    chat: {
      shell: 'border-amber-200 bg-amber-50/70',
      tag: 'bg-amber-600 text-white',
      label: '我与 AI 交互',
    },
    context: {
      shell: 'border-slate-200 bg-slate-50',
      tag: 'bg-slate-600 text-white',
      label: '只读协同上下文',
    },
  }[kind];

  return (
    <section className={`rounded-lg border p-4 ${styles.shell}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${styles.tag}`}>{styles.label}</span>
          <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LoginPage() {
  const { users, login } = useApp();
  const { navigate } = useHashRoute();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <div className="grid md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-care p-10 text-white">
            <div className="mb-12 flex items-center gap-3">
              <HeartPulse className="h-9 w-9" />
              <span className="text-xl font-semibold">Cells 医养协同系统</span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight">围绕 Elder Cells 的跨专业工作台</h1>
            <p className="mt-4 text-sm leading-6 text-teal-50">
              连接医生、护士、护理员、康复、营养、药师与社工，完成异常识别、专业解释、冲突检测、人工确认和任务闭环。
            </p>
          </div>
          <div className="p-10">
            <h2 className="text-xl font-semibold text-ink">选择角色登录</h2>
            <p className="mt-2 text-sm text-muted">MVP 使用 mock 用户模拟机构内不同权限。</p>
            <div className="mt-6 grid gap-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-care hover:bg-teal-50"
                  onClick={() => {
                    login(user.id);
                    navigate('/');
                  }}
                >
                  <span>
                    <span className="block font-medium text-ink">{user.name}</span>
                    <span className="text-sm text-muted">{user.title}</span>
                  </span>
                  <Pill className={roleTone[user.role]}>{roleLabels[user.role]}</Pill>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Layout({ path, navigate, children }: { path: string; navigate: (path: string) => void; children: React.ReactNode }) {
  const { currentUser, logout, can } = useApp();
  if (!currentUser) return <LoginPage />;
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <HeartPulse className="h-7 w-7 text-care" />
          <div>
            <div className="font-semibold text-ink">Cells 医养协同</div>
            <div className="text-xs text-muted">Elder Cells Workbench</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems
            .filter((item) => item.path !== '/audit' || can('audit:view'))
            .map((item) => {
              const Icon = item.icon;
              const active = path === item.path || (item.path === '/elders' && path.startsWith('/elder/')) || (item.path === '/events' && path.startsWith('/event/'));
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                    active ? 'bg-teal-50 text-care' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <div className="text-sm text-muted">专业协同工作台</div>
            <div className="font-semibold text-ink">人工确认优先，AI 仅辅助解释与整理</div>
          </div>
          <div className="flex items-center gap-3">
            <Pill className={roleTone[currentUser.role]}>{roleLabels[currentUser.role]}</Pill>
            <div className="text-right">
              <div className="text-sm font-medium text-ink">{currentUser.name}</div>
              <div className="text-xs text-muted">{currentUser.title}</div>
            </div>
            <button
              className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="退出"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-5 p-6">{children}</main>
      </div>
    </div>
  );
}

function Dashboard({ navigate }: { navigate: (path: string) => void }) {
  const { elders, events, tasks, conflicts, currentUser } = useApp();
  const openEvents = events.filter((item) => item.status !== 'closed');
  const role = currentUser?.role ?? 'caregiver';
  const guide = simpleRoleGuide[role];
  const pendingApprovals = microRevisionSuggestions.filter((item) => item.status === '待确认').length;
  const overdueTasks = operationsMock.openLoops.filter((item) => item.type === '逾期任务').length;
  const firstActionPath =
    role === 'caregiver' ? '/record' :
    role === 'socialWorker' ? '/family' :
    role === 'doctor' || role === 'pharmacist' || role === 'rehab' ? '/approval' :
    '/handover';
  return (
    <div className="space-y-5">
      <AiNotice />
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-care text-sm font-semibold text-white">管家</div>
              <div>
                <div className="text-sm text-muted">你好，{cnRoleLabels[role]}。这是你今天的工作导览。</div>
                <h1 className="mt-1 text-2xl font-semibold text-ink">先处理未闭环，再看重点长者。</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              当前有 {operationsMock.focusResidents.length} 位长者需要关注，{operationsMock.openLoops.length} 个事项未闭环，{pendingApprovals} 条 Cells 建议待确认。{guide.focus}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <GuideStep number="1" title={guide.first} path={firstActionPath} navigate={navigate} />
              <GuideStep number="2" title={guide.second} path="/handover" navigate={navigate} />
              <GuideStep number="3" title={guide.third} path="/decisions" navigate={navigate} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="font-semibold text-ink">今天最重要的三件事</div>
            <div className="mt-4 space-y-3">
              {operationsMock.openLoops.slice(0, 3).map((item) => (
                <button key={`${item.type}-${item.title}`} onClick={() => navigate(item.path)} className="block w-full rounded-md bg-white p-3 text-left hover:ring-1 hover:ring-care">
                  <div className="flex items-center justify-between gap-2">
                    <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.type}</Pill>
                    <span className="text-xs text-muted">{item.due}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-ink">{item.title}</div>
                  <div className="mt-1 text-xs text-muted">责任人：{item.owner}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="重点长者" value={operationsMock.focusResidents.length} sub="今天需要关注" />
        <Metric label="未闭环" value={operationsMock.openLoops.length} sub="任务/事件/审批" />
        <Metric label="待确认" value={pendingApprovals} sub="AI 建议需人工确认" />
        <Metric label="班组高负荷" value={operationsMock.workload.filter((item) => item.load > 80).length} sub="可能影响服务质量" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="重点长者">
          <div className="grid gap-3">
            {operationsMock.focusResidents.map((item) => (
              <button key={item.elderId} onClick={() => navigate(`/elder/${item.elderId}`)} className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill className={item.risk === '中高' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{item.risk}</Pill>
                  <span className="font-semibold text-ink">{item.name} · {item.room}</span>
                  <span className="text-xs text-muted">责任人：{item.owner}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                <div className="mt-2 text-xs text-care">{item.trend}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="常用入口">
          <div className="grid gap-3 md:grid-cols-2">
            <QuickNav title="现场记录" desc="30 秒记录现场情况" path="/record" navigate={navigate} />
            <QuickNav title="交班中心" desc="看未完成和下一班事项" path="/handover" navigate={navigate} />
            <QuickNav title="方案调整" desc="查看待确认微修订" path="/plan" navigate={navigate} />
            <QuickNav title="家属摘要" desc="查看可发送说明草稿" path="/family" navigate={navigate} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Cells 建议">
          <div className="space-y-3">
            {microRevisionSuggestions.map((item) => (
              <button key={item.id} onClick={() => navigate('/plan')} className="block w-full rounded-lg border border-blue-100 bg-white p-3 text-left hover:border-blue-300">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-ink">{item.title}</div>
                  <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
                </div>
                <div className="mt-2 text-sm text-slate-600">风险 {item.risk} · 置信度 {item.confidence}% · 审批人：{item.approver}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="交班摘要">
          <div className="grid gap-3 md:grid-cols-3">
            <ShiftSummaryBlock title="夜班遗留" items={operationsMock.shiftSummary.night} />
            <ShiftSummaryBlock title="白班跟进" items={operationsMock.shiftSummary.day} />
            <ShiftSummaryBlock title="重点观察" items={operationsMock.shiftSummary.watch} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="家属沟通">
          <div className="space-y-3">
            {operationsMock.familyAlerts.map((item) => (
              <button key={`${item.elder}-${item.issue}`} onClick={() => navigate('/family')} className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{item.elder} · {item.family}</div>
                  <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.issue}</p>
                <div className="mt-1 text-xs text-muted">责任人：{item.owner}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="事件卡片">
          <div className="space-y-4">
            {openEvents.map((event) => (
              <button key={event.id} className="block w-full text-left" onClick={() => navigate(`/event/${event.id}`)}>
                <EventRow event={event} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LegacyDashboard({ navigate }: { navigate: (path: string) => void }) {
  const { elders, events, tasks, conflicts } = useApp();
  const openEvents = events.filter((item) => item.status !== 'closed');
  const pendingApprovals = microRevisionSuggestions.filter((item) => item.status === '待确认').length;
  const overdueTasks = operationsMock.openLoops.filter((item) => item.type === '逾期任务').length;
  return (
    <>
      <Panel title="今日运营驾驶舱">
        <div className="grid gap-4 md:grid-cols-5">
          <Metric label="重点长者" value={operationsMock.focusResidents.length} sub="今日需持续观察" />
          <Metric label="未闭环事项" value={operationsMock.openLoops.length} sub="任务/事件/审批" />
          <Metric label="逾期任务" value={overdueTasks} sub="需要主管介入" />
          <Metric label="待确认建议" value={pendingApprovals} sub="AI 建议不自动生效" />
          <Metric label="开放事件" value={openEvents.length} sub="事件卡片驱动协同" />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <WorkZone kind="human" title="护理主管今天先看什么" subtitle="按未闭环风险、责任人和证据排序，而不是只看静态数字。">
            <div className="grid gap-3">
              {operationsMock.focusResidents.map((item) => (
                <button key={item.elderId} onClick={() => navigate(`/elder/${item.elderId}`)} className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={item.risk === '中高' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{item.risk}</Pill>
                    <span className="font-semibold text-ink">{item.name} · {item.room}</span>
                    <span className="text-xs text-muted">责任人：{item.owner}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                  <div className="mt-2 text-xs text-care">{item.trend}</div>
                </button>
              ))}
            </div>
          </WorkZone>
          <WorkZone kind="ai" title="Cells 建议队列" subtitle="AI 只做观察、提醒和微修订建议，默认进入待确认。">
            <div className="space-y-3">
              {microRevisionSuggestions.map((item) => (
                <button key={item.id} onClick={() => navigate('/plan')} className="block w-full rounded-lg border border-blue-100 bg-white p-3 text-left hover:border-blue-300">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-ink">{item.title}</div>
                    <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">风险 {item.risk} · 置信度 {item.confidence}% · 审批人：{item.approver}</div>
                </button>
              ))}
            </div>
          </WorkZone>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="未闭环事项">
          <div className="grid gap-3">
            {operationsMock.openLoops.map((item) => (
              <button key={`${item.type}-${item.title}`} onClick={() => navigate(item.path)} className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care">
                <div className="flex items-center justify-between">
                  <Pill className="border-slate-200 bg-slate-50 text-slate-700">{item.type}</Pill>
                  <span className="text-xs text-muted">{item.due}</span>
                </div>
                <div className="mt-2 font-semibold text-ink">{item.title}</div>
                <div className="mt-1 text-sm text-muted">责任人：{item.owner}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="交班摘要">
          <div className="grid gap-3 md:grid-cols-3">
            <ShiftSummaryBlock title="夜班遗留" items={operationsMock.shiftSummary.night} />
            <ShiftSummaryBlock title="白班跟进" items={operationsMock.shiftSummary.day} />
            <ShiftSummaryBlock title="重点观察" items={operationsMock.shiftSummary.watch} />
          </div>
          <button className="mt-4 rounded-md border border-care px-3 py-2 text-sm font-medium text-care" onClick={() => navigate('/handover')}>进入交班中心</button>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="家属沟通提醒">
          <div className="space-y-3">
            {operationsMock.familyAlerts.map((item) => (
              <button key={`${item.elder}-${item.issue}`} onClick={() => navigate('/family')} className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{item.elder} · {item.family}</div>
                  <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.issue}</p>
                <div className="mt-1 text-xs text-muted">责任人：{item.owner}</div>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="班组负荷">
          <div className="space-y-3">
            {operationsMock.workload.map((item) => (
              <div key={item.name} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{item.name} · {item.role}</div>
                  <div className="text-sm text-muted">{item.tasks} 项任务 / {item.overdue} 项超时</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className={`h-2 rounded-full ${item.load > 80 ? 'bg-amber-500' : 'bg-care'}`} style={{ width: `${item.load}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="异常事件卡片">
          <div className="space-y-4">
            {openEvents.map((event) => (
              <button key={event.id} className="block w-full text-left" onClick={() => navigate(`/event/${event.id}`)}>
                <EventRow event={event} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="长者 Cells 风险趋势">
          <div className="space-y-4">
            {elders.map((elder) => (
              <ElderCellBars key={elder.id} elder={elder} compact />
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function MyNextStep({ navigate }: { navigate: (path: string) => void }) {
  const { currentUser, assessments, tasks, carePlans } = useApp();
  const myAssessment = assessments.find((item) => item.role === currentUser?.role && item.status === 'waiting');
  const myTask = tasks.find((item) => item.role === currentUser?.role && item.status !== 'done');
  const approvalCount = carePlans.flatMap((plan) => plan.items).filter((item) => item.requiresApproval && item.approvalStatus === 'pending').length;

  let title = '查看当前协同事件';
  let detail = '先从开放事件进入，查看触发证据、角色分工和当前处理状态。';
  let path = '/events';

  if (myAssessment) {
    title = '提交专业评估';
    detail = `${roleLabels[myAssessment.role]}还有一份评估待提交，提交后会进入冲突检测和统一方案。`;
    path = '/assessments';
  } else if (currentUser?.role && ['doctor', 'rehab', 'pharmacist', 'admin'].includes(currentUser.role) && approvalCount > 0) {
    title = '处理人工确认';
    detail = `${approvalCount} 个医疗、用药或康复强度相关方案项等待确认。`;
    path = '/approval';
  } else if (myTask) {
    title = '完成我的任务';
    detail = `${myTask.title}，截止 ${myTask.due}。`;
    path = '/tasks';
  }

  return (
    <section className="rounded-lg border border-teal-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-care">我的下一步</div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{detail}</p>
        </div>
        <button className="rounded-md bg-care px-4 py-2 text-sm font-medium text-white" onClick={() => navigate(path)}>
          进入处理
        </button>
      </div>
    </section>
  );
}

function ProcessBoard({ navigate }: { navigate: (path: string) => void }) {
  const { events, assessments, conflicts, carePlans, tasks } = useApp();
  const steps = [
    { label: '观察录入', value: '护理员记录', path: '/record', active: true },
    { label: '事件识别', value: `${events.filter((item) => item.status !== 'closed').length} 个开放`, path: '/events', active: events.some((item) => item.status !== 'closed') },
    { label: '专业评估', value: `${assessments.filter((item) => item.status === 'submitted').length}/${assessments.length} 已提交`, path: '/assessments', active: assessments.some((item) => item.status === 'waiting') },
    { label: '冲突协调', value: `${conflicts.filter((item) => !item.resolved).length} 个待处理`, path: '/conflicts', active: conflicts.some((item) => !item.resolved) },
    { label: '统一方案', value: carePlans[0]?.confirmed ? '已确认' : '待确认', path: '/plan', active: !carePlans[0]?.confirmed },
    { label: '任务闭环', value: `${tasks.filter((item) => item.status === 'done').length}/${tasks.length} 已完成`, path: '/tasks', active: tasks.some((item) => item.status !== 'done') },
  ];

  return (
    <Panel title="协同流程看板">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((step, index) => (
          <button
            key={step.label}
            className={`rounded-lg border p-4 text-left transition hover:border-care hover:bg-teal-50 ${
              step.active ? 'border-care bg-teal-50/60' : 'border-slate-200 bg-white'
            }`}
            onClick={() => navigate(step.path)}
          >
            <div className="flex items-center justify-between">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-care text-xs font-semibold text-white">{index + 1}</span>
              <span className={`h-2 w-2 rounded-full ${step.active ? 'bg-care' : 'bg-slate-300'}`} />
            </div>
            <div className="mt-4 font-semibold text-ink">{step.label}</div>
            <div className="mt-1 text-xs text-muted">{step.value}</div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ActiveEventWorkspace({ event, navigate }: { event: CareEvent; navigate: (path: string) => void }) {
  const { elders, assessments, conflicts, carePlans } = useApp();
  const elder = elders.find((item) => item.id === event.elderId);
  const plan = carePlans.find((item) => item.eventId === event.id);
  return (
    <Panel title="当前事件工作台" action={<button className="text-sm font-medium text-care" onClick={() => navigate(`/event/${event.id}`)}>打开事件详情</button>}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-ink">{elder?.name} · {elder?.room}</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">{event.title}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill className={roleTone[event.mainRole]}>牵头：{roleLabels[event.mainRole]}</Pill>
            <EventStatus status={event.status} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-ink">专业输入</div>
          <div className="mt-3 space-y-2">
            {assessments.filter((item) => item.eventId === event.id).slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{roleLabels[item.role]}</span>
                <Pill className={item.status === 'submitted' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                  {item.status === 'submitted' ? '已提交' : '待提交'}
                </Pill>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-semibold text-ink">方案状态</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between"><span>待协调冲突</span><strong className="text-ink">{conflicts.filter((item) => item.eventId === event.id && !item.resolved).length}</strong></div>
            <div className="flex justify-between"><span>需人工确认</span><strong className="text-ink">{plan?.items.filter((item) => item.requiresApproval && item.approvalStatus === 'pending').length ?? 0}</strong></div>
            <div className="flex justify-between"><span>方案确认</span><strong className="text-ink">{plan?.confirmed ? '已完成' : '未完成'}</strong></div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function GuideStep({ number, title, path, navigate }: { number: string; title: string; path: string; navigate: (path: string) => void }) {
  return (
    <button onClick={() => navigate(path)} className="rounded-lg border border-teal-200 bg-white p-4 text-left hover:border-care hover:bg-teal-50">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-care text-sm font-semibold text-white">{number}</span>
        <span className="text-sm font-semibold leading-5 text-ink">{title}</span>
      </div>
    </button>
  );
}

function QuickNav({ title, desc, path, navigate }: { title: string; desc: string; path: string; navigate: (path: string) => void }) {
  return (
    <button onClick={() => navigate(path)} className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care hover:bg-teal-50">
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-1 text-sm text-muted">{desc}</div>
    </button>
  );
}

function ShiftSummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700">{item}</div>
        ))}
      </div>
    </div>
  );
}

function CellsProfileGroup({ title, items }: { title: string; items: { title: string; value: string; evidence: string; confirmed: boolean }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={`${title}-${item.title}`} className="rounded-md bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-ink">{item.title}：{item.value}</div>
              <Pill className={item.confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                {item.confirmed ? '已确认' : '待确认'}
              </Pill>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">证据：{item.evidence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreferenceCard({ item }: { item: { type: string; title: string; detail: string; status: string } }) {
  const tone =
    item.type === '硬性安全约束'
      ? 'border-red-200 bg-red-50 text-red-700'
      : item.type === '可执行个性化偏好'
        ? 'border-teal-200 bg-teal-50 text-care'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={tone}>{item.type}</Pill>
        <Pill className="border-slate-200 bg-white text-slate-600">{item.status}</Pill>
      </div>
      <div className="mt-2 font-semibold text-ink">{item.title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
    </div>
  );
}

function SuggestionMiniCard({ item }: { item: (typeof microRevisionSuggestions)[number] }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-ink">{item.title}</div>
        <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
      <div className="mt-2 text-xs text-muted">审批人：{item.approver} · 执行人：{item.executor} · 置信度 {item.confidence}%</div>
    </div>
  );
}

function MicroRevisionCard({ item }: { item: (typeof microRevisionSuggestions)[number] }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{item.title}</h3>
        <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3">
          <div className="text-xs text-muted">原方案</div>
          <div className="mt-1 text-sm text-slate-700">{item.original}</div>
        </div>
        <div className="rounded-md bg-teal-50 p-3">
          <div className="text-xs text-care">建议调整后</div>
          <div className="mt-1 text-sm text-slate-700">{item.revised}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">触发原因：{item.reason}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Info label="风险级别" value={item.risk} />
        <Info label="置信度" value={`${item.confidence}%`} />
        <Info label="工作量影响" value={item.workload} />
      </div>
      <div className="mt-3 text-xs text-muted">证据：{item.evidence.join('；')}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white">采纳</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">修改后采纳</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">驳回</button>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

function ElderList({ navigate }: { navigate: (path: string) => void }) {
  const { elders } = useApp();
  return (
    <Panel title="老人列表">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">姓名</th>
              <th className="px-4 py-3">房间</th>
              <th className="px-4 py-3">护理等级</th>
              <th className="px-4 py-3">风险</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {elders.map((elder) => (
              <tr key={elder.id}>
                <td className="px-4 py-3 font-medium text-ink">{elder.name}</td>
                <td className="px-4 py-3">{elder.room}</td>
                <td className="px-4 py-3">{elder.careLevel}</td>
                <td className="px-4 py-3">{elder.cells.risk}</td>
                <td className="px-4 py-3"><StatusPill status={elder.status} /></td>
                <td className="px-4 py-3">
                  <button className="text-care hover:underline" onClick={() => navigate(`/elder/${elder.id}`)}>查看详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ElderDetail({ elderId }: { elderId: string }) {
  const { elders, records, events, carePlans } = useApp();
  const elder = elders.find((item) => item.id === elderId) ?? elders[0];
  const elderRecords = records.filter((item) => item.elderId === elder.id);
  const elderEvents = events.filter((item) => item.elderId === elder.id);
  const currentPlan = carePlans.find((plan) => elderEvents.some((event) => event.id === plan.eventId));
  return (
    <div className="space-y-5">
      <Panel title={`${elder.name} · 长者 Cells 档案`}>
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-sm text-muted">基础信息</div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Info label="房间" value={elder.room} />
              <Info label="年龄" value={`${elder.age} 岁`} />
              <Info label="照护等级" value={elder.careLevel} />
              <Info label="责任护士" value={elder.primaryNurse} />
            </div>
            <div className="mt-4 text-sm text-muted">主要诊断/风险标签</div>
            <div className="mt-2 flex flex-wrap gap-2">{elder.diagnoses.map((d) => <Pill key={d} className="border-slate-200 bg-slate-50 text-slate-700">{d}</Pill>)}</div>
          </div>
          <ElderCellBars elder={elder} />
        </div>
      </Panel>

      <Panel title="当前状态摘要">
        <div className="grid gap-3 md:grid-cols-4">
          {['饮食：连续下降', '睡眠：夜醒增加', '活动：晨起扶墙', '家属沟通：待回复'].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-ink">{item}</div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Cells 画像">
          <div className="grid gap-4 md:grid-cols-2">
            <CellsProfileGroup title="健康 Cells" items={cellsProfileMock.health} />
            <CellsProfileGroup title="行为 Cells" items={cellsProfileMock.behavior} />
            <CellsProfileGroup title="情绪 Cells" items={cellsProfileMock.emotion} />
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-semibold text-ink">证据链规则</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">每条画像都必须能追溯到护理记录、任务反馈、异常事件或家属沟通，AI 只负责归并和提示，不能自动生效。</p>
            </div>
          </div>
        </Panel>
        <Panel title="偏好卡与个性化任务">
          <div className="space-y-3">
            {cellsProfileMock.preferences.map((item) => (
              <PreferenceCard key={`${item.type}-${item.title}`} item={item} />
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="当前照护方案与微修订建议">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <WorkZone kind="context" title="标准照护模板 + 当前方案" subtitle="来自照护等级和机构 SOP，个体调整必须经过审批。">
            <div className="space-y-2">
              {(currentPlan?.items ?? []).map((item) => (
                <div key={item.id} className="rounded-md bg-white p-3">
                  <Pill className={roleTone[item.role]}>{cnRoleLabels[item.role]}</Pill>
                  <div className="mt-2 font-medium text-ink">{item.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </WorkZone>
          <WorkZone kind="ai" title="AI 微修订建议" subtitle="建议带证据、置信度、工作量和审批人，默认待确认。">
            <div className="space-y-3">
              {microRevisionSuggestions.map((item) => <SuggestionMiniCard key={item.id} item={item} />)}
            </div>
          </WorkZone>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Cells 观察时间线">
          <RecordTimeline records={elderRecords} />
        </Panel>
        <Panel title="异常事件历史">
          <div className="space-y-3">{elderEvents.map((event) => <EventRow key={event.id} event={event} />)}</div>
        </Panel>
      </div>
    </div>
  );
}

function DailyRecordPage() {
  const { elders, addRecord, can } = useApp();
  const [elderId, setElderId] = useState(elders[0]?.id ?? '');
  const [recordType, setRecordType] = useState('饮食');
  const [flags, setFlags] = useState<string[]>(['食欲下降', '需要护士查看']);
  const [note, setNote] = useState('早餐只吃了三分之一，起身时扶墙，已协助坐稳。');
  const [voiceNote, setVoiceNote] = useState('语音备注占位：长按后说出现场情况，系统自动转结构化记录。');
  const toggle = (flag: string) => setFlags((prev) => (prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]));
  return (
    <Panel title="护理员低摩擦现场记录">
      <AiNotice />
      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <WorkZone kind="human" title="30 秒完成现场记录" subtitle="少量结构化字段 + 快捷标签 + 语音/拍照占位，避免为系统增加额外填报负担。">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-ink">
                长者
                <select className="focus-ring mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={elderId} onChange={(e) => setElderId(e.target.value)}>
                  {elders.map((elder) => <option key={elder.id} value={elder.id}>{elder.name} · {elder.room}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink">
                记录类型
                <select className="focus-ring mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={recordType} onChange={(e) => setRecordType(e.target.value)}>
                  {['饮食', '睡眠', '排便', '情绪', '活动', '用药执行', '异常上报', '家属诉求'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-ink">快捷标记</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {['正常完成', '食欲下降', '夜醒增加', '步态不稳', '情绪低落', '拒绝护理', '家属询问', '需要护士查看', '加入交班'].map((flag) => (
                  <button key={flag} className={`rounded-md border px-3 py-2 text-sm ${flags.includes(flag) ? 'border-care bg-teal-50 text-care' : 'border-slate-200 bg-white text-slate-600'}`} onClick={() => toggle(flag)}>
                    {flag}
                  </button>
                ))}
              </div>
            </div>
            <textarea className="focus-ring h-24 w-full rounded-md border border-slate-200 px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid gap-3 md:grid-cols-2">
              <button className="rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700" onClick={() => setVoiceNote('已模拟语音转写：老人早餐少量，起身扶墙，需要护士查看。')}>语音备注</button>
              <button className="rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700">拍照凭证</button>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{voiceNote}</div>
            <button
              disabled={!can('record:create')}
              className="rounded-md bg-care px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => addRecord({ elderId, appetite: recordType === '饮食' ? '较昨日下降' : '未记录', sleep: flags.includes('夜醒增加') ? '夜醒增加' : '未记录', mobility: flags.includes('步态不稳') ? '步态不稳' : '未记录', mood: flags.includes('情绪低落') ? '沉默少语' : '平稳', vitals: '待护士复核', note, abnormalFlags: flags.filter((item) => item !== '正常完成') })}
            >
              提交并自动结构化
            </button>
            {!can('record:create') && <p className="text-sm text-amber-700">当前角色无现场记录录入权限。</p>}
          </div>
        </WorkZone>
        <WorkZone kind="ai" title="Cells 结构化结果预览" subtitle="AI 把现场碎片整理成事件线索，但不会自动做医疗判断。">
          <div className="space-y-3">
            <Info label="观察类型" value={recordType} />
            <Info label="异常标签" value={flags.join('、') || '无'} />
            <Info label="可能流向" value={flags.includes('加入交班') ? '交班中心' : flags.includes('需要护士查看') ? '护士复核' : '仅记录'} />
            <div className="rounded-md border border-blue-100 bg-white p-3 text-sm leading-6 text-slate-700">
              若连续两天出现食欲下降、夜醒增加或步态不稳，系统将建议创建异常事件卡片，并带上原始记录作为证据。
            </div>
          </div>
        </WorkZone>
      </div>
    </Panel>
  );
}

function EventsPage({ navigate }: { navigate: (path: string) => void }) {
  const { events, elders } = useApp();
  return (
    <Panel title="协同事件列表">
      <div className="grid gap-3">
        {events.map((event) => {
          const elder = elders.find((item) => item.id === event.elderId);
          return (
            <button key={event.id} className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-care" onClick={() => navigate(`/event/${event.id}`)}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-ink">{event.title}</div>
                  <div className="mt-1 text-sm text-muted">{elder?.name} · {event.createdAt}</div>
                </div>
                <EventStatus status={event.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{event.aiSummary}</p>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function EventDetail({ eventId }: { eventId: string }) {
  const { events, elders, assessments, closeEvent, can, tasks } = useApp();
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const elder = elders.find((item) => item.id === event.elderId);
  const eventTasks = tasks.filter((item) => item.eventId === event.id);
  const allDone = eventTasks.length > 0 && eventTasks.every((item) => item.status === 'done');
  return (
    <div className="space-y-5">
      <AiNotice />
      <Panel title={event.title} action={<EventStatus status={event.status} />}>
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="text-sm text-muted">老人</div>
            <div className="mt-1 text-lg font-semibold text-ink">{elder?.name} · {elder?.room}</div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{event.aiSummary}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-medium text-ink">触发证据</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {event.triggerEvidence.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
        </div>
      </Panel>
      <Panel title="角色生成">
        <div className="flex flex-wrap gap-2">
          <Pill className={roleTone[event.mainRole]}>主线角色：{roleLabels[event.mainRole]}</Pill>
          {event.supportRoles.map((role) => <Pill key={role} className={roleTone[role]}>辅助：{roleLabels[role]}</Pill>)}
        </div>
      </Panel>
      <Panel title="评估提交状态">
        <div className="grid gap-3 md:grid-cols-3">
          {assessments.filter((item) => item.eventId === event.id).map((item) => <AssessmentMini key={item.id} assessment={item} />)}
        </div>
      </Panel>
      <button
        disabled={!allDone || !can('event:close')}
        className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        onClick={() => closeEvent(event.id)}
      >
        事件复盘并关闭
      </button>
    </div>
  );
}

function AssessmentsPage() {
  const { assessments, submitAssessment, can, currentUser } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiQuestion, setAiQuestion] = useState('请帮我检查：我还缺少哪些上游输入，提交评估前需要注意什么？');
  const role = currentUser?.role ?? 'caregiver';
  const workflow = roleWorkflows[role];
  const relevantRoles = new Set<Role>([role, ...workflow.upstream.map((item) => item.role), ...workflow.downstream.map((item) => item.role)]);
  const visibleAssessments = assessments.filter((assessment) => relevantRoles.has(assessment.role));
  const myAssessment = assessments.find((assessment) => assessment.role === role);
  return (
    <div className="space-y-5">
      <Panel title={`${roleLabels[role]}评估工作台`}>
        <AiNotice />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <WorkZone kind="human" title="我的人工工作流程" subtitle="这里是当前登录用户本人要参与、判断、提交或交接的内容。">
            <div className="rounded-md bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-care">我的职责</div>
              <h3 className="mt-1 text-lg font-semibold text-ink">{workflow.scopeTitle}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-700">{workflow.responsibility}</p>
              <div className="mt-4">
                <div className="text-sm font-semibold text-ink">我需要交付</div>
                <div className="mt-2 space-y-2">
                  {workflow.outputs.map((item) => (
                    <div key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </WorkZone>
          <WorkZone kind="context" title="只读协同上下文" subtitle="这里不是我要替别人处理的流程，只展示和我直接相关的上游输入、下游交接与风险边界。">
            <div className="grid gap-3 md:grid-cols-2">
              <RoleRelationBox title="我需要谁的输入" items={workflow.upstream} emptyText="当前角色是信息源，不依赖其他角色输入。" />
              <RoleRelationBox title="我交接给谁" items={workflow.downstream.map((item) => ({ role: item.role, input: item.handoff }))} emptyText="当前角色暂无下游交接。" />
            </div>
            <div className="mt-4 rounded-md border border-amber-200 bg-white p-3">
              <div className="text-sm font-semibold text-amber-900">我的风险边界</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {workflow.boundaries.map((item) => <Pill key={item} className="border-amber-200 bg-amber-50 text-amber-800">{item}</Pill>)}
              </div>
            </div>
          </WorkZone>
        </div>
      </Panel>

      <Panel title="我的评估表单">
        {myAssessment ? (
          <RoleAssessmentEditor
            assessment={myAssessment}
            editable={can('assessment:submit') && (currentUser?.role === myAssessment.role || currentUser?.role === 'admin')}
            value={drafts[myAssessment.id] ?? myAssessment.professionalOpinion}
            onChange={(value) => setDrafts((prev) => ({ ...prev, [myAssessment.id]: value }))}
            onSubmit={() => submitAssessment(myAssessment.id, drafts[myAssessment.id] ?? myAssessment.professionalOpinion)}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">当前角色在这个事件中没有待提交的专业评估。</div>
        )}
      </Panel>

      <Panel title="我与角色 AI 交互">
        <WorkZone kind="chat" title="向我的角色 AI 追问或修订" subtitle="这里是人机协作区：AI 可以帮我检查遗漏、整理结构，但不能替我提交，也不能越权确认医疗、用药或康复调整。">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                {['检查缺少的上游输入', '把我的意见整理成结构化评估', '提醒需要人工确认的风险点'].map((item) => (
                  <button key={item} className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-800" onClick={() => setAiQuestion(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <textarea className="focus-ring h-28 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} />
              <button className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white">生成辅助回复</button>
            </div>
            <div className="rounded-md border border-amber-200 bg-white p-4">
              <div className="text-sm font-semibold text-ink">角色 AI 辅助回复示例</div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                建议先核对上游输入是否齐全，再提交人工评估。当前角色需要关注：{workflow.outputs.slice(0, 2).join('、')}。涉及医疗、用药或康复强度调整时，请标记“需人工确认”。
              </p>
            </div>
          </div>
        </WorkZone>
      </Panel>

      <Panel title="相关角色状态">
        <div className="grid gap-3 lg:grid-cols-3">
          {visibleAssessments.map((assessment) => (
            <div key={assessment.id} className={`rounded-lg border p-4 ${assessment.role === role ? 'border-care bg-teal-50/60' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between">
                <Pill className={roleTone[assessment.role]}>{roleLabels[assessment.role]}</Pill>
                <span className="text-xs text-muted">{assessment.status === 'submitted' ? '已提交' : '待提交'}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-ink">{assessment.focus}</div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{assessment.professionalOpinion || assessment.aiSummary}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RoleRelationBox({ title, items, emptyText }: { title: string; items: { role: Role; input: string }[]; emptyText: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.role}-${item.input}`} className="rounded-md bg-white p-3">
              <Pill className={roleTone[item.role]}>{roleLabels[item.role]}</Pill>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.input}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RoleAssessmentEditor({
  assessment,
  editable,
  value,
  onChange,
  onSubmit,
}: {
  assessment: ReturnType<typeof useApp>['assessments'][number];
  editable: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <WorkZone kind="ai" title="我的角色 AI 输出" subtitle="这是系统按当前角色视角生成的辅助解释，只能参考，不能自动提交。">
        <div className="rounded-md bg-white p-4">
          <div className="flex items-center justify-between">
            <Pill className={roleTone[assessment.role]}>{roleLabels[assessment.role]} · {assessment.assignee}</Pill>
            <span className="text-xs text-muted">AI 置信度 {assessment.confidence}%</span>
          </div>
          <h3 className="mt-3 font-semibold text-ink">{assessment.focus}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{assessment.aiSummary}</p>
        </div>
      </WorkZone>
      <WorkZone kind="human" title="我本人提交的专业意见" subtitle="这里才是当前用户要填写和提交的人工评估，会进入审计日志和后续照护方案。">
        <textarea
          className="focus-ring h-32 w-full rounded-md border border-teal-200 bg-white px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!editable}
          placeholder="只填写本角色专业意见：观察信号、可能解释、需要谁补充什么、建议交接给谁"
        />
        <button className="mt-3 rounded-md bg-care px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!editable} onClick={onSubmit}>
          提交我的评估
        </button>
      </WorkZone>
    </div>
  );
}

function DependencyPage() {
  const { events, currentUser, assessments, tasks, carePlans } = useApp();
  const [chainQuestion, setChainQuestion] = useState('请说明当前链路里，我这一步为什么被卡住，以及下一步该做什么。');
  const event = events[0];
  const role = currentUser?.role ?? 'caregiver';
  const workflow = roleWorkflows[role];
  const myAssessment = assessments.find((item) => item.role === role);
  const myTasks = tasks.filter((item) => item.role === role && item.status !== 'done');
  const pendingApprovals = carePlans.flatMap((plan) => plan.items).filter((item) => item.requiresApproval && item.approvalStatus === 'pending');
  const needsApproval = ['doctor', 'pharmacist', 'rehab'].includes(role) && pendingApprovals.length > 0;

  const chainNodes = [
    ...workflow.upstream.map((item) => ({
      role: item.role,
      title: '上游输入',
      text: item.input,
      status: 'done' as const,
    })),
    {
      role,
      title: '我的处理',
      text: workflow.responsibility,
      status: myAssessment?.status === 'submitted' ? ('done' as const) : ('active' as const),
    },
    ...workflow.downstream.map((item) => ({
      role: item.role,
      title: '下游交接',
      text: item.handoff,
      status: myAssessment?.status === 'submitted' ? ('active' as const) : ('waiting' as const),
    })),
  ];

  const doneCount = chainNodes.filter((item) => item.status === 'done').length;
  const progress = Math.round((doneCount / Math.max(chainNodes.length, 1)) * 100);
  const todos = [
    ...(myAssessment?.status !== 'submitted' ? [{ title: '提交本角色专业评估', detail: workflow.scopeTitle, path: '#/assessments' }] : []),
    ...(needsApproval ? [{ title: '处理人工确认', detail: `${pendingApprovals.length} 个方案项等待确认`, path: '#/approval' }] : []),
    ...myTasks.map((task) => ({ title: task.title, detail: `截止 ${task.due}`, path: '#/tasks' })),
  ];

  return (
    <div className="space-y-5">
      <Panel title={`${roleLabels[role]}链路图`}>
        <AiNotice />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
          <WorkZone kind="human" title="我本人参与的工作链路" subtitle="这张图只表示当前角色本人需要等待、处理、交接的人工流程。">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-care">当前事件链路</div>
                  <h3 className="mt-1 font-semibold text-ink">{event.title}</h3>
                </div>
                <Pill className={roleTone[role]}>{roleLabels[role]}视角</Pill>
              </div>
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {chainNodes.map((node, index) => (
                  <div key={`${node.role}-${index}`} className="relative">
                    <VisualChainNode node={node} currentRole={role} index={index} />
                    {index < chainNodes.length - 1 && <div className="hidden lg:block absolute left-[calc(100%-4px)] top-1/2 z-10 h-0.5 w-5 bg-slate-300" />}
                  </div>
                ))}
              </div>
            </div>
          </WorkZone>

          <WorkZone kind="human" title="我的完成进度" subtitle="这里统计的是当前角色链路节点和待办，不是 AI 输出。">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-ink">完成进度</div>
              <span className="text-2xl font-semibold text-care">{progress}%</span>
            </div>
            <div className="mt-4 h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-care" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <ProgressLegend label="已完成" count={chainNodes.filter((item) => item.status === 'done').length} tone="bg-emerald-50 text-emerald-700" />
              <ProgressLegend label="进行中" count={chainNodes.filter((item) => item.status === 'active').length} tone="bg-teal-50 text-care" />
              <ProgressLegend label="等待" count={chainNodes.filter((item) => item.status === 'waiting').length} tone="bg-slate-100 text-slate-600" />
            </div>
          </WorkZone>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="我的待办">
          <WorkZone kind="human" title="我本人现在要处理" subtitle="这些是当前用户可以点击进入处理的任务或确认动作。">
            <div className="space-y-3">
              {todos.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-white p-4 text-sm text-emerald-700">当前角色暂无待办，等待下游反馈或事件复盘。</div>
              ) : (
                todos.map((todo) => (
                  <a key={`${todo.title}-${todo.detail}`} href={todo.path} className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-care hover:bg-teal-50">
                    <div className="font-semibold text-ink">{todo.title}</div>
                    <div className="mt-1 text-sm text-muted">{todo.detail}</div>
                  </a>
                ))
              )}
            </div>
          </WorkZone>
        </Panel>

        <Panel title="角色 AI 输出与交互">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <WorkZone kind="ai" title="角色 AI 链路解释" subtitle="这里是 AI 对依赖、产出和风险边界的整理，供我参考，不代表已人工确认。">
              <div className="grid gap-4 lg:grid-cols-3">
                <DependencyMiniChart title="输入是否齐全" items={workflow.upstream.map((item) => `${roleLabels[item.role]}：${item.input}`)} empty="当前角色无需等待上游输入" tone="teal" />
                <DependencyMiniChart title="完成后产出" items={workflow.outputs} tone="blue" />
                <DependencyMiniChart title="风险边界" items={workflow.boundaries} tone="amber" />
              </div>
            </WorkZone>
            <WorkZone kind="chat" title="我与 AI 讨论链路" subtitle="这里用于追问为什么依赖某个角色、如何补齐输入、是否触发人工确认。">
              <textarea className="focus-ring h-28 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm" value={chainQuestion} onChange={(event) => setChainQuestion(event.target.value)} />
              <button className="mt-3 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white">询问角色 AI</button>
              <div className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                AI 会先说明当前角色的上游依赖，再提示哪些内容需要人工确认。它不会替你提交评估或绕过医生确认。
              </div>
            </WorkZone>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function VisualChainNode({
  node,
  currentRole,
  index,
}: {
  node: { role: Role; title: string; text: string; status: 'done' | 'active' | 'waiting' };
  currentRole: Role;
  index: number;
}) {
  const statusStyle = {
    done: 'border-emerald-300 bg-emerald-50',
    active: 'border-care bg-teal-50 shadow-soft',
    waiting: 'border-slate-200 bg-white',
  }[node.status];
  const dotStyle = {
    done: 'bg-emerald-500',
    active: 'bg-care',
    waiting: 'bg-slate-300',
  }[node.status];
  const statusText = { done: '已完成', active: '进行中', waiting: '等待' }[node.status];
  return (
    <div className={`min-h-48 rounded-lg border p-4 ${statusStyle}`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${dotStyle}`}>{index + 1}</span>
        <span className="text-xs font-medium text-slate-500">{statusText}</span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Pill className={roleTone[node.role]}>{roleLabels[node.role]}</Pill>
        {node.role === currentRole && <Pill className="border-teal-200 bg-white text-care">我</Pill>}
      </div>
      <div className="mt-3 font-semibold text-ink">{node.title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{node.text}</p>
    </div>
  );
}

function ProgressLegend({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className={`rounded-md px-3 py-2 ${tone}`}>
      <div className="text-lg font-semibold">{count}</div>
      <div>{label}</div>
    </div>
  );
}

function DependencyMiniChart({ title, items, empty, tone }: { title: string; items: string[]; empty?: string; tone: 'teal' | 'blue' | 'amber' }) {
  const toneClass = {
    teal: 'bg-teal-50 border-teal-100 text-care',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
  }[tone];
  const displayItems = items.length > 0 ? items : [empty ?? '暂无'];
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="font-semibold text-ink">{title}</div>
      <div className="mt-3 space-y-2">
        {displayItems.map((item) => (
          <div key={item} className={`rounded-md border p-3 text-sm leading-6 ${toneClass}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function ConflictsPage() {
  const { conflicts, resolveConflict, events, elders, carePlans, currentUser } = useApp();
  const role = currentUser?.role ?? 'caregiver';
  const visibleConflicts = role === 'admin' ? conflicts : conflicts.filter((conflict) => conflict.roles.includes(role));
  return (
    <div className="space-y-5">
      <Panel title="冲突检测：老人、事件与方案定位">
        <AiNotice />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Metric label="推送给我" value={visibleConflicts.length} sub={role === 'admin' ? '管理员查看全部冲突' : '仅包含当前角色职责'} />
          <Metric label="全院冲突" value={conflicts.length} sub="仅管理员需要全量知晓" />
          <Metric label="待处理" value={visibleConflicts.filter((item) => !item.resolved).length} sub="与当前视角相关" />
        </div>
        <div className="mt-5 grid gap-4">
          {visibleConflicts.length === 0 && (
            <WorkZone kind="context" title="当前角色暂无冲突推送" subtitle="系统只把冲突推送给职责相关角色；管理员可以查看所有冲突事件。">
              <div className="rounded-md bg-white p-4 text-sm leading-6 text-slate-700">
                当前登录角色是 {roleLabels[role]}，暂时没有需要你处理或知晓的冲突。你仍然可以在照护方案、任务中心查看自己的工作项。
              </div>
            </WorkZone>
          )}
          {visibleConflicts.map((conflict) => {
            const event = events.find((item) => item.id === conflict.eventId);
            const elder = elders.find((item) => item.id === event?.elderId);
            const plan = carePlans.find((item) => item.eventId === conflict.eventId);
            const relatedPlanItems = plan?.items.filter((item) => conflict.roles.includes(item.role)) ?? [];
            const isMyRole = conflict.roles.includes(role);
            const canHandle = role === 'admin' || isMyRole;
            return (
              <div key={conflict.id} className={`rounded-lg border p-4 ${isMyRole ? 'border-care bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className={conflict.severity === 'high' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{conflict.severity}</Pill>
                      <Pill className={isMyRole ? 'border-teal-200 bg-white text-care' : 'border-slate-200 bg-slate-50 text-slate-600'}>{role === 'admin' && !isMyRole ? '管理员知晓' : '与我相关'}</Pill>
                      <Pill className={conflict.resolved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}>{conflict.resolved ? '已处理' : '待处理'}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-ink">{conflict.title}</h3>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div><span className="text-muted">老人：</span>{elder?.name ?? '未知'} · {elder?.room ?? '-'}</div>
                    <div className="mt-1"><span className="text-muted">事件：</span>{event?.title ?? conflict.eventId}</div>
                    <div className="mt-1"><span className="text-muted">方案：</span>{plan?.goal ?? '未生成方案'}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <WorkZone kind="ai" title="AI 检测到的冲突" subtitle="说明哪几个专业建议之间存在风险，不能直接拼接执行。">
                    <p className="text-sm leading-6 text-slate-700">{conflict.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{conflict.roles.map((item) => <Pill key={item} className={roleTone[item]}>{roleLabels[item]}</Pill>)}</div>
                  </WorkZone>
                  <WorkZone kind="human" title="需要人工处理的方案项" subtitle="这里定位到具体照护方案动作，明确谁需要确认或调整。">
                    <div className="space-y-2">
                      {relatedPlanItems.length > 0 ? relatedPlanItems.map((item) => (
                        <div key={item.id} className="rounded-md bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Pill className={roleTone[item.role]}>{roleLabels[item.role]}</Pill>
                            <Pill className={item.requiresApproval ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                              {item.requiresApproval ? `需确认 · ${item.approvalStatus}` : '可执行'}
                            </Pill>
                          </div>
                          <div className="mt-2 font-medium text-ink">{item.title}</div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                        </div>
                      )) : <div className="rounded-md bg-white p-3 text-sm text-slate-600">暂无已生成的相关方案项。</div>}
                    </div>
                  </WorkZone>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-ink">处理建议</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{conflict.recommendation}</p>
                  <button className="mt-4 rounded-md border border-care px-3 py-2 text-sm font-medium text-care disabled:border-slate-200 disabled:text-slate-400" disabled={conflict.resolved || !canHandle} onClick={() => resolveConflict(conflict.id)}>
                    {canHandle ? '纳入方案并标记处理' : '当前角色只读'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function CarePlanPage() {
  const { carePlans, confirmPlan, can, currentUser, events, elders } = useApp();
  const plan = carePlans[0];
  const event = events.find((item) => item.id === plan.eventId);
  const elder = elders.find((item) => item.id === event?.elderId);
  const role = currentUser?.role ?? 'caregiver';
  const myItems = plan.items.filter((item) => item.role === role);
  const allApproved = plan.items.every((item) => !item.requiresApproval || item.approvalStatus === 'approved');
  return (
    <div className="space-y-5">
      <Panel title="照护方案编辑与微修订建议">
        <AiNotice />
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-care">基于现有照护等级模板做小范围调整</div>
              <h3 className="mt-1 text-lg font-semibold text-ink">{event?.title ?? plan.goal}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {elder?.name ? `${elder.name} · ${elder.room}：` : ''}Cells 不直接替代照护方案，只在标准模板基础上提出可审批、可执行、可复盘的微修订。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill className={roleTone[role]}>{cnRoleLabels[role]}视角</Pill>
              <Pill className="border-amber-200 bg-amber-50 text-amber-700">AI 建议默认待确认</Pill>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <WorkZone kind="context" title="原照护方案" subtitle="来自照护等级模板和当前事件方案，作为微修订的基线。">
            <div className="space-y-3">
              {plan.items.map((item) => (
                <div key={item.id} className={`rounded-md border p-3 ${item.role === role ? 'border-care bg-teal-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <Pill className={roleTone[item.role]}>{cnRoleLabels[item.role]}</Pill>
                    <Pill className={item.requiresApproval ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{item.requiresApproval ? item.approvalStatus : '可执行'}</Pill>
                  </div>
                  <div className="mt-2 font-semibold text-ink">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </WorkZone>

          <WorkZone kind="ai" title="Cells 微修订建议队列" subtitle="每条建议必须带证据、风险、工作量、审批人和执行人，不能自动生效。">
            <div className="space-y-3">
              {microRevisionSuggestions.map((item) => <MicroRevisionCard key={item.id} item={item} />)}
            </div>
          </WorkZone>
        </div>
      </Panel>

      <Panel title={`${cnRoleLabels[role]}闭环动作`}>
        <WorkZone kind="human" title="我现在需要做什么" subtitle="只显示当前角色相关的方案动作；管理者可以在审批页查看全局。">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md bg-white p-3">
              <div className="text-xs text-muted">我的方案项</div>
              <div className="mt-1 text-lg font-semibold text-ink">{myItems.length}</div>
            </div>
            <a href="#/approval" className="rounded-md border border-teal-200 bg-white p-3 text-sm font-medium text-care">查看待审批建议</a>
            <button className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!allApproved || plan.confirmed || !can('plan:confirm')} onClick={() => confirmPlan(plan.id)}>确认方案并生成任务</button>
          </div>
        </WorkZone>
      </Panel>
    </div>
  );
}

function DecisionManagementPage() {
  const { currentUser, carePlans, events, elders, conflicts, tasks } = useApp();
  const role = currentUser?.role ?? 'caregiver';
  const decisions = carePlans.flatMap((plan) => {
    const event = events.find((item) => item.id === plan.eventId);
    const elder = elders.find((item) => item.id === event?.elderId);
    return plan.items.map((item) => {
      const relatedConflict = conflicts.find((conflict) => conflict.eventId === plan.eventId && conflict.roles.includes(item.role));
      const relatedTasks = tasks.filter((task) => task.eventId === plan.eventId && task.role === item.role);
      return {
        id: `${plan.id}-${item.id}`,
        plan,
        item,
        event,
        elder,
        conflict: relatedConflict,
        tasks: relatedTasks,
      };
    });
  });
  const visibleDecisions = role === 'admin' ? decisions : decisions.filter((decision) => decision.item.role === role || decision.conflict?.roles.includes(role));
  const pending = visibleDecisions.filter((decision) => decision.item.requiresApproval && decision.item.approvalStatus === 'pending').length;
  const active = visibleDecisions.filter((decision) => decision.tasks.some((task) => task.status !== 'done')).length;
  const completed = visibleDecisions.filter((decision) => decision.tasks.length > 0 && decision.tasks.every((task) => task.status === 'done')).length;

  return (
    <div className="space-y-5">
      <Panel title={`${roleLabels[role]}长期决策管理`}>
        <AiNotice />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric label="相关决策" value={visibleDecisions.length} sub="当前角色参与或受影响" />
          <Metric label="待确认" value={pending} sub="不能直接执行" />
          <Metric label="执行中" value={active} sub="需要跟踪反馈" />
          <Metric label="已闭环" value={completed} sub="可用于复盘" />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <WorkZone kind="human" title="我的长期管理职责" subtitle="这里管理我这个角色长期做出的方案决策、确认、任务反馈和复盘。">
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-md bg-white p-3">持续查看哪些决策仍在等待确认或执行反馈。</div>
              <div className="rounded-md bg-white p-3">把已经完成的任务结果回写到事件复盘和 Elder Cells。</div>
              <div className="rounded-md bg-white p-3">发现重复冲突时，沉淀为规则或照护偏好。</div>
            </div>
          </WorkZone>
          <WorkZone kind="ai" title="角色 AI 决策看板" subtitle="AI 帮我聚合长期趋势和风险，但不替我批准或关闭事件。">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md bg-white p-3 text-sm text-slate-700">重复风险：康复强度与跌倒风险需要持续联动。</div>
              <div className="rounded-md bg-white p-3 text-sm text-slate-700">复盘重点：食欲、睡眠、训练耐受是否在 24-72 小时内改善。</div>
              <div className="rounded-md bg-white p-3 text-sm text-slate-700">沉淀建议：短时多次训练可写入照护偏好。</div>
            </div>
          </WorkZone>
        </div>
      </Panel>

      <Panel title="决策台账">
        <div className="grid gap-3">
          {visibleDecisions.map((decision) => (
            <div key={decision.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill className={roleTone[decision.item.role]}>{roleLabels[decision.item.role]}</Pill>
                    <Pill className={decision.item.requiresApproval ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                      {decision.item.requiresApproval ? `确认状态：${decision.item.approvalStatus}` : '无需确认'}
                    </Pill>
                    {decision.conflict && <Pill className="border-red-200 bg-red-50 text-red-700">有关联冲突</Pill>}
                  </div>
                  <h3 className="mt-3 font-semibold text-ink">{decision.item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{decision.item.detail}</p>
                </div>
                <div className="min-w-64 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <div><span className="text-muted">老人：</span>{decision.elder?.name ?? '-'} · {decision.elder?.room ?? '-'}</div>
                  <div className="mt-1"><span className="text-muted">事件：</span>{decision.event?.title ?? '-'}</div>
                  <div className="mt-1"><span className="text-muted">复盘：</span>2026-05-16 10:00</div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-muted">我需要做</div>
                  <div className="mt-1 text-sm font-medium text-ink">
                    {decision.item.requiresApproval && decision.item.approvalStatus === 'pending' ? '等待/处理人工确认' : '跟踪任务执行反馈'}
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-muted">交付给谁</div>
                  <div className="mt-1 text-sm font-medium text-ink">{roleWorkflows[decision.item.role].downstream[0] ? roleLabels[roleWorkflows[decision.item.role].downstream[0].role] : '事件复盘'}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs text-muted">任务状态</div>
                  <div className="mt-1 text-sm font-medium text-ink">{decision.tasks.length ? `${decision.tasks.filter((task) => task.status === 'done').length}/${decision.tasks.length} 已完成` : '尚未生成任务'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function HandoverCenterPage() {
  const [manualNote, setManualNote] = useState('夜班补充：张秀兰凌晨起身时情绪紧张，建议白班先安抚再测量体征。');
  return (
    <div className="space-y-5">
      <Panel title="交班中心">
        <AiNotice />
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Metric label="完成任务" value={handoverMock.overview.completed} sub="本班已闭环" />
          <Metric label="未完成任务" value={handoverMock.overview.pending} sub="需下一班跟进" />
          <Metric label="异常事件" value={handoverMock.overview.events} sub="仍在处理中" />
          <Metric label="重点观察" value={handoverMock.overview.watchResidents} sub="带入下一班" />
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <WorkZone kind="ai" title="AI 自动交班摘要" subtitle="从护理记录、任务、异常事件、家属沟通中生成，必须带来源，交班人确认后生效。">
            <div className="grid gap-3 md:grid-cols-3">
              <ShiftSummaryBlock title="夜班遗留" items={operationsMock.shiftSummary.night} />
              <ShiftSummaryBlock title="白班需跟进" items={operationsMock.shiftSummary.day} />
              <ShiftSummaryBlock title="重点观察" items={operationsMock.shiftSummary.watch} />
            </div>
            <div className="mt-3 rounded-md bg-white p-3 text-xs text-muted">来源：护理记录 8 条、任务反馈 5 条、异常事件 1 条、家属沟通 2 条。</div>
          </WorkZone>
          <WorkZone kind="human" title="人工补充与确认" subtitle="交班人可以补充一句话说明，确认后进入审计和下一班待办。">
            <textarea className="focus-ring h-32 w-full rounded-md border border-teal-200 bg-white px-3 py-2 text-sm" value={manualNote} onChange={(event) => setManualNote(event.target.value)} />
            <button className="mt-3 rounded-md bg-care px-3 py-2 text-sm font-medium text-white">确认交班</button>
          </WorkZone>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="重点老人列表">
          <div className="space-y-3">
            {handoverMock.keyResidents.map((item) => (
              <div key={item.name} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold text-ink">{item.name} · {item.room}</div>
                <p className="mt-2 text-sm text-slate-600">关注原因：{item.reason}</p>
                <p className="mt-1 text-sm text-care">下一班：{item.next}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="未完成任务与家属事项">
          <div className="grid gap-3">
            {handoverMock.unfinished.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="font-semibold text-ink">{item.title}</div>
                <div className="mt-1 text-sm text-muted">责任人：{item.owner} · 截止：{item.due}</div>
                <p className="mt-2 text-sm text-slate-600">延误原因：{item.reason}</p>
              </div>
            ))}
            {handoverMock.family.map((item) => (
              <div key={`${item.elder}-${item.issue}`} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="font-semibold text-ink">{item.elder} · 家属沟通</div>
                <p className="mt-2 text-sm text-slate-700">{item.issue}</p>
                <p className="mt-1 text-sm text-amber-800">下一步：{item.next}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FamilySummaryPage() {
  return (
    <Panel title="家属沟通摘要 / 周报">
      <AiNotice />
      <div className="mt-5 grid gap-4">
        {familyWeeklyMock.map((item) => (
          <div key={item.elder} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-ink">{item.elder}</h3>
              <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.status}</Pill>
            </div>
            <WorkZone kind="ai" title="家属可理解摘要草稿" subtitle="只使用经过专业确认或可追溯的记录，不展示未经确认的 AI 判断。">
              <p className="text-sm leading-6 text-slate-700">{item.summary}</p>
              <div className="mt-3 rounded-md bg-white p-3 text-xs text-muted">证据：{item.evidence}</div>
            </WorkZone>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white">确认可发送</button>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">退回修改</button>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">查看证据链</button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TasksPage() {
  const { tasks, currentUser, completeTask, can } = useApp();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const visible = currentUser?.role === 'admin' ? tasks : tasks.filter((task) => task.role === currentUser?.role);
  return (
    <Panel title="任务中心">
      <div className="grid gap-3">
        {visible.map((task) => (
          <div key={task.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-ink">{task.title}</h3>
                <div className="mt-1 text-sm text-muted">{task.owner} · 截止 {task.due}</div>
              </div>
              <TaskStatusPill status={task.status} />
            </div>
            {task.status !== 'done' ? (
              <div className="mt-3 flex gap-2">
                <input className="focus-ring min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" value={feedback[task.id] ?? ''} onChange={(e) => setFeedback((prev) => ({ ...prev, [task.id]: e.target.value }))} placeholder="填写执行反馈" />
                <button className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!can('task:update')} onClick={() => completeTask(task.id, feedback[task.id] || '已按方案执行')}>
                  完成
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">反馈：{task.feedback}</p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ApprovalPage() {
  const { carePlans, approvePlanItem, can } = useApp();
  const items = carePlans.flatMap((plan) => plan.items.filter((item) => item.requiresApproval).map((item) => ({ ...item, planId: plan.id })));
  return (
    <Panel title="人工确认页">
      <AiNotice />
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Pill className={roleTone[item.role]}>{roleLabels[item.role]}</Pill>
                <h3 className="mt-2 font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              </div>
              <Pill className="border-amber-200 bg-amber-50 text-amber-700">{item.approvalStatus}</Pill>
            </div>
            <div className="mt-4 flex gap-2">
              <button disabled={!can('plan:approve') || item.approvalStatus === 'approved'} className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white disabled:bg-slate-300" onClick={() => approvePlanItem(item.planId, item.id, true)}>
                批准
              </button>
              <button disabled={!can('plan:approve')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:text-slate-300" onClick={() => approvePlanItem(item.planId, item.id, false)}>
                退回
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AuditPage() {
  const { auditLogs, can } = useApp();
  if (!can('audit:view')) return <Panel title="审计日志"><p className="text-sm text-amber-700">当前角色无权查看审计日志。</p></Panel>;
  return (
    <Panel title="审计日志">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">动作</th><th className="px-4 py-3">对象</th><th className="px-4 py-3">详情</th></tr></thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {auditLogs.map((log) => <tr key={log.id}><td className="px-4 py-3">{log.time}</td><td className="px-4 py-3">{log.user}</td><td className="px-4 py-3 font-medium text-ink">{log.action}</td><td className="px-4 py-3">{log.target}</td><td className="px-4 py-3 text-slate-600">{log.detail}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-medium text-ink">{value}</div></div>;
}

function ElderCellBars({ elder, compact = false }: { elder: Elder; compact?: boolean }) {
  const cells = Object.entries(elder.cells);
  const labels: Record<string, string> = { mobility: '活动', cognition: '认知', nutrition: '营养', medication: '用药', emotion: '情绪', sleep: '睡眠', risk: '综合风险' };
  return (
    <div>
      {compact && <div className="mb-2 flex items-center justify-between"><span className="font-medium text-ink">{elder.name}</span><StatusPill status={elder.status} /></div>}
      <div className="space-y-2">
        {cells.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-sm">
            <span className="text-muted">{labels[key]}</span>
            <div className="h-2 rounded-full bg-slate-200"><div className={`h-2 rounded-full ${key === 'risk' ? 'bg-amber-500' : 'bg-care'}`} style={{ width: `${value}%` }} /></div>
            <span className="text-right text-xs text-slate-500">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordTimeline({ records }: { records: ReturnType<typeof useApp>['records'] }) {
  return <div className="space-y-3">{records.map((record) => <div key={record.id} className="border-l-2 border-care pl-3"><div className="text-sm font-medium text-ink">{record.time}</div><p className="mt-1 text-sm text-slate-600">{record.note}</p><div className="mt-2 flex flex-wrap gap-1">{record.abnormalFlags.map((flag) => <Pill key={flag} className="border-amber-200 bg-amber-50 text-amber-700">{flag}</Pill>)}</div></div>)}</div>;
}

function EventRow({ event }: { event: CareEvent }) {
  return <div className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-ink">{event.title}</div><div className="mt-1 text-sm text-muted">{event.createdAt}</div></div><EventStatus status={event.status} /></div><p className="mt-2 text-sm text-slate-600">{event.aiSummary}</p></div>;
}

function AssessmentMini({ assessment }: { assessment: ReturnType<typeof useApp>['assessments'][number] }) {
  return <div className="rounded-lg border border-slate-200 p-3"><Pill className={roleTone[assessment.role]}>{roleLabels[assessment.role]}</Pill><div className="mt-2 text-sm font-medium text-ink">{assessment.focus}</div><div className="mt-1 text-xs text-muted">{assessment.status === 'submitted' ? '已提交' : '待提交'}</div></div>;
}

function StatusPill({ status }: { status: Elder['status'] }) {
  const text = { stable: '稳定', watch: '观察', event: '事件中' }[status];
  const cls = status === 'event' ? 'border-red-200 bg-red-50 text-red-700' : status === 'watch' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <Pill className={cls}>{text}</Pill>;
}

function EventStatus({ status }: { status: CareEvent['status'] }) {
  const text = { new: '新建', assessing: '评估中', plan_ready: '方案待定', approval: '待确认', tasking: '任务执行', closed: '已关闭' }[status];
  return <Pill className="border-blue-200 bg-blue-50 text-blue-700">{text}</Pill>;
}

function TaskStatusPill({ status }: { status: 'pending' | 'in_progress' | 'done' }) {
  const text = { pending: '待处理', in_progress: '执行中', done: '已完成' }[status];
  const cls = status === 'done' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700';
  return <Pill className={cls}>{text}</Pill>;
}

function Router() {
  const { path, navigate } = useHashRoute();
  const route = useMemo(() => {
    if (path === '/login') return <LoginPage />;
    if (path === '/') return <Dashboard navigate={navigate} />;
    if (path === '/elders') return <ElderList navigate={navigate} />;
    if (path.startsWith('/elder/')) return <ElderDetail elderId={path.split('/')[2]} />;
    if (path === '/record') return <DailyRecordPage />;
    if (path === '/handover') return <HandoverCenterPage />;
    if (path === '/events') return <EventsPage navigate={navigate} />;
    if (path.startsWith('/event/')) return <EventDetail eventId={path.split('/')[2]} />;
    if (path === '/assessments') return <AssessmentsPage />;
    if (path === '/dependency') return <DependencyPage />;
    if (path === '/conflicts') return <ConflictsPage />;
    if (path === '/decisions') return <DecisionManagementPage />;
    if (path === '/plan') return <CarePlanPage />;
    if (path === '/family') return <FamilySummaryPage />;
    if (path === '/tasks') return <TasksPage />;
    if (path === '/approval') return <ApprovalPage />;
    if (path === '/audit') return <AuditPage />;
    return <Dashboard navigate={navigate} />;
  }, [path]);
  if (path === '/login') return route;
  return <Layout path={path} navigate={navigate}>{route}</Layout>;
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
