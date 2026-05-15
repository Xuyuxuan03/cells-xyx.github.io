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
  { path: '/', label: '首页', icon: Home },
  { path: '/elders', label: '老人列表', icon: Users },
  { path: '/record', label: '日常录入', icon: ClipboardList },
  { path: '/events', label: '协同事件', icon: HeartPulse },
  { path: '/assessments', label: '多角色评估', icon: Stethoscope },
  { path: '/dependency', label: '依赖链路', icon: GitBranch },
  { path: '/conflicts', label: '冲突检测', icon: AlertTriangle },
  { path: '/decisions', label: '决策管理', icon: ClipboardCheck },
  { path: '/plan', label: '照护方案', icon: ClipboardCheck },
  { path: '/tasks', label: '任务中心', icon: Activity },
  { path: '/approval', label: '人工确认', icon: ShieldCheck },
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
  const { elders, events, tasks, conflicts } = useApp();
  const openEvents = events.filter((item) => item.status !== 'closed');
  const activeEvent = openEvents[0];
  return (
    <>
      <AiNotice />
      <MyNextStep navigate={navigate} />
      <ProcessBoard navigate={navigate} />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="在住老人" value={elders.length} sub="Elder Cells 持续观察" />
        <Metric label="开放事件" value={openEvents.length} sub="跨专业协同处理中" />
        <Metric label="待办任务" value={tasks.filter((item) => item.status !== 'done').length} sub="按角色自动分派" />
        <Metric label="待协调冲突" value={conflicts.filter((item) => !item.resolved).length} sub="进入统一方案前处理" />
      </div>
      {activeEvent && <ActiveEventWorkspace event={activeEvent} navigate={navigate} />}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel title="开放协同事件">
          <div className="space-y-4">
            {openEvents.map((event) => (
              <button key={event.id} className="block w-full text-left" onClick={() => navigate(`/event/${event.id}`)}>
                <EventRow event={event} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Elder Cells 风险概览">
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
  const { elders, records, events } = useApp();
  const elder = elders.find((item) => item.id === elderId) ?? elders[0];
  const elderRecords = records.filter((item) => item.elderId === elder.id);
  const elderEvents = events.filter((item) => item.elderId === elder.id);
  return (
    <div className="space-y-5">
      <Panel title={`${elder.name} · ${elder.room}`}>
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-sm text-muted">诊断</div>
            <div className="mt-2 flex flex-wrap gap-2">{elder.diagnoses.map((d) => <Pill key={d} className="border-slate-200 bg-slate-50 text-slate-700">{d}</Pill>)}</div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Info label="年龄" value={`${elder.age} 岁`} />
              <Info label="护理等级" value={elder.careLevel} />
              <Info label="责任护士" value={elder.primaryNurse} />
              <Info label="当前状态" value={elder.status} />
            </div>
          </div>
          <ElderCellBars elder={elder} />
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="最近日常记录">
          <RecordTimeline records={elderRecords} />
        </Panel>
        <Panel title="相关协同事件">
          <div className="space-y-3">{elderEvents.map((event) => <EventRow key={event.id} event={event} />)}</div>
        </Panel>
      </div>
    </div>
  );
}

function DailyRecordPage() {
  const { elders, addRecord, can } = useApp();
  const [elderId, setElderId] = useState(elders[0]?.id ?? '');
  const [flags, setFlags] = useState<string[]>(['食欲下降', '睡眠中断']);
  const [note, setNote] = useState('今日早餐不足半份，夜间醒来多次，晨起步态不稳。');
  const toggle = (flag: string) => setFlags((prev) => (prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]));
  return (
    <Panel title="日常记录录入">
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-ink">老人</label>
          <select className="focus-ring w-full rounded-md border border-slate-200 bg-white px-3 py-2" value={elderId} onChange={(e) => setElderId(e.target.value)}>
            {elders.map((elder) => <option key={elder.id} value={elder.id}>{elder.name} · {elder.room}</option>)}
          </select>
          <div>
            <div className="mb-2 text-sm font-medium text-ink">异常标记</div>
            <div className="grid grid-cols-2 gap-2">
              {['食欲下降', '睡眠中断', '跌倒风险', '康复耐受下降', '情绪低落', '用药疑问'].map((flag) => (
                <button key={flag} className={`rounded-md border px-3 py-2 text-sm ${flags.includes(flag) ? 'border-care bg-teal-50 text-care' : 'border-slate-200 bg-white text-slate-600'}`} onClick={() => toggle(flag)}>
                  {flag}
                </button>
              ))}
            </div>
          </div>
          <textarea className="focus-ring h-28 w-full rounded-md border border-slate-200 px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} />
          <button
            disabled={!can('record:create')}
            className="rounded-md bg-care px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={() => addRecord({ elderId, appetite: '少于半份', sleep: '夜醒多次', mobility: '步态不稳', mood: '偏低落', vitals: '待护士复测', note, abnormalFlags: flags })}
          >
            提交观察记录
          </button>
          {!can('record:create') && <p className="text-sm text-amber-700">当前角色无日常记录录入权限。</p>}
        </div>
        <AiNotice />
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
  const workflow = roleWorkflows[role];
  const myItems = plan.items.filter((item) => item.role === role);
  const approvalItems = plan.items.filter((item) => item.requiresApproval && item.approvalStatus === 'pending');
  const myApprovalItems = ['doctor', 'pharmacist', 'rehab'].includes(role) ? approvalItems : [];
  const allApproved = plan.items.every((item) => !item.requiresApproval || item.approvalStatus === 'approved');
  const nextHandoff = workflow.downstream[0];
  const needsConfirmBeforeAction = myItems.some((item) => item.requiresApproval && item.approvalStatus !== 'approved');
  const canConfirmPlan = allApproved && !plan.confirmed && can('plan:confirm');
  return (
    <div className="space-y-5">
      <Panel title={`${roleLabels[role]}照护方案工作单`}>
        <AiNotice />
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-care">当前发生了什么</div>
              <h3 className="mt-1 text-lg font-semibold text-ink">{event?.title ?? plan.goal}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {elder?.name ? `${elder.name} · ${elder.room}：` : ''}{plan.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill className={roleTone[role]}>{roleLabels[role]}</Pill>
              <Pill className={plan.confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                {plan.confirmed ? '方案已生成任务' : '方案待闭环确认'}
              </Pill>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <WorkZone kind="context" title="1. 我需要知道什么" subtitle="只显示当前角色执行前必须理解的上下文。">
            <div className="space-y-2 text-sm text-slate-700">
              <div className="rounded-md bg-white p-3">阶段目标：{plan.goal}</div>
              <div className="rounded-md bg-white p-3">我的职责：{workflow.scopeTitle}</div>
              {workflow.upstream.length > 0 ? workflow.upstream.map((item) => (
                <div key={`${item.role}-${item.input}`} className="rounded-md bg-white p-3">
                  需要来自 {roleLabels[item.role]}：{item.input}
                </div>
              )) : <div className="rounded-md bg-white p-3">当前角色无需等待上游输入。</div>}
            </div>
          </WorkZone>

          <WorkZone kind="ai" title="2. 角色 AI 给我的方案" subtitle="AI 按我的角色抽取出的方案内容，只读参考。">
            <div className="space-y-3">
              {myItems.length > 0 ? myItems.map((item) => (
                <div key={item.id} className="rounded-md bg-white p-3">
                  <div className="font-semibold text-ink">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                  <Pill className={item.requiresApproval ? 'mt-2 border-amber-200 bg-amber-50 text-amber-700' : 'mt-2 border-emerald-200 bg-emerald-50 text-emerald-700'}>
                    {item.requiresApproval ? `需人工确认：${item.approvalStatus}` : '可进入执行'}
                  </Pill>
                </div>
              )) : <div className="rounded-md bg-white p-3 text-sm text-slate-600">当前角色没有直接方案动作，只需查看上下游状态。</div>}
            </div>
          </WorkZone>

          <WorkZone kind="human" title="3. 我现在要做什么" subtitle="这是当前用户本人需要处理的动作。">
            <div className="space-y-3">
              {needsConfirmBeforeAction && <div className="rounded-md border border-amber-200 bg-white p-3 text-sm text-amber-800">等待人工确认后再执行，不要提前下发或执行。</div>}
              {myApprovalItems.length > 0 && <a href="#/approval" className="block rounded-md border border-teal-200 bg-white p-3 text-sm font-medium text-care">去人工确认页处理 {myApprovalItems.length} 个待确认项</a>}
              {myItems.length > 0 && !needsConfirmBeforeAction && <a href="#/tasks" className="block rounded-md border border-teal-200 bg-white p-3 text-sm font-medium text-care">进入任务中心执行我的任务</a>}
              {canConfirmPlan && <button className="rounded-md bg-care px-3 py-2 text-sm font-medium text-white" onClick={() => confirmPlan(plan.id)}>确认方案并生成任务</button>}
              {myItems.length === 0 && myApprovalItems.length === 0 && !canConfirmPlan && <div className="rounded-md bg-white p-3 text-sm text-slate-600">当前暂无我本人要处理的方案动作。</div>}
            </div>
          </WorkZone>

          <WorkZone kind="human" title="4. 做完交给谁" subtitle="完成后系统会进入下游角色或任务闭环。">
            <div className="space-y-3 text-sm text-slate-700">
              {nextHandoff ? (
                <div className="rounded-md bg-white p-3">
                  <Pill className={roleTone[nextHandoff.role]}>{roleLabels[nextHandoff.role]}</Pill>
                  <p className="mt-2 leading-6">{nextHandoff.handoff}</p>
                </div>
              ) : (
                <div className="rounded-md bg-white p-3">完成后进入事件复盘，并更新 Elder Cells。</div>
              )}
              <div className="rounded-md bg-white p-3">提交后会进入审计日志，供复盘和关闭事件使用。</div>
            </div>
          </WorkZone>
        </div>
      </Panel>

      <Panel title="全局统一方案，只读上下文">
        <WorkZone kind="context" title="所有角色方案总览" subtitle="这是为了理解整体协同，不代表当前角色要处理全部内容。">
          <div className="grid gap-3">
            {plan.items.map((item) => (
              <div key={item.id} className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${item.role === role ? 'border-care bg-teal-50/50' : 'border-slate-200 bg-white'}`}>
                <div>
                  <Pill className={roleTone[item.role]}>{roleLabels[item.role]}{item.role === role ? ' · 我' : ''}</Pill>
                  <h4 className="mt-2 font-semibold text-ink">{item.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                </div>
                <Pill className={item.approvalStatus === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.approvalStatus === 'rejected' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                  {item.requiresApproval ? `需确认 · ${item.approvalStatus}` : '无需审批'}
                </Pill>
              </div>
            ))}
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
    if (path === '/events') return <EventsPage navigate={navigate} />;
    if (path.startsWith('/event/')) return <EventDetail eventId={path.split('/')[2]} />;
    if (path === '/assessments') return <AssessmentsPage />;
    if (path === '/dependency') return <DependencyPage />;
    if (path === '/conflicts') return <ConflictsPage />;
    if (path === '/decisions') return <DecisionManagementPage />;
    if (path === '/plan') return <CarePlanPage />;
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
