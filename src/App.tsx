/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  ClipboardList, 
  BarChart3, 
  LayoutDashboard, 
  UserCircle, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  MessageSquareHeart,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { DEFAULT_VOLUNTEERS, DEFAULT_TASKS } from './constants';
import { 
  smartMatch, 
  generateImpactMessage, 
  getNGOAnalytics, 
  getAlternativeMatch 
} from './services/geminiService';

// --- Types ---

interface past_task {
  id: string;
  name: string;
  status: 'completed' | 'cancelled' | 'cancelled_late';
  date: string;
}

interface Volunteer {
  id: string;
  name: string;
  age: number;
  location: string;
  self_description: string;
  past_tasks: past_task[];
  availability: string;
  fatigue_score: number;
  email: string;
}

interface Task {
  task_id: string;
  task_name: string;
  ngo_name: string;
  description: string;
  required_skills: string;
  location: string;
  date: string;
  time: string;
  urgency: 'low' | 'medium' | 'high';
  min_volunteers_needed: number;
  current_assigned: string[];
}

// --- Helpers ---

const calculateReliability = (volunteer: Volunteer) => {
  let score = 80; // Baseline
  volunteer.past_tasks.forEach(t => {
    if (t.status === 'completed') score += 5;
    if (t.status === 'cancelled') score -= 5;
    if (t.status === 'cancelled_late') score -= 15;
  });
  return Math.min(100, Math.max(0, score));
};

const getReliabilityReason = (score: number) => {
  if (score >= 90) return "Excellent track record with high completion rates.";
  if (score >= 70) return "General reliability is good, but has missed some assignments.";
  if (score >= 50) return "Frequent cancellations impact team planning.";
  return "High cancellation history requires attention.";
};

// --- Main Components ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'volunteers' | 'tasks' | 'analytics'>('dashboard');
  const [volunteers, setVolunteers] = useState<Volunteer[]>(DEFAULT_VOLUNTEERS);
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [outreachModal, setOutreachModal] = useState<{ isOpen: boolean, message: string, volunteer: any, task: any, isLate?: boolean } | null>(null);
  const [impactModal, setImpactModal] = useState<{ isOpen: boolean, message: string, volunteer: any } | null>(null);
  const [confirmCompleteModal, setConfirmCompleteModal] = useState<{ isOpen: boolean, task: Task } | null>(null);

  // Persistence
  useEffect(() => {
    const savedVols = localStorage.getItem('v-iq-volunteers');
    const savedTasks = localStorage.getItem('v-iq-tasks');
    if (savedVols) setVolunteers(JSON.parse(savedVols));
    if (savedTasks) setTasks(JSON.parse(savedTasks));
  }, []);

  useEffect(() => {
    localStorage.setItem('v-iq-volunteers', JSON.stringify(volunteers));
    localStorage.setItem('v-iq-tasks', JSON.stringify(tasks));
  }, [volunteers, tasks]);

  const handleMatch = async (task: Task) => {
    setIsMatching(true);
    const results = await smartMatch(task, volunteers);
    setMatchResults(results);
    setIsMatching(false);
  };

  const assignVolunteer = (taskId: string, volunteerId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.task_id === taskId) {
        if (t.current_assigned.includes(volunteerId)) return t;
        return { ...t, current_assigned: [...t.current_assigned, volunteerId] };
      }
      return t;
    }));
    // Update volunteer fatigue
    setVolunteers(prev => prev.map(v => {
      if (v.id === volunteerId) return { ...v, fatigue_score: v.fatigue_score + 1 };
      return v;
    }));
  };

  const handleCompleteTask = (task: Task) => {
    setConfirmCompleteModal({ isOpen: true, task });
  };

  const confirmComplete = async () => {
    if (!confirmCompleteModal) return;
    
    const task = confirmCompleteModal.task;
    setConfirmCompleteModal(null);

    // Generate impact messages for each assigned volunteer
    const volunteerId = task.current_assigned[0]; // For demo, just first one
    if (volunteerId) {
      const v = volunteers.find(vol => vol.id === volunteerId);
      if (v) {
        const msg = await generateImpactMessage(v, task);
        setImpactModal({ isOpen: true, message: msg, volunteer: v });
      }
    }

    // Remove task or mark as completed (here we remove for demo simplicity)
    setTasks(prev => prev.filter(t => t.task_id !== task.task_id));
    if (selectedTask?.task_id === task.task_id) setSelectedTask(null);
  };

  const handleCancelAssignment = async (task: Task, volunteer: Volunteer) => {
    // Determine if late cancellation (within 48 hours)
    const taskDate = new Date(task.date);
    const now = new Date(); // In production, this would be current time, here it's 2026-04-28
    const timeDiff = taskDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    const isLate = hoursDiff <= 48;

    // Remove volunteer
    setTasks(prev => prev.map(t => {
      if (t.task_id === task.task_id) {
        return { ...t, current_assigned: t.current_assigned.filter(id => id !== volunteer.id) };
      }
      return t;
    }));

    // Find replacement with improved logic
    const replacement = await getAlternativeMatch(task, volunteer, volunteers, isLate);
    if (replacement) {
      const v = volunteers.find(vol => vol.id === replacement.volunteerId);
      setOutreachModal({
        isOpen: true,
        message: replacement.outreachMessage,
        volunteer: v,
        task: task,
        isLate: isLate
      });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 antialiased overflow-hidden" id="app-root">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col" id="sidebar">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">VQ</div>
          <h1 className="text-white font-semibold text-lg tracking-tight">VolunteerIQ</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          <NavItem 
            id="nav-dash"
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            id="nav-vols"
            icon={<Users size={18} />} 
            label="Volunteers" 
            active={activeTab === 'volunteers'} 
            onClick={() => setActiveTab('volunteers')} 
          />
          <NavItem 
            id="nav-tasks"
            icon={<ClipboardList size={18} />} 
            label="Task Management" 
            active={activeTab === 'tasks'} 
            onClick={() => setActiveTab('tasks')} 
          />
          <NavItem 
            id="nav-stats"
            icon={<BarChart3 size={18} />} 
            label="Impact Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
          />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden">
               <UserCircle size={32} className="text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-white font-medium">NGO Admin</p>
              <p className="text-[10px] text-slate-500">Global Outreach</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-50 overflow-y-auto" id="main-content">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-slate-800 font-semibold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search assets..." 
                  className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm w-48 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                />
             </div>
             <button className="p-2 text-slate-400 hover:text-slate-600 relative">
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
               <ClipboardList size={20} />
             </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <Dashboard 
                key="dash" 
                volunteers={volunteers} 
                tasks={tasks} 
                onViewTask={(t) => { setSelectedTask(t); setActiveTab('tasks'); }}
              />
            )}
            {activeTab === 'volunteers' && (
              <VolunteerManager 
                key="vols" 
                volunteers={volunteers} 
                setVolunteers={setVolunteers}
              />
            )}
            {activeTab === 'tasks' && (
              <TaskManager 
                key="tasks" 
                tasks={tasks} 
                volunteers={volunteers} 
                selectedTask={selectedTask}
                setSelectedTask={setSelectedTask}
                isMatching={isMatching}
                matchResults={matchResults}
                onMatch={handleMatch}
                onAssign={assignVolunteer}
                onCancel={handleCancelAssignment}
                onComplete={handleCompleteTask}
              />
            )}
            {activeTab === 'analytics' && (
              <AnalyticsView 
                key="stats" 
                volunteers={volunteers} 
                tasks={tasks} 
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {outreachModal && outreachModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-8 max-w-lg w-full shadow-2xl border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-6 font-bold">VQ</div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {outreachModal.isLate ? (
                  <span className="flex items-center gap-2 text-red-600">
                    <AlertTriangle size={24} />
                    Critical Recovery
                  </span>
                ) : "Automated Match Recovery"}
              </h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">
                {outreachModal.isLate 
                  ? "Late cancellation detected. Strategic backup identified to maintain mission integrity." 
                  : `Replacement identified for ${outreachModal.volunteer?.name} based on semantic skill alignment.`
                }
              </p>
              
              <div className="p-6 bg-blue-50 rounded-lg border border-blue-100 italic text-blue-900 text-sm leading-relaxed mb-8">
                "{outreachModal.message}"
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    assignVolunteer(outreachModal.task.task_id, outreachModal.volunteer.id);
                    setOutreachModal(null);
                  }}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-all uppercase tracking-widest text-xs"
                >
                  Send & Deploy
                </button>
                <button 
                  onClick={() => setOutreachModal(null)}
                  className="px-6 py-4 bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                >
                  Ignore
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {impactModal && impactModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-8 max-w-lg w-full shadow-2xl border border-emerald-100"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 mb-6">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Impact Authenticated</h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">
                Strategic summary generated for <span className="text-emerald-600 font-bold">{impactModal.volunteer?.name}</span> to reinforce retention.
              </p>
              
              <div className="p-6 bg-emerald-50 rounded-lg border border-emerald-100 italic text-emerald-900 text-sm leading-relaxed mb-8">
                "{impactModal.message}"
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setImpactModal(null)}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-md font-bold hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs"
                >
                  Transmit Impact
                </button>
                <button 
                  onClick={() => setImpactModal(null)}
                  className="px-6 py-4 bg-slate-100 text-slate-600 rounded-md font-bold hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {confirmCompleteModal && confirmCompleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-8 max-w-sm w-full shadow-2xl border border-slate-200"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-6 font-bold">
                 <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Finalize Mission?</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                You are about to mark <span className="font-bold text-slate-700">"{confirmCompleteModal.task.task_name}"</span> as complete. This will trigger automated impact messaging for assigned assets.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={confirmComplete}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-md font-bold hover:bg-emerald-700 transition-all uppercase tracking-widest text-xs"
                >
                  Confirm Completion
                </button>
                <button 
                  onClick={() => setConfirmCompleteModal(null)}
                  className="px-6 py-3 bg-slate-50 text-slate-400 rounded-md font-bold hover:bg-slate-100 transition-all uppercase tracking-widest text-xs border border-slate-100"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavItem({ icon, label, active, onClick, id }: { icon: any, label: string, active: boolean, onClick: () => void, id: string }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all group ${
        active 
          ? 'bg-blue-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-500 group-hover:text-white'}>{icon}</span>
      {label}
    </button>
  );
}

function Dashboard({ volunteers, tasks, onViewTask }: any) {
  const stats = useMemo(() => {
    const atRisk = volunteers.filter((v: any) => v.fatigue_score > 4).length;
    const urgentTasks = tasks.filter((t: any) => t.urgency === 'high').length;
    const totalAssignments = tasks.reduce((acc: number, t: any) => acc + t.current_assigned.length, 0);

    return { atRisk, urgentTasks, totalAssignments };
  }, [volunteers, tasks]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
      id="dashboard-view"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
          label="Active Volunteers" 
          val={volunteers.length.toString()} 
          sub="+12% from last month"
          trend="up"
          color="blue"
        />
        <StatCard 
          label="Retention Rate" 
          val="92%" 
          sub="High reliability sector"
          trend="neutral"
          color="slate"
        />
        <StatCard 
          label="Burnout Alerts" 
          val={stats.atRisk.toString()} 
          sub="At-risk of fatigue"
          trend="down"
          color="amber"
          isWarning
        />
        <StatCard 
          label="Total (Monthly)" 
          val="4.2k" 
          sub="Families served"
          trend="up"
          color="slate"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Widget Area */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider">Urgent Tasks</div>
                <h3 className="font-bold text-slate-800">Mission Queue</h3>
              </div>
              <button className="text-[10px] uppercase font-bold text-blue-600 hover:underline">View Priority Board</button>
            </div>
            <div className="p-6 space-y-4">
              {tasks.filter((t: any) => t.urgency === 'high').map((t: any) => (
                 <div key={t.task_id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:border-blue-300 transition-all cursor-pointer group" onClick={() => onViewTask(t)}>
                   <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all">
                       <ClipboardList size={18} />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-slate-800">{t.task_name}</p>
                       <p className="text-xs text-slate-500">{t.ngo_name} • {t.location}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Filled</div>
                        <div className="text-xs font-bold text-blue-600">{t.current_assigned.length} / {t.min_volunteers_needed}</div>
                     </div>
                     <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-all">
                       Assign
                     </button>
                   </div>
                 </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-lg">
            <h3 className="text-sm font-semibold mb-4 text-blue-400 uppercase tracking-widest">Impact Summary</h3>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "You helped serve meals to 34 families in Mysuru today. That's 34 families who went to bed with full stomachs because of you."
            </p>
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest">
              <span className="text-slate-500 uppercase">Weekly Goal</span>
              <span className="text-emerald-400">+4.2%</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider text-[11px]">Skill Gaps</h3>
            <div className="space-y-4">
              {['Youth Mentorship', 'Emergency Relief', 'IT Strategy'].map((area, i) => (
                <div key={area} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                    <span className="text-slate-600">{area}</span>
                    <span className={i === 1 ? 'text-red-500' : 'text-slate-400'}>{i === 1 ? 'Scarce' : 'Stable'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${85 - i * 25}%` }}
                      className={`h-full ${i === 1 ? 'bg-red-500' : 'bg-blue-500'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 border border-blue-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-all uppercase tracking-widest">
              Refresh Analysis
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, val, sub, trend, isWarning }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${isWarning ? 'text-amber-600' : 'text-slate-800'}`}>{val}</p>
      <div className={`flex items-center text-xs mt-2 font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-amber-600' : 'text-slate-400'}`}>
        {sub}
      </div>
    </div>
  );
}

function VolunteerManager({ volunteers, setVolunteers }: any) {
  const [selectedVol, setSelectedVol] = useState<Volunteer | null>(null);

  const deleteVol = (id: string) => {
    setVolunteers((prev: any) => prev.filter((v: any) => v.id !== id));
    setSelectedVol(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      id="volunteer-manager"
    >
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">Volunteer Directory</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all uppercase tracking-wider">
            <UserPlus size={14} />
            Register Volunteer
          </button>
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="grid grid-cols-6 p-4 border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 tracking-widest">
            <div className="col-span-2 px-2">Volunteer Info</div>
            <div className="px-2">Reliability</div>
            <div className="px-2">Availability</div>
            <div className="px-2">Status</div>
            <div className="px-2">Action</div>
          </div>
          {volunteers.map((v: any) => {
            const rel = calculateReliability(v);
            const isAtRisk = v.fatigue_score > 4;
            return (
              <div 
                key={v.id} 
                onClick={() => setSelectedVol(v)}
                className={`grid grid-cols-6 p-4 border-b border-slate-100 items-center hover:bg-slate-50 transition-all cursor-pointer group ${selectedVol?.id === v.id ? 'bg-blue-50/50 border-blue-100' : ''}`}
              >
                <div className="col-span-2 px-2 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs uppercase">
                    {v.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold group-hover:text-blue-600">{v.name}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{v.location}</div>
                  </div>
                </div>
                <div className="px-2">
                  <div className="text-xs font-bold text-slate-700">{rel}%</div>
                  <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className={`h-full ${rel > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${rel}%` }} />
                  </div>
                </div>
                <div className="px-2">
                  <div className="text-[10px] font-medium leading-tight text-slate-500">{v.availability}</div>
                </div>
                <div className="px-2">
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isAtRisk ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isAtRisk ? 'Burnout risk' : 'Healthy'}
                  </div>
                </div>
                <div className="px-2">
                  <button className="text-blue-600 hover:scale-110 transition-transform">
                    <UserCircle size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Volunteer Intelligence</h3>
        <AnimatePresence mode="wait">
          {selectedVol ? (
            <motion.div 
              id="vol-profile-card"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl font-bold">
                  {selectedVol.name[0]}
                </div>
                <div>
                  <h4 className="text-lg font-bold">{selectedVol.name}</h4>
                  <p className="text-xs text-slate-500">{selectedVol.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Semantic Context</div>
                <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-blue-500 pl-4 py-1 bg-slate-50">
                  "{selectedVol.self_description}"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Reliability Rank</div>
                  <div className="text-xl font-bold text-blue-600">#{calculateReliability(selectedVol)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Fatigue Meter</div>
                  <div className={`text-xl font-bold ${selectedVol.fatigue_score > 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedVol.fatigue_score}/10
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                   <BrainCircuit size={14} className="text-blue-600" />
                   <span className="text-[10px] font-bold text-blue-900 uppercase tracking-tight">AI Strategic Fit</span>
                </div>
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  {getReliabilityReason(calculateReliability(selectedVol))}
                  {selectedVol.fatigue_score > 4 && " Immediate rest recommended to ensure long-term retention."}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 transition-all uppercase tracking-widest">
                  Assign Task
                </button>
                <button 
                  onClick={() => deleteVol(selectedVol.id)}
                  className="px-4 py-2.5 bg-slate-50 text-slate-400 rounded-md hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100"
                >
                  <AlertTriangle size={18} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-100 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-4">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[11px] font-bold uppercase tracking-widest leading-loose">Select Profiles for Inspection</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TaskManager({ tasks, volunteers, selectedTask, setSelectedTask, isMatching, matchResults, onMatch, onAssign, onCancel, onComplete }: any) {
  const [sortBy, setSortBy] = useState<'default' | 'urgency'>('default');

  const sortedTasks = useMemo(() => {
    if (sortBy === 'default') return tasks;

    const urgencyMap = { high: 0, medium: 1, low: 2 };
    
    return [...tasks].sort((a, b) => {
      // First sort by urgency
      const urgencyDiff = urgencyMap[a.urgency as keyof typeof urgencyMap] - urgencyMap[b.urgency as keyof typeof urgencyMap];
      if (urgencyDiff !== 0) return urgencyDiff;
      
      // Then sort by date
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [tasks, sortBy]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      id="task-manager"
    >
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Mission List</h3>
            <div className="flex bg-slate-100 p-1 rounded-md">
              <button 
                onClick={() => setSortBy('default')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${sortBy === 'default' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Default
              </button>
              <button 
                onClick={() => setSortBy('urgency')}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${sortBy === 'urgency' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Urgency
              </button>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all uppercase tracking-widest shadow-sm">
            <Plus size={14} />
            Post New Task
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedTasks.map((t: any) => (
            <div 
              key={t.task_id} 
              onClick={() => setSelectedTask(t)}
              className={`bg-white p-6 rounded-xl border transition-all cursor-pointer group flex flex-col ${selectedTask?.task_id === t.task_id ? 'border-blue-500 ring-2 ring-blue-50 shadow-md' : 'border-slate-200 hover:border-blue-300 shadow-sm'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${t.urgency === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                  {t.urgency} Urgency
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.date}</span>
              </div>
              <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight">{t.task_name}</h4>
              <p className="text-xs text-slate-500 font-medium mb-4">{t.ngo_name}</p>
              
              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {t.current_assigned.map((vid: string) => {
                    const v = volunteers.find((vol: any) => vol.id === vid);
                    return (
                      <div key={vid} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-700 uppercase" title={v?.name}>
                        {v?.name[0]}
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, t.min_volunteers_needed - t.current_assigned.length) }).map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-slate-300">
                      <UserPlus size={12} />
                    </div>
                  ))}
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-hover:text-blue-500 transition-colors">
                  Details
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Coordination Hub</h3>
        <AnimatePresence mode="wait">
          {selectedTask ? (
            <motion.div 
              id="match-panel"
              key={selectedTask.task_id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full"
            >
              <div className="bg-slate-900 px-6 py-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                   {selectedTask.urgency === 'high' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>}
                   <h4 className="text-lg font-bold">{selectedTask.task_name}</h4>
                </div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{selectedTask.ngo_name}</p>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Requirements</div>
                  <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-slate-200 pl-3">
                    {selectedTask.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedTask.required_skills.split(',').map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-bold border border-slate-100 uppercase tracking-tighter">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800">Deployment</h5>
                    <div className="flex gap-2">
                       {selectedTask.current_assigned.length >= selectedTask.min_volunteers_needed && (
                          <button 
                            onClick={() => onComplete(selectedTask)}
                            className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline uppercase tracking-wide"
                          >
                            <CheckCircle2 size={12} />
                            Complete
                          </button>
                       )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedTask.current_assigned.map((vid: string) => {
                      const v = volunteers.find((vol: any) => vol.id === vid);
                      if (!v) return null;
                      return (
                        <div key={vid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                                {v.name[0]}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{v.name}</span>
                           </div>
                           <button 
                             onClick={() => onCancel(selectedTask, v)}
                             className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                           >
                             Remove
                           </button>
                        </div>
                      );
                    })}
                    {selectedTask.current_assigned.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic">No assets deployed to this task.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="pb-2 flex items-center justify-between">
                    <h5 className="font-bold text-[11px] uppercase tracking-wider text-slate-800">Optimal Matches</h5>
                    <button 
                      onClick={() => onMatch(selectedTask)}
                      disabled={isMatching}
                      className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline disabled:opacity-50 uppercase tracking-tight"
                    >
                      <BrainCircuit size={12} />
                      {isMatching ? 'Calculating...' : 'Run Smart Match'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {isMatching && (
                      <div className="py-6 text-center space-y-3">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                          className="w-8 h-8 border-2 border-slate-100 border-t-blue-600 rounded-full mx-auto"
                        />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">Analyzing Profiles...</p>
                      </div>
                    )}

                    {!isMatching && matchResults.length > 0 && matchResults.map((r: any) => {
                      const v = volunteers.find((vol: any) => vol.id === r.volunteerId);
                      if (!v) return null;
                      const isAssigned = selectedTask.current_assigned.includes(v.id);
                      const isBurnout = v.fatigue_score > 4;
                      return (
                        <div key={v.id} className={`p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-300 transition-all flex items-start gap-3 ${isBurnout ? 'opacity-60' : ''}`}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border ${isAssigned ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-blue-600 border-blue-100'}`}>
                            {r.matchScore}%
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                               <h6 className="text-[13px] font-bold text-slate-800">{v.name}</h6>
                               {isBurnout && <span className="text-[9px] uppercase font-bold text-amber-600 flex items-center gap-0.5"><AlertTriangle size={10} /> Fatigue</span>}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium leading-tight mt-1">{r.reason}</p>
                            <button 
                              onClick={() => onAssign(selectedTask.task_id, v.id)}
                              disabled={isAssigned || isBurnout}
                              className={`mt-4 w-full py-2 rounded text-[10px] font-bold transition-all uppercase tracking-widest ${
                                isAssigned 
                                  ? 'bg-emerald-50 text-emerald-700 cursor-default shadow-sm border border-emerald-100' 
                                  : isBurnout 
                                    ? 'bg-slate-100 text-slate-400 opacity-50'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                              }`}
                            >
                              {isAssigned ? 'Deployed' : isBurnout ? 'Bypassed' : 'Assign Match'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {!isMatching && matchResults.length === 0 && (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <MessageSquareHeart size={20} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">Launch Smart Match</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-100 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-4">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-loose">Select Mission for Deployment</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function AnalyticsView({ volunteers, tasks }: any) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const data = await getNGOAnalytics(volunteers, tasks);
    setReport(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport();
  }, [volunteers, tasks]);

  const skillData = [
    { name: 'Mentorship', count: 12, full: 20 },
    { name: 'Fieldwork', count: 18, full: 20 },
    { name: 'IT/Tech', count: 4, full: 20 },
    { name: 'Admin', count: 15, full: 20 },
    { name: 'Medical', count: 2, full: 20 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
      id="analytics-view"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold mb-6 uppercase tracking-widest text-slate-400">Skill Density Analysis</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {skillData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-[11px] font-bold mb-6 uppercase tracking-widest text-slate-400">Asset Distribution</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ name: 'Filled', value: 65 }, { name: 'Urgent', value: 35 }]}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#F1F5F9" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Idle</span>
                  </div>
                </div>
             </div>

             <div className="bg-slate-900 p-8 rounded-xl text-white shadow-xl flex flex-col justify-between">
                <div>
                   <TrendingUp className="mb-4 text-blue-400" />
                   <h3 className="text-xl font-bold font-sans">Projected Yield</h3>
                   <p className="text-slate-400 text-xs mt-3 leading-relaxed">
                     Strategic mobilization trends indicate a 25% increase in operational capacity by Q3.
                   </p>
                </div>
                <div className="text-4xl font-bold mt-8 tracking-tighter text-blue-400">+25.4%</div>
             </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-md space-y-8">
            <h3 className="text-[11px] font-bold flex items-center gap-2 uppercase tracking-widest text-blue-600">
               <BrainCircuit size={16} />
               Strategic Audit
            </h3>

            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                <div className="h-32 bg-slate-100 rounded w-full"></div>
                <div className="h-20 bg-slate-100 rounded w-full"></div>
              </div>
            ) : report ? (
              <>
                <div className="space-y-4">
                   <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Priority Gaps</div>
                   <div className="flex flex-wrap gap-2">
                     {report.scarceSkills.map((s: string) => (
                       <span key={s} className="px-2 py-1 bg-red-50 text-red-600 rounded text-[10px] font-bold border border-red-100 uppercase">
                         {s}
                       </span>
                     ))}
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Under-Served Clusters</div>
                   <ul className="space-y-2">
                     {report.underAssignedTasks.map((t: string) => (
                       <li key={t} className="text-[11px] text-slate-600 font-medium flex items-start gap-3">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
                         {t}
                       </li>
                     ))}
                   </ul>
                </div>

                <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-100">
                   <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Leadership Potential</div>
                   <div className="space-y-4">
                     {report.topVolunteers.map((v: any) => (
                       <div key={v.name} className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-[10px] uppercase">
                           {v.name[0]}
                         </div>
                         <div>
                            <div className="text-xs font-bold text-slate-800">{v.name}</div>
                            <div className="text-[9px] text-slate-500 italic mt-0.5">{v.reason.slice(0, 45)}...</div>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Failed to generate report. Check your API key.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

