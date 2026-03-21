"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, CalendarClock, Settings, MessageSquare, Plus, Trash2, Edit2, Loader2, BellRing, BellOff, Send, Sparkles, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Sun, Moon, LogOut, Bot, LayoutGrid, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Cron } from 'croner';
import cronstrue from 'cronstrue';
import { useTheme } from 'next-themes';

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [contacts, setContacts] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [adminNotifications, setAdminNotifications] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, setTheme } = useTheme();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
    // Poll for background AI queue updates & QR connections every 10 seconds
    const pollQueue = async () => {
      const [qRes, setRes] = await Promise.all([
        supabase.from('delivery_queue').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('settings').select('qr_code, connection_status').eq('id', 1).single()
      ]);
      if (qRes.count !== null) setPendingApprovals(qRes.count);
      if (setRes.data) {
        setQrCode(setRes.data.qr_code);
        setConnectionStatus(setRes.data.connection_status);
      }
    };
    const timer = setInterval(pollQueue, 10000);
    return () => clearInterval(timer);
  }, []);

  async function fetchData() {
    setLoading(true);
    const [cRes, sRes, setRes, qRes] = await Promise.all([
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('schedules').select('*').order('created_at', { ascending: false }),
      supabase.from('settings').select('*').eq('id', 1).single(),
      supabase.from('delivery_queue').select('id', { count: 'exact' }).eq('status', 'draft')
    ]);
    if (cRes.data) setContacts(cRes.data);
    if (sRes.data) setSchedules(sRes.data);
    if (setRes.data) {
      setAdminNotifications(setRes.data.admin_notifications);
      setQrCode(setRes.data.qr_code);
      setConnectionStatus(setRes.data.connection_status);
    }
    if (qRes.count !== null) setPendingApprovals(qRes.count);
    setLoading(false);
  }

  const toggleNotifications = async () => {
    const newVal = !adminNotifications;
    // Optimistic UI update
    setAdminNotifications(newVal);
    // Upsert into DB (creates if doesn't exist, updates if does)
    await supabase.from('settings').upsert({ id: 1, admin_notifications: newVal });
  };

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    window.location.href = '/login';
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'schedules', label: 'Schedules', icon: CalendarClock },
    { id: 'approvals', label: 'Approvals', icon: CheckCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-[#0f172a] transition-colors duration-500 overflow-x-hidden">
       {/* Sidebar - Desktop only */}
       <aside className={`hidden md:flex ${sidebarOpen ? 'w-72' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 flex-col transition-all duration-300 relative z-50 shrink-0`}>
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'gap-3 px-2' : 'justify-center'} mb-4 md:mb-12`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20 flex-shrink-0">
            <MessageSquare className="text-white w-5 h-5" />
          </div>
          {sidebarOpen && (
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
               Agent<span className="text-emerald-500">Flow</span>
               <div className="md:hidden flex items-center ml-1">
                 {connectionStatus === 'connected' ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                 ) : connectionStatus === 'pairing' && qrCode ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
                 ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                 )}
               </div>
            </h1>
          )}
        </div>

        {/* Nav */}
        <nav className="flex md:flex-col gap-2 overflow-x-auto overflow-y-hidden pb-1 md:pb-0 shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`relative flex items-center ${sidebarOpen ? 'gap-2 md:gap-3 px-4' : 'justify-center px-0'} py-2.5 md:py-3 rounded-xl transition-all duration-300 text-sm font-medium whitespace-nowrap shrink-0 ${
                activeTab === item.id 
                  ? 'text-emerald-600 dark:text-white' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/5'
              }`}
            >
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon className="w-5 h-5 relative z-10 flex-shrink-0" />
              {sidebarOpen && <span className="relative z-10 flex-1 text-left">{item.label}</span>}
              {sidebarOpen && item.id === 'approvals' && pendingApprovals > 0 && (
                <span className="relative z-10 bg-amber-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-amber-500/20">
                  {pendingApprovals}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer: Connection Status + Theme Toggle */}
        <div className="hidden md:flex mt-auto pt-6 border-t border-slate-200 dark:border-white/10 flex-col gap-2">
           {connectionStatus === 'connected' ? (
              <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'} text-emerald-600 dark:text-emerald-400 text-sm font-medium px-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-lg shadow-emerald-500/10`}>
                 <CheckCircle className="w-5 h-5 flex-shrink-0" />
                 {sidebarOpen && <span>Backend Connected</span>}
              </div>
           ) : connectionStatus === 'pairing' && qrCode ? (
              <div className={`flex flex-col gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl`}>
                 <div className="flex items-center gap-2 text-amber-500 font-medium">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    {sidebarOpen && <span>Scan to Connect</span>}
                 </div>
                 {sidebarOpen && (
                   <div className="bg-white p-2 rounded-xl shadow-lg">
                     <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`} alt="WhatsApp QR" className="w-full h-auto rounded-lg" />
                   </div>
                 )}
              </div>
           ) : (
              <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'} text-slate-400 dark:text-slate-400 text-sm font-medium px-2 py-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl`}>
                 <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                 {sidebarOpen && <span>Backend Offline</span>}
              </div>
           )}
           {/* Theme Toggle */}
           <button
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
             className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl text-sm font-medium transition-all hover:bg-slate-200/60 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400`}
           >
             {mounted && (theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />)}
             {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
           </button>

           {/* Logout Button */}
           <form action="/api/auth" method="POST" className={`flex items-center ${sidebarOpen ? 'px-4' : 'justify-center'} w-full`}>
             <input type="hidden" name="action" value="logout" />
             <button
               type="submit"
               title="Log out"
               className={`w-full flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'} py-3 rounded-xl text-sm font-medium transition-all hover:bg-red-500/10 text-red-500`}
             >
               <LogOut className="w-5 h-5 flex-shrink-0" />
               {sidebarOpen && <span>Log Out</span>}
             </button>
           </form>
        </div>

        {/* Sidebar Collapse Button */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full shadow-md items-center justify-center text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors z-30"
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </aside>

       <main className="flex-1 overflow-y-auto relative z-10">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 sticky top-0 z-40">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
               <Bot className="w-5 h-5" />
             </div>
             <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Antigravity</h1>
           </div>
           <button
             onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
             className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400"
           >
             {mounted && (theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
           </button>
        </div>

        {/* Desktop Gradients */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none hidden md:block" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none hidden md:block" />

        {/* Main Content Area */}
        <div className="md:p-10 p-5 relative h-full max-w-6xl mx-auto pb-28 md:pb-10">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
          ) : mounted ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && (
                  <OverviewTab 
                    contacts={contacts} 
                    schedules={schedules} 
                    onSwitchTab={(t) => setActiveTab(t)}
                  />
                )}
                {activeTab === 'contacts' && <ContactsTab contacts={contacts} onUpdate={fetchData} />}
                {activeTab === 'schedules' && <SchedulesTab schedules={schedules} contacts={contacts} onUpdate={fetchData} />}
                {activeTab === 'approvals' && <ApprovalsTab onUpdate={fetchData} />}
                {activeTab === 'settings' && <SettingsTab adminNotifications={adminNotifications} setAdminNotifications={setAdminNotifications} />}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
        {/* Mobile Bottom Navigation */}
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-2 shadow-2xl flex items-center justify-around">
            {[
              { id: 'overview', icon: LayoutGrid, label: 'Overview' },
              { id: 'schedules', icon: CalendarClock, label: 'Schedules' },
              { id: 'contacts', icon: Users, label: 'Contacts' },
              { id: 'approvals', icon: UserCheck, label: 'Approvals' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${activeTab === item.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ==========================================
// TABS
// ==========================================

function OverviewTab({ schedules, contacts, onSwitchTab }: { schedules: any[], contacts: any[], onSwitchTab: (t: string) => void }) {
  const activeSchedules = schedules.filter(s => s.is_active);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update every single second for the live countdown clock
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getNextRunText = (cronStr: string) => {
    try {
      const job = new Cron(cronStr);
      const nextDate = job.nextRun();
      
      if (!nextDate) return 'Invalid cron';
      
      // Calculate remaining milliseconds
      const diffMs = nextDate.getTime() - new Date().getTime();
      if (diffMs < 0) return 'Executing now...';
      
      // Math to extract days, hours, minutes, seconds
      const seconds = Math.floor((diffMs / 1000) % 60);
      const minutes = Math.floor((diffMs / 60000) % 60);
      const hours = Math.floor((diffMs / 3600000) % 24);
      const days = Math.floor(diffMs / 86400000);
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      
      if (days > 0) return `in ${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      if (hours > 0) return `in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      return `in ${pad(minutes)}:${pad(seconds)}`;
    } catch (e: any) {
      return e.message || 'Error parsing';
    }
  };

  const triggerNow = async (scheduleId: string) => {
    await supabase.from('manual_triggers').insert([{ schedule_id: scheduleId }]);
  };
  
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-slate-900 dark:text-white dark:bg-clip-text dark:text-transparent dark:bg-gradient-to-r dark:from-white dark:to-slate-400">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Schedules" value={activeSchedules.length.toString()} trend="Running on agent" />
        <StatCard title="Total Contacts" value={contacts.length.toString()} trend="In your network" />
        <StatCard title="System Status" value="Online" trend="Agent connected" />
      </div>

      <div className="mt-8 p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
        <h3 className="text-xl font-semibold mb-6 text-slate-800 dark:text-white">Active Executions</h3>
        <ul className="space-y-4">
          {activeSchedules.length === 0 ? <p className="text-slate-400">No active schedules yet.</p> : null}
           {activeSchedules.map(task => {
             const contact = contacts.find(c => c.id === task.contact_id);
             const displayName = contact ? contact.name : task.recipient_name; // fallback to recipient_name for backward compatibility during migration
             return (
              <li key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition duration-300 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-bold text-slate-900 dark:text-white text-xl truncate">
                    {displayName}
                  </p>
                  <span className="px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Active</span>
                </div>
                <p className="text-emerald-600 dark:text-emerald-400 font-mono text-sm mt-2 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> {task.time_cron}</span>
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span> 
                  <span className="text-emerald-500/80 font-semibold">{getNextRunText(task.time_cron)}</span>
                </p>
              </div>
              <div className="shrink-0">
                 <button onClick={() => triggerNow(task.id)} title="Send Message Immediately" className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition font-bold text-sm shadow-lg shadow-emerald-500/10 active:scale-95">
                    <Send className="w-4 h-4" /> Send Now
                 </button>
              </div>
            </li>
             );
           })}
        </ul>
      </div>
    </div>
  );
}

function SettingsTab({ adminNotifications, setAdminNotifications }: { adminNotifications: boolean, setAdminNotifications: (v: boolean) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-slate-500 mt-1">Configure global agent preferences.</p>
      </div>

      <div className="mt-8 grid gap-4">
        <div className="flex items-center justify-between p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-md hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-start gap-4">
             <div className={`p-3 rounded-xl shadow-lg border ${adminNotifications ? 'bg-emerald-500/20 border-emerald-500/30 shadow-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-white/10 text-slate-400'}`}>
                {adminNotifications ? <BellRing className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Admin Forwarding</h3>
               <p className="text-slate-500 mt-1 max-w-md">When enabled, any reply received by your bot (from any contact) will automatically be forwarded to your personal admin number.</p>
             </div>
          </div>
          <button 
             onClick={() => setAdminNotifications(!adminNotifications)} 
             className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${adminNotifications ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${adminNotifications ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ contacts, onUpdate }: { contacts: any[], onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [persona, setPersona] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPersona, setEditPersona] = useState('');

  const handleAdd = async () => {
    if (!name || !phone) return;
    setSaving(true);
    await supabase.from('contacts').insert([{ name, phone, persona_context: persona }]);
    setSaving(false);
    setShowAdd(false);
    setName(''); setPhone(''); setPersona('');
    onUpdate();
  };

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditPersona(c.persona_context || '');
  };

  const saveEdit = async () => {
    setSaving(true);
    await supabase.from('contacts').update({ name: editName, phone: editPhone, persona_context: editPersona }).eq('id', editingId);
    setSaving(false);
    setEditingId(null);
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    await supabase.from('contacts').delete().eq('id', id);
    onUpdate();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Contacts</h2>
          <p className="text-slate-500 mt-1">Manage all your agent recipients here.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 font-medium">
          <Plus className="w-5 h-5" /> Add Contact
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-md">
             <div className="flex flex-col gap-3">
                <div className="flex gap-4">
                  <input type="text" placeholder="Name (e.g. Dad)" value={name} onChange={e => setName(e.target.value)} className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 flex-1" />
                  <input type="text" placeholder="Phone (e.g. 15551234567)" value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 flex-1" />
                </div>
                <textarea rows={2} placeholder="Global Persona Context — optional" value={persona} onChange={e => setPersona(e.target.value)} className="w-full bg-emerald-500/5 border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-700 dark:text-emerald-300 placeholder:text-emerald-500/30 outline-none focus:border-emerald-500/50 resize-none text-sm" />
                <PersonaSuggestions onSelect={s => setPersona(s)} />
                <p className="text-xs text-slate-500 -mt-1">This persona is permanently woven into every AI message sent to this contact.</p>
                <div className="flex justify-end gap-2">
                   <button onClick={() => { setShowAdd(false); setName(''); setPhone(''); setPersona(''); }} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition font-medium">Cancel</button>
                   <button disabled={saving} onClick={handleAdd} className="bg-emerald-500 text-white px-8 py-2 rounded-xl font-bold hover:bg-emerald-400 transition">Save</button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 mt-8">
        {contacts.length === 0 ? <p className="text-slate-400">No contacts yet.</p> : null}
        {contacts.map(c => (
          <div key={c.id} className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 overflow-hidden">
            {editingId === c.id ? (
              <div className="p-5 flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Editing Contact</p>
                <div className="flex gap-3">
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 flex-1 text-sm" />
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone" className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 flex-1 font-mono text-sm" />
                </div>
                <textarea rows={2} value={editPersona} onChange={e => setEditPersona(e.target.value)} placeholder="Global Persona Context (optional)" className="w-full bg-emerald-500/5 border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-700 dark:text-emerald-300 placeholder:text-emerald-500/30 outline-none focus:border-emerald-500/50 resize-none text-sm" />
                <PersonaSuggestions onSelect={s => setEditPersona(s)} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition text-sm font-medium">Cancel</button>
                  <button disabled={saving} onClick={saveEdit} className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-400 transition text-sm">Save</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 group">
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold shadow-inner shrink-0 text-white tracking-widest">{c.name[0] || '?'}</div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 bg-slate-100 dark:bg-black/40 px-3 py-1 rounded-lg font-mono inline-block border border-slate-200 dark:border-white/5">+{c.phone}</p>
                    {c.persona_context && (
                       <div className="mt-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 max-w-xl group-hover:border-emerald-500/20 transition-all">
                         <p className="text-emerald-700 dark:text-emerald-400 text-xs italic line-clamp-2">"{c.persona_context}"</p>
                       </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                   <button onClick={() => startEdit(c)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition group-hover:shadow-lg group-hover:shadow-indigo-500/5"><Edit2 className="w-4 h-4" /></button>
                   <button onClick={() => handleDelete(c.id)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition group-hover:shadow-lg group-hover:shadow-red-500/5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulesTab({ schedules, contacts, onUpdate }: { schedules: any[], contacts: any[], onUpdate: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [cron, setCron] = useState('');
  const [nlCron, setNlCron] = useState('');
  const [genCronLoading, setGenCronLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCron, setEditCron] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  const handleAdd = async () => {
    if (!recipient || !cron || !prompt) return;
    setSaving(true);
    
    const contact = contacts.find(c => c.name === recipient);
    if (!contact) {
      alert("Must choose an existing contact name");
      setSaving(false);
      return;
    }

    await supabase.from('schedules').insert([{ 
      contact_id: contact.id,
      time_cron: cron,
      constraint_prompt: prompt,
      requires_approval: requiresApproval
    }]);
    
    setSaving(false);
    setShowAdd(false);
    setRecipient(''); setCron('0 9 * * *'); setPrompt(''); setRequiresApproval(false);
    onUpdate();
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditCron(s.time_cron);
    setEditPrompt(s.constraint_prompt);
  };

  const saveEdit = async () => {
    setSaving(true);
    await supabase.from('schedules').update({
      time_cron: editCron,
      constraint_prompt: editPrompt
    }).eq('id', editingId);
    setSaving(false);
    setEditingId(null);
    onUpdate();
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('schedules').update({ is_active: !currentStatus }).eq('id', id);
    onUpdate();
  };
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    await supabase.from('schedules').delete().eq('id', id);
    onUpdate();
  };  const groupedSchedules = schedules.reduce((acc, curr) => {
    const contact = contacts.find(c => c.id === curr.contact_id);
    const recipientName = contact ? contact.name : 'Unknown Contact';
    if (!acc[recipientName]) acc[recipientName] = [];
    acc[recipientName].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const cronDescription = (cron: string) => {
    try { return cronstrue.toString(cron); } catch { return 'Custom Schedule'; }
  };

  return (
    <div className="space-y-8 pb-32 max-w-full overflow-x-hidden">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">AI Schedules</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure automated LLM generation rules.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 font-medium whitespace-nowrap">
          <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Add Schedule</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-none backdrop-blur-md flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Select Contact</p>
                <ContactDropdown
                  contacts={contacts}
                  value={recipient}
                  onChange={setRecipient}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Schedule (English or Cron)</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="e.g. Every day at 9am" value={nlCron} onChange={e => setNlCron(e.target.value)} className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-emerald-700 dark:text-emerald-400 placeholder:text-emerald-500/40 text-sm flex-1 outline-none focus:border-emerald-500/50" />
                  <button onClick={async () => {
                     setGenCronLoading(true);
                     try {
                       const res = await fetch('/api/cron', { method: 'POST', body: JSON.stringify({ prompt: nlCron }) });
                       const data = await res.json();
                       if (data.cron) setCron(data.cron);
                     } finally { setGenCronLoading(false); }
                  }} disabled={genCronLoading} className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                    {genCronLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI
                  </button>
                </div>
                <input type="text" placeholder="Generated Cron" value={cron} onChange={e => setCron(e.target.value)} className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono text-xs" />
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500/80 font-bold px-1 italic">
                   {cron ? (() => { try { return cronstrue.toString(cron); } catch { return '⚠️ Invalid Format'; }})() : ''}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">AI Personality & Logic</p>
              <textarea placeholder="e.g. 'Remind mom to call me, sound caring.'" value={prompt} onChange={e => setPrompt(e.target.value)} className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-4 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 h-24 resize-none text-sm" />
              <PersonaSuggestions onSelect={(s) => setPrompt(s)} />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-2">
              <button
                type="button"
                onClick={() => setRequiresApproval(r => !r)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                  requiresApproval
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <Clock className="w-4 h-4" />
                {requiresApproval ? '✋ Approval Required' : '⚡ Auto-Send (No Approval)'}
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setShowAdd(false);
                  }} 
                  className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition font-bold text-sm flex-1 sm:flex-none"
                >
                  Cancel
                </button>
                <button disabled={saving} onClick={handleAdd} className="bg-emerald-500 text-black px-8 py-2.5 rounded-xl font-bold hover:bg-emerald-400 transition flex-1 sm:flex-none shadow-lg shadow-emerald-500/20">Save Schedule</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-14 mt-10">
        {schedules.length === 0 ? <div className="text-center py-20 opacity-40"><Bot className="w-16 h-16 mx-auto mb-4" /><p className="text-xl font-bold">No schedules configured</p></div> : null}
        
        {(Object.entries(groupedSchedules) as any).map(([recipient, userSchedules]: [string, any[]]) => (
          <div key={recipient} className="space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-lg font-bold shadow-inner shrink-0 text-white">
                {recipient[0] || '?'}
              </div>
              <span className="truncate">{recipient}</span>
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-auto bg-slate-100 dark:bg-black/30 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5 uppercase tracking-tighter">
                {userSchedules.length} Sub-Task{userSchedules.length !== 1 ? 's' : ''}
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {userSchedules.map(s => (
                <div key={s.id} className={`relative overflow-hidden rounded-3xl border transition-all duration-300 group ${s.is_active ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-emerald-500/30 shadow-sm' : 'bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/5 opacity-60'}`}>
                  
                  {editingId === s.id ? (
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Strategy</h3>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><XCircle className="w-5 h-5" /></button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-slate-500 font-black uppercase mb-1.5 block tracking-widest">Cron Interval</label>
                          <input type="text" value={editCron} onChange={e => setEditCron(e.target.value)} className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-full font-mono text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-black uppercase mb-1.5 block tracking-widest">Logic Constraint</label>
                          <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 w-full h-24 resize-none text-sm" />
                        </div>
                        <button disabled={saving} onClick={saveEdit} className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/20">Update Change</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 opacity-80">{s.time_cron}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${s.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10'}`}>
                              {s.is_active ? 'Running' : 'Paused'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug truncate">
                            {cronDescription(s.time_cron)}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => startEdit(s)} className="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => toggleStatus(s.id, s.is_active)} className={`px-3 py-1.5 rounded-lg border transition text-[10px] font-bold uppercase tracking-wider ${s.is_active ? 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:border-amber-500/30' : 'bg-emerald-500 text-black border-emerald-600 shadow-lg shadow-emerald-500/20'}`}>{s.is_active ? 'Pause' : 'Resume'}</button>
                        </div>
                      </div>

                      <div className="mt-auto p-4 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 relative group/prompt">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Constraint</p>
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500/30 group-hover/prompt:text-emerald-500/60 transition-all" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic border-l-2 border-emerald-500/30 pl-3 text-[13px] line-clamp-3 group-hover/prompt:line-clamp-none transition-all duration-300">"{s.constraint_prompt}"</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, trend }: { title: string, value: string, trend: string }) {
  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none backdrop-blur-md hover:border-emerald-500/30 hover:shadow-xl hover:shadow-black/5 transition-all duration-300">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
      <p className="text-4xl font-black mt-3 text-slate-900 dark:text-white tracking-tight">{value}</p>
      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-4 font-bold flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        {trend}
      </p>
    </div>
  );
}

function ContactDropdown({ contacts, value, onChange }: { contacts: any[], value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selected = contacts.find(c => c.name === value);
  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all duration-300 ${
          open ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-slate-50 dark:bg-black/60' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 hover:border-slate-300 dark:hover:border-white/20 text-slate-900 dark:text-white'
        }`}
      >
        {selected ? (
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">{selected.name[0]}</span>
            <div className="text-left">
              <p className="text-slate-900 dark:text-white font-bold leading-none mb-0.5">{selected.name}</p>
              <p className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">+{selected.phone}</p>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">Choose a contact...</span>
        )}
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-[60] bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5 p-1.5 custom-scrollbar">
            {filtered.length === 0 && <p className="text-slate-400 text-xs text-center py-8 font-medium italic">No matches found</p>}
            {filtered.map(c => (
              <button key={c.id} type="button" onClick={() => { onChange(c.name); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${value === c.name ? 'bg-emerald-500 text-black font-bold' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'}`}>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${value === c.name ? 'bg-black/20 text-black' : 'bg-gradient-to-tr from-indigo-500 to-purple-500 text-white'}`}>{c.name[0]}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{c.name}</p>
                  <p className={`text-[10px] font-mono ${value === c.name ? 'text-black/60' : 'text-slate-400'}`}>+{c.phone}</p>
                </div>
                {value === c.name && <CheckCircle className="ml-auto w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PERSONA_SUGGESTIONS = [
  { label: "👨‍👧 Parent", text: "This is my parent. Use warm, caring language. Keep messages short and clear." },
  { label: "👫 Close Friend", text: "This is my best friend. Super casual tone, use humor and banter." },
  { label: "💼 Colleague", text: "This is a work colleague. Keep it professional and concise. Formal greetings." },
  { label: "❤️ Partner", text: "This is my romantic partner. Use affectionate, loving language. Emojis are welcome." },
  { label: "🧓 Elder", text: "This is an elder relative. Very respectful and formal tone. Simple words only." },
  { label: "📱 Tech Bro", text: "This person is very tech-savvy. Be direct, use technical shorthand and abbreviations." },
];

const LANGUAGE_SUGGESTIONS = [
  { label: "🇬🇧 English", text: "Write in clear, natural English." },
  { label: "🇮🇳 Hinglish", text: "Write in Hinglish — Hindi words in English script mixed with English naturally. Example style: 'Aaj khaana kha lena, aur apna khayal rakhna ❤️'." },
  { label: "🙏 Hindi", text: "Write entirely in Hindi using English script (Romanized Hindi). Example: 'Aaj dawai lena mat bholiega. Apna dhyan rakhiye.'" },
  { label: "😎 Gen Z", text: "Write in Gen Z slang. Use words like 'bestie', 'no cap', 'lowkey', 'slay', 'periodt'. Keep it chaotic and fun." },
  { label: "🎩 Formal", text: "Use very formal, polished English. Complete sentences. No contractions. Professional tone throughout." },
  { label: "😂 Funny", text: "Be humorous and witty. Use jokes, puns, or playful sarcasm where appropriate. Keep it light-hearted." },
];

function PersonaSuggestions({ onSelect }: { onSelect: (s: string) => void }) {
  const [selectedPersona, setSelectedPersona] = useState('');
  const [selectedLang, setSelectedLang] = useState('');

  const buildAndSelect = (persona: string, lang: string) => {
    const parts = [persona, lang].filter(Boolean);
    onSelect(parts.join(' '));
  };

  const handlePersona = (text: string) => {
    const next = selectedPersona === text ? '' : text;
    setSelectedPersona(next);
    buildAndSelect(next, selectedLang);
  };

  const handleLang = (text: string) => {
    const next = selectedLang === text ? '' : text;
    setSelectedLang(next);
    buildAndSelect(selectedPersona, next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <p className="w-full text-xs text-slate-600 mb-0.5">Relationship:</p>
        {PERSONA_SUGGESTIONS.map(s => (
          <button key={s.label} type="button" onClick={() => handlePersona(s.text)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all duration-150 ${selectedPersona === s.text ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-indigo-500/30 hover:text-indigo-300'}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <p className="w-full text-xs text-slate-600 mb-0.5">Language Style:</p>
        {LANGUAGE_SUGGESTIONS.map(s => (
          <button key={s.label} type="button" onClick={() => handleLang(s.text)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all duration-150 ${selectedLang === s.text ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300'}`}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ApprovalsTab({ onUpdate }: { onUpdate?: () => void }) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('delivery_queue')
      .select(`
        *,
        contacts (
          name,
          phone
        )
      `)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
      
    const mappedQueue = (data || []).map(row => ({
        ...row,
        recipient_name: row.contacts?.name || 'Unknown Contact',
        contact_number: row.contacts?.phone || 'Unknown Phone'
    }));
    
    setQueue(mappedQueue);
    setLoading(false);
  };

  useEffect(() => { fetchQueue(); }, []);

  const approve = async (item: any) => {
    setActing(item.id);
    // Mark as approved — backend will pick this up and send
    await supabase.from('delivery_queue').update({ status: 'approved' }).eq('id', item.id);
    await fetchQueue();
    if (onUpdate) onUpdate();
    setActing(null);
  };

  const discard = async (id: string) => {
    setActing(id);
    await supabase.from('delivery_queue').update({ status: 'discarded' }).eq('id', id);
    await fetchQueue();
    if (onUpdate) onUpdate();
    setActing(null);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Approvals</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review AI generated messages before they go out.</p>
        </div>
        <button onClick={fetchQueue} className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl transition text-sm">
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
          <CheckCircle className="w-12 h-12 text-emerald-500/30" />
          <p className="text-lg font-semibold">All clear — no messages awaiting approval.</p>
          <p className="text-sm">Enable "Approval Required" on a schedule to see drafts here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map(item => (
            <div key={item.id} className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-amber-500/20 shadow-sm dark:shadow-none">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">Draft</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">To: {item.recipient_name}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">+{item.contact_number}</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 text-base leading-relaxed bg-slate-50 dark:bg-black/30 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/5">
                    {item.message_text}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-2">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => approve(item)}
                    disabled={acting === item.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 font-bold text-sm transition"
                  >
                    {acting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send
                  </button>
                  <button
                    onClick={() => discard(item.id)}
                    disabled={acting === item.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-700 dark:hover:text-red-400 font-bold text-sm transition"
                  >
                    <XCircle className="w-4 h-4" /> Discard
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
