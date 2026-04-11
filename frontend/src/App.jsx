import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Terminal, 
  Settings, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  RefreshCw,
  Box,
  Layers,
  ChevronRight,
  Users,
  BarChart3,
  MessageSquare,
  Clock,
  Search,
  ExternalLink,
  Cpu,
  Send,
  Download,
  Upload,
  Zap,
  Play,
  Database,
  Code,
  Copy,
  PlusCircle,
  MinusCircle,
  Table,
  BookOpen,
  UserPlus,
  BrainCircuit,
  User,
  Mail,
  ChevronDown,
  Check
} from 'lucide-react';

import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// --- UI Helper Components ---
const SkeletonLead = () => (
  <div className="w-full p-4 rounded-2xl border border-white/5 animate-skeleton flex items-center gap-3">
    <div className="size-10 rounded-lg bg-white/5" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-white/5 rounded w-3/4" />
      <div className="h-3 bg-white/5 rounded w-1/2" />
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, message, action }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center p-12 text-center"
  >
    <div className="p-6 rounded-full bg-white/5 mb-6">
      <Icon className="size-12 text-primary opacity-20" />
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-text-secondary text-sm max-w-xs mb-6">{message}</p>
    {action}
  </motion.div>
);


// 從 .env 讀取後端設定，若無則自動偵測當前 IP
const apiHost = import.meta.env.VITE_API_HOST || window.location.hostname;
const apiPort = import.meta.env.VITE_API_PORT || '8000';

const API_BASE = `http://${apiHost}:${apiPort}`;
const WS_URL = `ws://${apiHost}:${apiPort}/ws/logs`;

function App() {
  const [logs, setLogs] = useState([]);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('activeTab') || 'dashboard'); // dashboard, leads, customers, analytics
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  
  // 客戶管理相關狀態
  const [selectedLead, setSelectedLead] = useState(null);
  const [platformFilter, setPlatformFilter] = useState('all'); // 'all', 'line', 'gmail'
  const [leadLogs, setLeadLogs] = useState([]);
  const [availableLists, setAvailableLists] = useState([]);
  const [currentLeadLists, setCurrentLeadLists] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // CRM 2.0 新增狀態
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [quickReplyMsg, setQuickReplyMsg] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  
  // -- Broadcast State --
  const [broadcastTemplates, setBroadcastTemplates] = useState({});
  const [currentSlot, setCurrentSlot] = useState(1);
  const [editorName, setEditorName] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorType, setEditorType] = useState('text');
  const [targetListId, setTargetListId] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notification, setNotification] = useState(null);
  
  // SQL Analysis Lab State
  const [sqlQueries, setSqlQueries] = useState([
    { id: 'sql1', query: "SELECT count(*) as count FROM interaction_logs WHERE content LIKE '%中秋節%'", result: null, loading: false },
    { id: 'sql2', query: "SELECT count(*) as count FROM interaction_logs WHERE content LIKE '%國慶日%'", result: null, loading: false }
  ]);
  const [showComparison, setShowComparison] = useState(false);
  
  // Onboarding Engine State
  const [onboardingSteps, setOnboardingSteps] = useState([]);
  const [newStepMsg, setNewStepMsg] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [leadAIContext, setLeadAIContext] = useState(null);
  const [broadcastJobs, setBroadcastJobs] = useState([]);
  
  const logEndRef = useRef(null);

  const fetchData = async (showLoading = false) => {
    if (showLoading) setIsLoadingLeads(true);
    try {
      const [leadsRes, tasksRes, listsRes] = await Promise.all([
        axios.get(`${API_BASE}/leads`),
        axios.get(`${API_BASE}/tasks`),
        axios.get(`${API_BASE}/lists`)
      ]);
      setLeads(leadsRes.data);
      setTasks(tasksRes.data);
      setAvailableLists(listsRes.data);
      setIsConnected(true);
    } catch (error) {
      console.error("Fetch Error:", error);
      setIsConnected(false);
      showNotification("無法連接到伺服器", "error");
    } finally {
      setIsLoadingLeads(false);
    }
  };

  
  useEffect(() => {
    fetchData(true);

    let ws;
    
    const connectWS = () => {
      ws = new WebSocket(WS_URL);
      
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWS, 3000); // 重連機制
      };
      
      ws.onmessage = (event) => {
        try {
          const log = JSON.parse(event.data);
          setLogs(prev => {
            const newLogs = [...prev.slice(-49), { ...log, timestamp: new Date().toLocaleTimeString() }];
            const refreshTriggers = ['BOT_CMD_IN', 'BOT_CMD_OUT', 'TRIGGER_SUCCESS', 'GMAIL_IN', 'GMAIL_OUT', 'GMAIL_RAW'];
            if (refreshTriggers.includes(log.type)) {
              fetchData();
              if (selectedLead) {
                fetchLeadDetails(selectedLead);
              }
            }
            return newLogs;
          });
        } catch (e) {
          console.error("WS Message Error:", e);
        }
      };
    };

    connectWS();
    return () => ws?.close();
  }, []);
  
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, leadLogs]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShowScrollBottom(!isAtBottom);
  };


  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const triggerWorkflow = async (id) => {
    try {
      await axios.post(`${API_BASE}/trigger/${id}`, { 
        source: 'dashboard', 
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      console.error('Trigger Error:', error);
    }
  };
  const fetchLeadDetails = async (lead) => {
    setSelectedLead(lead);
    try {
      const [logsRes, listsRes] = await Promise.all([
        axios.get(`${API_BASE}/leads/${lead.id}/logs`),
        axios.get(`${API_BASE}/leads/${lead.id}/lists`)
      ]);
      setLeadLogs(logsRes.data);
      setCurrentLeadLists(listsRes.data);
    } catch (error) {
      console.error('Fetch Lead Details Error:', error);
    }
  };

  const createNewList = async () => {
    if (!newListName.trim()) return;
    try {
      await axios.post(`${API_BASE}/lists`, { name: newListName });
      setNewListName('');
      fetchData();
    } catch (error) {
      console.error('Create List Error:', error);
    }
  };

  const addLeadToList = async (listId) => {
    if (!selectedLead) return;
    try {
      await axios.post(`${API_BASE}/leads/${selectedLead.id}/lists/${listId}`);
      fetchLeadDetails(selectedLead);
    } catch (error) {
      console.error('Add to List Error:', error);
    }
  };

  const removeLeadFromList = async (listId) => {
    if (!selectedLead) return;
    try {
      await axios.delete(`${API_BASE}/leads/${selectedLead.id}/lists/${listId}`);
      fetchLeadDetails(selectedLead);
    } catch (error) {
      console.error('Remove from List Error:', error);
    }
  };

  const updateLead = async (leadId, data) => {
    try {
      const res = await axios.patch(`${API_BASE}/leads/${leadId}`, data);
      showNotification("客戶資料已更新", "success");
      fetchData(); // 重新整理列表
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(res.data);
      }
      setEditingName(false);
    } catch (error) {
      console.error('Update Lead Error:', error);
      showNotification("更新失敗", "error");
    }
  };

  const deleteList = async (listId) => {
    try {
      await axios.delete(`${API_BASE}/lists/${listId}`);
      fetchData();
    } catch (error) {
      console.error('Delete List Error:', error);
    }
  };

  const sendQuickReply = async () => {
    if (!selectedLead || !quickReplyMsg.trim()) return;
    setIsSendingReply(true);
    try {
      await axios.post(`${API_BASE}/api/message/send`, {
        uid: selectedLead.line_uid || selectedLead.platform_id,
        message: quickReplyMsg,
        source: selectedLead.source || 'line'
      });
      showNotification("訊息已發送", "success");
      setQuickReplyMsg('');
      // Optimistically add to logs or wait for WS
      fetchLeadDetails(selectedLead);
    } catch (error) {
      showNotification("發送失敗", "error");
    } finally {
      setIsSendingReply(false);
    }
  };


  // -- Broadcast Functions --
  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/broadcast/templates`);
      setBroadcastTemplates(res.data);
    } catch (err) {
      console.error("Error fetching templates", err);
    }
  };

  const saveCurrentTemplate = async () => {
    try {
      const res = await axios.post(`${API_BASE}/broadcast/templates/${currentSlot}`, {
        name: editorName,
        content: editorContent,
        msg_type: editorType
      });
      setBroadcastTemplates(prev => ({...prev, [currentSlot]: res.data}));
      showNotification("範本已儲存", "success");
    } catch (err) {
      showNotification("儲存失敗", "error");
    }
  };

  const showNotification = (msg, type) => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleBroadcast = async (isScheduled = false) => {
    if (!targetListId) return showNotification("請選擇投放名單", "error");
    try {
      const payload = {
        list_id: parseInt(targetListId),
        template_id: broadcastTemplates[currentSlot]?.id,
        scheduled_at: isScheduled ? scheduledTime : null
      };
      if (!payload.template_id) return showNotification("請先儲存目前分頁內容", "error");
      
      await axios.post(`${API_BASE}/broadcast/send`, payload);
      showNotification(isScheduled ? "已成功預約發送" : "發送程序已啟動", "success");
      if (isScheduled) fetchBroadcastJobs();
    } catch (err) {
      showNotification("執行失敗", "error");
    }
  };

  const fetchBroadcastJobs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/broadcast/jobs`);
      setBroadcastJobs(res.data);
    } catch (err) {
      console.error("Error fetching broadcast jobs", err);
    }
  };

  const cancelBroadcastJob = async (jobId) => {
    try {
      await axios.delete(`${API_BASE}/broadcast/jobs/${jobId}`);
      showNotification("預約已取消", "success");
      fetchBroadcastJobs();
    } catch (err) {
      showNotification("取消失敗", "error");
    }
  };

  const exportTemplate = () => {
    const data = JSON.stringify({ name: editorName, content: editorContent, type: editorType }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n_template_slot${currentSlot}.json`;
    a.click();
  };

  const importTemplate = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        setEditorName(json.name || '');
        setEditorContent(json.content || '');
        setEditorType(json.type || 'text');
        showNotification("範本已載入，點擊儲存以生效", "success");
      } catch (err) {
        showNotification("檔案格式錯誤", "error");
      }
    };
    reader.readAsText(file);
  };

  // SQL Execution logic
  const runSqlQuery = async (index) => {
    const newQueries = [...sqlQueries];
    newQueries[index].loading = true;
    setSqlQueries(newQueries);

    try {
      const res = await axios.post(`${API_BASE}/api/analytics/query`, { 
        query: newQueries[index].query 
      });
      const updatedQueries = [...sqlQueries];
      updatedQueries[index].result = res.data;
      updatedQueries[index].loading = false;
      setSqlQueries(updatedQueries);
      showNotification("查詢執行成功", "success");
    } catch (err) {
      console.error(err);
      const updatedQueries = [...sqlQueries];
      updatedQueries[index].loading = false;
      setSqlQueries(updatedQueries);
      showNotification(err.response?.data?.detail || "SQL 語法錯誤", "error");
    }
  };

  // --- Onboarding Management Functions ---
  const fetchOnboardingSteps = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/onboarding/steps`);
      setOnboardingSteps(res.data);
    } catch (err) {
      console.error("Error fetching onboarding steps", err);
    }
  };

  const handleAIRecovery = async (leadId) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/ai-context`);
      const data = await res.json();
      setLeadAIContext(data);
      showNotification(`已取得分析資料，請將右側日誌中的 Context 貼給 AI 進行恢復。`, "success");
      
      // Auto-log to special trace for easier copy-paste
      const analysisLog = {
        timestamp: new Date().toLocaleTimeString(),
        type: "🤖 AI RECOVERY CONTEXT",
        data: {
          hint: data.prompt_hint,
          logs: data.recent_logs,
          instructions: "請複製上方 logs 並在對話視窗中使用 'SQL Business Analyst' 技能進行語意分析。"
        }
      };
      setLogs(prev => [analysisLog, ...prev]);
    } catch (err) {
      showNotification("分析資料取得失敗", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addOnboardingStep = async () => {
    if (!newStepMsg.trim()) return;
    try {
      await axios.post(`${API_BASE}/api/onboarding/steps`, {
        step_index: onboardingSteps.length + 1,
        message: newStepMsg,
        msg_type: 'text'
      });
      setNewStepMsg('');
      fetchOnboardingSteps();
      showNotification("教學步驟已新增", "success");
    } catch (err) {
      showNotification("新增失敗", "error");
    }
  };

  const deleteOnboardingStep = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/onboarding/steps/${id}`);
      fetchOnboardingSteps();
      showNotification("步驟已刪除", "success");
    } catch (err) {
      showNotification("刪除失敗", "error");
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchOnboardingSteps();
    if (activeTab === 'broadcast') fetchBroadcastJobs();
  }, [activeTab]);

  useEffect(() => {
    if (broadcastTemplates[currentSlot]) {
      const t = broadcastTemplates[currentSlot];
      setEditorName(t.name || '');
      setEditorContent(t.content || '');
      setEditorType(t.msg_type || 'text');
    } else {
      setEditorName('');
      setEditorContent('');
      setEditorType('text');
    }
  }, [currentSlot, broadcastTemplates]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="bg-mesh"></div>
      
      {/* Header / 頁首 */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 animate-fade-in gap-6">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ rotate: -20, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            className="p-3 glass rounded-2xl bg-primary/20"
          >
            <Zap className="size-8 text-primary fill-primary/30" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">n8n 自動化工廠</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`size-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-error'}`}></div>
              <p className="text-text-secondary text-sm">
                {isConnected ? '系統已連線 (toby-nuc)' : '嘗試連線中...'} 
              </p>
            </div>
          </div>
        </div>
        
        <nav className="glass p-1 rounded-2xl flex gap-1 self-stretch md:self-auto">
          {[
            { id: 'dashboard', label: '控制儀表板' },
            { id: 'leads', label: '線索管理' },
            { id: 'customers', label: '客戶名單' },
            { id: 'broadcast', label: '訊息投放' },
            { id: 'analytics', label: '數據分析' },
            { id: 'onboarding', label: '新手教學設定' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === tab.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content Area / 主要內容 */}
        <section className="lg:col-span-3 space-y-8">
          
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="space-y-8"
              >
                {/* Stats / 統計卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <motion.div variants={itemVariants} className="glass-card p-6 border-l-4 border-primary">
                    <p className="text-text-secondary text-sm mb-1 uppercase tracking-wider font-bold">線索總數</p>
                    <h3 className="text-3xl font-bold">{leads.length}</h3>
                    <div className="mt-2 text-xs text-success flex items-center gap-1">
                      <Activity className="size-3" /> 本週成長 12%
                    </div>
                  </motion.div>
                  
                  <motion.div variants={itemVariants} className="glass-card p-6 border-l-4 border-accent-cyan">
                    <p className="text-text-secondary text-sm mb-1 uppercase tracking-wider font-bold">進行中任務</p>
                    <h3 className="text-3xl font-bold">{tasks.length || 0}</h3>
                    <div className="mt-2 text-xs text-primary flex items-center gap-1">
                      <CheckCircle className="size-3" /> 各項系統正常運作
                    </div>
                  </motion.div>
                  
                  <motion.div variants={itemVariants} className="glass-card p-6 border-l-4 border-accent-pink">
                    <p className="text-text-secondary text-sm mb-1 uppercase tracking-wider font-bold">Bot 指令執行</p>
                    <h3 className="text-3xl font-bold">1,482</h3>
                    <div className="mt-2 text-xs text-text-secondary flex items-center gap-1">
                      <MessageSquare className="size-3" /> 24小時活動量
                    </div>
                  </motion.div>
                </div>

                <div className="flex items-center justify-between mt-12">
                  <h2 className="text-xl flex items-center gap-2 font-bold">
                    <Layers className="size-5 text-primary" /> 自動化工作流狀態
                  </h2>
                  <button 
                    onClick={fetchData}
                    className="p-2 hover:bg-white/10 rounded-full transition-all group"
                  >
                    <RefreshCw className="size-4 text-text-secondary group-hover:rotate-180 transition-transform duration-500" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'SCRAPER', name: '全網內容監測', desc: '串連 Web Scraper 持續追蹤數據' },
                    { id: 'SENDER', name: 'LINE 訊息精準投放', desc: '自動發送個人化通知給潛在客戶' }
                  ].map(wf => (
                    <motion.div 
                      key={wf.id} 
                      variants={itemVariants}
                      whileHover={{ scale: 1.02 }}
                      className="glass-card p-6 flex flex-col justify-between group overflow-hidden relative"
                    >
                      <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                        <Cpu className="size-24 text-white" />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Activity className="size-6 text-primary" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-success/20 text-success border border-success/30">運作中 (RUNNING)</span>
                      </div>
                      <h3 className="text-lg font-bold mb-1 group-hover:text-primary transition-colors">{wf.name}</h3>
                      <p className="text-sm text-text-secondary mb-6">{wf.desc}</p>
                      <button 
                        onClick={() => triggerWorkflow(wf.id)}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-primary hover:border-primary text-sm font-bold transition-all"
                      >
                        手動觸發流程 <ArrowRight className="size-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'leads' && (
              <motion.div 
                key="leads"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-glass-border bg-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Users className="size-6 text-accent-cyan" /> 線索管理系統
                    </h2>
                    <div className="flex bg-black/30 p-1 rounded-xl w-fit border border-white/5 scale-90 -ml-2">
                      {['all', 'line', 'gmail'].map(f => (
                        <button
                          key={f}
                          onClick={() => setPlatformFilter(f)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            platformFilter === f ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-white'
                          }`}
                        >
                          {f === 'all' ? '全部' : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative w-full md:w-auto">
                    <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input 
                      type="text" 
                      placeholder="搜尋線索..." 
                      className="bg-white/5 border border-glass-border rounded-xl pl-11 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-80"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs text-text-secondary uppercase border-b border-glass-border">
                        <th className="px-8 py-5 font-black tracking-widest">用戶資訊 / UID</th>
                        <th className="px-8 py-5 font-black tracking-widest">狀態</th>
                        <th className="px-8 py-5 font-black tracking-widest">興趣行業</th>
                        <th className="px-8 py-5 font-black tracking-widest">最後活動</th>
                        <th className="px-8 py-5 font-black tracking-widest text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glass-border">
                      {isLoadingLeads ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={i}>
                            <td colSpan="5" className="px-8 py-4"><SkeletonLead /></td>
                          </tr>
                        ))
                      ) : leads.filter(l => 
                        platformFilter === 'all' || 
                        (l.source && l.source.toLowerCase() === platformFilter.toLowerCase())
                      ).length > 0 ? leads.filter(l => 
                        platformFilter === 'all' || 
                        (l.source && l.source.toLowerCase() === platformFilter.toLowerCase())
                      ).map((lead, i) => (

                        <motion.tr 
                          key={lead.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              {lead.source === 'gmail' ? (
                                <div className="p-1.5 bg-red-500/10 rounded-lg">
                                  <Mail className="size-4 text-red-500" />
                                </div>
                              ) : (
                                <div className="p-1.5 bg-success/10 rounded-lg">
                                  <MessageSquare className="size-4 text-success" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-lg">{lead.name || '訪客'}</div>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                    lead.source === 'gmail' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-success/10 text-success border-success/20'
                                  }`}>
                                    {lead.source || 'LINE'}
                                  </span>
                                </div>
                                <div className="text-xs text-text-secondary font-mono opacity-60">
                                  {lead.source === 'gmail' ? lead.platform_id : (lead.line_uid?.slice(0, 16) + "...")}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                              lead.status === 'completed' ? 'bg-success/20 text-success border border-success/30' : 'bg-primary/20 text-primary border border-primary/30'
                            }`}>
                              {lead.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-sm font-semibold">{lead.meta_info?.industry || '---'}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="text-xs text-text-secondary font-medium">
                              {new Date(lead.last_interaction).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => handleAIRecovery(lead.id)}
                              className="p-2 hover:bg-accent-cyan/20 rounded-lg transition-all text-text-secondary hover:text-accent-cyan"
                              title="AI 語意恢復"
                            >
                              <BrainCircuit className="size-5" />
                            </button>
                            <button className="p-2 hover:bg-primary/20 rounded-lg transition-all text-text-secondary hover:text-primary">
                              <ExternalLink className="size-5" />
                            </button>
                          </td>
                        </motion.tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="px-8 py-20 text-center text-text-secondary font-medium">
                            尚未有線索資料
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

                {activeTab === 'customers' && (
              <motion.div 
                key="customers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Left: Lead Selector (4 cols) */}
                <div className="lg:col-span-4 glass rounded-3xl overflow-hidden border border-glass-border flex flex-col h-[calc(100vh-280px)]">
                  <div className="p-6 border-b border-glass-border bg-white/5">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Users className="size-5 text-primary" /> 選擇客戶
                      </h3>
                      <button 
                        onClick={fetchData} 
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-secondary hover:text-white"
                        title="重新整理數據"
                      >
                        <RefreshCw className={`size-4 ${isConnected ? '' : 'animate-spin'}`} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <input 
                          type="text" 
                          placeholder="搜尋 UID 或 名稱..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-black/40 border border-glass-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                      </div>
                      <div className="flex bg-black/30 p-1 rounded-xl w-full border border-white/5">
                        {['all', 'line', 'gmail'].map(f => (
                          <button
                            key={f}
                            onClick={() => setPlatformFilter(f)}
                            className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              platformFilter === f ? 'bg-primary text-white shadow-lg' : 'text-text-secondary hover:text-white'
                            }`}
                          >
                            {f === 'all' ? '全部' : f}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {leads.filter(l => {
                      const search = searchQuery.toLowerCase();
                      const matchesSearch = 
                        (l.name || '').toLowerCase().includes(search) || 
                        (l.line_uid || '').toLowerCase().includes(search) ||
                        (l.platform_id || '').toLowerCase().includes(search);
                      
                      const matchesPlatform = 
                        platformFilter === 'all' || 
                        (l.source && l.source.toLowerCase() === platformFilter.toLowerCase()) ||
                        (!l.source && platformFilter === 'line');
                        
                      return matchesSearch && matchesPlatform;
                    }).map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => fetchLeadDetails(lead)}
                        className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-3 relative group ${
                          selectedLead?.id === lead.id 
                          ? 'bg-primary/20 border border-primary/30 ring-1 ring-primary/20' 
                          : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className={`p-2 rounded-lg relative ${lead.source === 'gmail' ? 'bg-red-500/10 text-red-500' : 'bg-success/10 text-success'}`}>
                          {lead.source === 'gmail' ? <Mail className="size-4" /> : <MessageSquare className="size-4" />}
                          <div className={`absolute -right-1 -bottom-1 size-2.5 rounded-full border-2 border-secondary ${lead.status === 'active' || !lead.status ? 'bg-success' : 'bg-text-secondary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-bold truncate text-sm">{lead.name || '訪客'}</div>
                            <span className="text-[8px] opacity-40 uppercase font-black">{lead.source || 'line'}</span>
                          </div>
                          <div className="text-[10px] text-text-secondary font-mono truncate">
                            {lead.source === 'gmail' ? lead.platform_id : lead.line_uid}
                          </div>
                        </div>
                        {selectedLead?.id === lead.id && (
                          <motion.div layoutId="activeLead" className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Middle: Conversation Logs & List Management (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="glass rounded-3xl overflow-hidden border border-glass-border flex flex-col h-[600px] shadow-2xl relative">
                    
                    {/* Enhanced Chat Header */}
                    <div className="p-4 border-b border-glass-border bg-white/5 backdrop-blur-md flex items-center justify-between gap-4 z-20">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-xl ${selectedLead?.source === 'gmail' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                          {selectedLead?.source === 'gmail' ? <Mail className="size-5" /> : <MessageSquare className="size-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingName ? (
                            <div className="flex items-center gap-2">
                              <input 
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && updateLead(selectedLead.id, { name: newName })}
                                className="bg-black/40 border border-primary/50 text-sm px-2 py-1 rounded w-full focus:outline-none"
                              />
                              <button onClick={() => updateLead(selectedLead.id, { name: newName })} className="text-success text-xs font-bold">儲存</button>
                              <button onClick={() => setEditingName(false)} className="text-text-secondary text-xs">取消</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg truncate">{selectedLead?.name || '請選擇客戶'}</h3>
                              {selectedLead && (
                                <button 
                                  onClick={() => {setEditingName(true); setNewName(selectedLead.name || ''); }} 
                                  className="p-1 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors"
                                >
                                  <Code className="size-3" />
                                </button>
                              )}
                            </div>
                          )}
                          <div className="text-[10px] text-text-secondary flex items-center gap-2">
                            <span className={`size-1.5 rounded-full ${selectedLead?.status === 'active' || !selectedLead?.status ? 'bg-success' : 'bg-error'}`}></span>
                            {selectedLead?.source === 'gmail' ? 'GMAIL 商務郵件' : 'LINE 即時動態'} 
                            {selectedLead?.status === 'inactive' && ' (已停用)'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                          <input 
                            placeholder="搜尋對話..."
                            value={msgSearchQuery}
                            onChange={(e) => setMsgSearchQuery(e.target.value)}
                            className="bg-black/40 border border-white/5 rounded-full pl-9 pr-4 py-1.5 text-xs w-32 md:w-48 focus:w-64 transition-all outline-none focus:ring-1 focus:ring-primary/40"
                          />
                        </div>
                        <button 
                          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                          className={`p-2 rounded-xl transition-all ${isSettingsOpen ? 'bg-primary text-white' : 'bg-white/5 hover:bg-white/10 text-text-secondary'}`}
                        >
                          <Settings className="size-5" />
                        </button>
                      </div>
                    </div>

                    {/* Settings Overlay Panel */}
                    <AnimatePresence>
                      {isSettingsOpen && selectedLead && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-secondary/95 backdrop-blur-xl border-b border-glass-border overflow-hidden z-10"
                        >
                          <div className="p-6 grid grid-cols-2 gap-8">
                            <div>
                              <p className="text-[10px] font-black text-primary uppercase mb-3 tracking-widest">自動化設定</p>
                              <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-xs font-bold">主動推送狀態</span>
                                <button 
                                  onClick={() => updateLead(selectedLead.id, { status: selectedLead.status === 'inactive' ? 'active' : 'inactive' })}
                                  className={`w-12 h-6 rounded-full p-1 transition-all ${selectedLead.status === 'inactive' ? 'bg-white/10' : 'bg-success'}`}
                                >
                                  <div className={`size-4 bg-white rounded-full shadow-lg transition-all ${selectedLead.status === 'inactive' ? 'translate-x-0' : 'translate-x-6'}`} />
                                </button>
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-accent-pink uppercase mb-3 tracking-widest">危險區域</p>
                              <button className="w-full py-3 rounded-2xl bg-error/10 text-error text-xs font-bold border border-error/20 hover:bg-error/20 transition-all">
                                移除此客戶資料
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/40 scrollbar-hide">
                      {selectedLead ? (
                        (() => {
                          const filteredLogs = leadLogs.filter(log => 
                            log.content.toString().toLowerCase().includes(msgSearchQuery.toLowerCase())
                          );
                          
                          return filteredLogs.length > 0 ? filteredLogs.map((log, i) => {
                            const isGmail = log.source === 'gmail' || log.event_type?.includes('GMAIL');
                            const isIncoming = log.event_type?.includes('IN');
                            let mailData = null;
                            if (isGmail) {
                              try {
                                mailData = typeof log.content === 'object' ? log.content : JSON.parse(log.content);
                              } catch (e) {
                                mailData = { content: log.content };
                              }
                            }

                            return (
                              <motion.div 
                                key={i} 
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} group`}
                              >
                                <div className={`max-w-[85%] ${isGmail ? 'w-full' : ''} relative`}>
                                  <div className={`p-4 rounded-3xl shadow-xl backdrop-blur-md border ${
                                    isIncoming 
                                    ? 'bg-white/10 border-white/10 rounded-tl-none' 
                                    : 'bg-primary/20 border-primary/30 rounded-tr-none'
                                  }`}>
                                    <div className="text-[10px] text-text-secondary mb-2 flex justify-between items-center opacity-60">
                                      <span>{new Date(log.timestamp).toLocaleTimeString()} · {new Date(log.timestamp).toLocaleDateString()}</span>
                                      <span className={`px-2 py-0.5 rounded-full uppercase text-[8px] font-black tracking-tighter ${isGmail ? 'bg-red-500/20 text-red-400' : 'bg-success/20 text-success'}`}>
                                        {log.source || 'LINE'}
                                      </span>
                                    </div>
                                    
                                    {isGmail && mailData ? (
                                      <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-4 shadow-inner text-left">
                                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                                          <div className="bg-red-500/20 p-2 rounded-xl"><Mail className="size-4 text-red-400" /></div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-white font-bold text-sm truncate">{mailData.subject || '無主旨'}</div>
                                            <div className="text-[11px] text-text-secondary truncate">{mailData.sender || '未知寄件者'}</div>
                                          </div>
                                        </div>
                                        <div className="text-[13px] text-white/90 leading-relaxed font-sans pt-1">
                                          {mailData.content || mailData.body || log.content}
                                        </div>
                                        <div className="text-[9px] text-primary/40 text-right pt-2 border-t border-white/5 italic flex items-center justify-end gap-1">
                                          <Zap className="size-2.5" /> 加密傳輸保護中
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{log.content}</div>
                                    )}
                                  </div>
                                  {!isIncoming && (
                                    <div className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="p-2 bg-white/5 rounded-full"><Activity className="size-3 text-primary" /></div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          }) : (
                            <div className="h-full flex flex-col items-center justify-center text-text-secondary py-20">
                              <Search className="size-12 mb-4 opacity-10" />
                              <p className="italic text-sm">找不到相關的對話內容</p>
                              {msgSearchQuery && <button onClick={() => setMsgSearchQuery('')} className="mt-2 text-primary text-xs font-bold underline">清除關鍵字</button>}
                            </div>
                          )
                        })()
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-text-secondary py-20">
                          <Users className="size-12 mb-4 opacity-10" />
                          <p className="italic text-sm font-medium">請先從左側列表選擇一位客戶</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="glass rounded-3xl p-6 border border-glass-border shadow-xl">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-5">
                      <Settings className="size-5 text-accent-pink" /> 快速標籤清單
                    </h3>
                    <div className="space-y-6">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-primary uppercase mb-3 tracking-widest">已分配的名單組</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLead ? (
                            currentLeadLists.length > 0 ? currentLeadLists.map(list => (
                              <motion.span 
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                key={list.id} 
                                className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold shadow-lg"
                              >
                                {list.name}
                                <button onClick={() => removeLeadFromList(list.id)} className="hover:text-error transition-colors text-lg">×</button>
                              </motion.span>
                            )) : <div className="text-xs text-text-secondary italic py-2">尚未加入任何名單</div>
                          ) : <div className="text-xs text-text-secondary italic py-2">請先選擇客戶</div>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-text-secondary uppercase mb-3 tracking-widest">推薦名單轉移</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLead && availableLists.filter(l => !currentLeadLists.some(cl => cl.id === l.id)).map(list => (
                            <button 
                              key={list.id} 
                              onClick={() => addLeadToList(list.id)}
                              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-medium transition-all hover:border-primary/50"
                            >
                              + {list.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div 
                key="broadcast"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-4xl mx-auto"
              >
                {/* Right: Message Broadcast Panel (Now Main Context) */}
                <div className="flex flex-col gap-6">
                  <div className="glass rounded-3xl p-8 border border-glass-border shadow-2xl h-full flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                      <div>
                        <h3 className="text-2xl font-bold flex items-center gap-3">
                          <Zap className="size-6 text-accent-yellow" /> 訊息投放系統
                        </h3>
                        <p className="text-text-secondary text-sm mt-1">
                          統一管理 LINE Flex 與 Gmail 商務郵件投放
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={exportTemplate} title="匯出備份" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                          <Download className="size-5" />
                        </button>
                        <label className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                          <Upload className="size-5" />
                          <input type="file" onChange={importTemplate} className="hidden" accept=".json" />
                        </label>
                      </div>
                    </div>

                    {/* Slot Picker */}
                    <div className="flex justify-between mb-8 p-1.5 bg-black/20 rounded-2xl">
                      {[1,2,3,4,5,6,7,8,9].map(i => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlot(i)}
                          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                            currentSlot === i ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-text-secondary'
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 flex flex-col gap-6 min-h-0">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-text-secondary uppercase px-1 tracking-widest">範本名稱</p>
                        <input 
                          type="text"
                          placeholder="例如: 2024 春季限時活動通知"
                          value={editorName}
                          onChange={(e) => setEditorName(e.target.value)}
                          className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-text-secondary uppercase px-1 tracking-widest">訊息類型</p>
                        <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl">
                          <button 
                            onClick={() => setEditorType('text')}
                            className={`flex-1 py-2 text-xs rounded-xl transition-all ${editorType === 'text' ? 'bg-primary/20 text-primary font-bold shadow-inner' : 'text-text-secondary hover:text-white'}`}
                          >純文字 (LINE / Gmail)</button>
                          <button 
                            onClick={() => setEditorType('flex')}
                            className={`flex-1 py-2 text-xs rounded-xl transition-all ${editorType === 'flex' ? 'bg-primary/20 text-primary font-bold shadow-inner' : 'text-text-secondary hover:text-white'}`}
                          >Flex 氣泡框 (僅限 LINE)</button>
                        </div>
                      </div>

                      <div className="flex-1 min-h-[300px] flex flex-col space-y-2">
                         <p className="text-[10px] font-bold text-text-secondary uppercase px-1 tracking-widest">訊息內容 / JSON</p>
                         <textarea 
                          className="flex-1 w-full bg-black/40 border border-glass-border rounded-2xl p-6 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none shadow-inner leading-relaxed"
                          placeholder={editorType === 'text' ? "在這裡輸入要發送的文字內容..." : "請在這裡貼入 LINE Bot Designer 產生的 Flex Message JSON 代碼..."}
                          value={editorContent}
                          onChange={(e) => setEditorContent(e.target.value)}
                        />
                      </div>
                      
                      <button 
                        onClick={saveCurrentTemplate}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-black transition-all shadow-lg flex items-center justify-center gap-2 group"
                      >
                        <CheckCircle className="size-4 text-success opacity-0 group-hover:opacity-100 transition-opacity" />
                        儲存範本至 Slot {currentSlot}
                      </button>

                      <div className="p-8 bg-primary/5 rounded-3xl border border-primary/10 space-y-6 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-black text-primary uppercase mb-3 tracking-widest">1. 選擇名單</p>
                            <select 
                              value={targetListId}
                              onChange={(e) => setTargetListId(e.target.value)}
                              className="w-full bg-black/40 border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-bold"
                            >
                              <option value="">-- 請選擇欲投放的名單 --</option>
                              {availableLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </div>
                          
                          <div>
                            <p className="text-[10px] font-black text-accent-cyan uppercase mb-3 tracking-widest">2. 預約時間 (選填)</p>
                            <input 
                              type="datetime-local" 
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className="w-full bg-black/40 border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <button 
                            onClick={() => handleBroadcast(false)}
                            className="py-4 bg-primary hover:bg-primary/80 hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 text-white"
                          >
                            <Send className="size-5" /> 立即執行投放
                          </button>
                          <button 
                            onClick={() => handleBroadcast(true)}
                            className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 border border-white/10"
                          >
                            <Clock className="size-5" /> 預約自動發送
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center gap-2 text-[10px] text-text-secondary opacity-50 uppercase tracking-tighter">
                          <AlertCircle className="size-3" /> 系統將自動根據名單內的客戶來源切換 LINE 或 Gmail
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Jobs Management */}
                  <div className="glass rounded-3xl p-8 border border-glass-border shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Clock className="size-5 text-accent-cyan" /> 預約排程管理
                      </h3>
                      <button 
                        onClick={fetchBroadcastJobs}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-text-secondary"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </div>

                    {broadcastJobs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] text-text-secondary uppercase tracking-widest border-b border-white/5">
                              <th className="px-4 py-3 pb-4">發送範本</th>
                              <th className="px-4 py-3 pb-4">目標名單</th>
                              <th className="px-4 py-3 pb-4">預定時間</th>
                              <th className="px-4 py-3 pb-4 text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {broadcastJobs.map(job => (
                              <tr key={job.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-4 py-4">
                                  <div className="text-sm font-bold text-white">{job.template_name}</div>
                                  <div className="mt-1 flex gap-2">
                                    {job.status === 'pending' && <span className="text-[9px] px-1.5 py-0.5 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 rounded font-black uppercase">Waiting</span>}
                                    {job.status === 'success' && <span className="text-[9px] px-1.5 py-0.5 bg-success/10 text-success border border-success/20 rounded font-black uppercase">Completed</span>}
                                    {job.status.startsWith('error') && <span className="text-[9px] px-1.5 py-0.5 bg-error/10 text-error border border-error/20 rounded font-black uppercase">Failed</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold border border-primary/20">
                                    {job.list_name}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-xs font-mono text-text-secondary">
                                    {new Date(job.scheduled_at).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  {job.status === 'pending' && (
                                    <button 
                                      onClick={() => cancelBroadcastJob(job.id)}
                                      className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error text-[10px] font-black uppercase rounded-lg border border-error/20 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      取消排程
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 flex flex-col items-center justify-center text-text-secondary opacity-30 italic bg-black/10 rounded-2xl border border-dashed border-white/10">
                        <Clock className="size-10 mb-4" />
                        <p className="text-sm">目前沒有任何等待發送的預約任務</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                      <Database className="size-8 text-accent-pink" /> SQL 數據分析實驗室
                    </h2>
                    <p className="text-text-secondary mt-1 font-medium">直接對資料庫進行多維度查詢與對比分析</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowComparison(!showComparison)}
                      className={`px-6 py-2 rounded-xl transition-all font-bold flex items-center gap-2 border ${
                        showComparison 
                        ? 'bg-accent-pink/20 text-accent-pink border-accent-pink/30' 
                        : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {showComparison ? <MinusCircle className="size-4" /> : <PlusCircle className="size-4" />}
                      {showComparison ? '關閉對比模式' : '開啟 SQL 對比'}
                    </button>
                  </div>
                </div>

                <div className={`grid gap-6 ${showComparison ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {sqlQueries.slice(0, showComparison ? 2 : 1).map((q, idx) => (
                    <div key={q.id} className="glass-card p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                          Query SQL {idx + 1}
                        </span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => runSqlQuery(idx)}
                            disabled={q.loading}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                              q.loading ? 'bg-white/10 text-white/30' : 'bg-primary text-white hover:scale-105 active:scale-95 shadow-lg shadow-primary/20'
                            }`}
                          >
                            {q.loading ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
                            執行查詢
                          </button>
                        </div>
                      </div>
                      
                      <textarea
                        value={q.query}
                        onChange={(e) => {
                          const newQ = [...sqlQueries];
                          newQ[idx].query = e.target.value;
                          setSqlQueries(newQ);
                        }}
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm text-accent-cyan focus:border-primary/50 outline-none transition-all resize-none"
                        placeholder="SELECT * FROM interaction_logs WHERE ..."
                      />
                    </div>
                  ))}
                </div>

                {showComparison && sqlQueries[0].result && sqlQueries[1].result && (
                  <div className="animate-fade-in grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-8 text-center border-t-4 border-primary">
                      <p className="text-text-secondary text-xs font-black mb-2 uppercase">SQL 1</p>
                      <h4 className="text-5xl font-black text-white">{sqlQueries[0].result.data.length}</h4>
                    </div>
                    <div className="flex items-center justify-center">
                      <RefreshCw className="size-8 text-white/20" />
                    </div>
                    <div className="glass-card p-8 text-center border-t-4 border-accent-pink">
                      <p className="text-text-secondary text-xs font-black mb-2 uppercase">SQL 2</p>
                      <h4 className="text-5xl font-black text-white">{sqlQueries[1].result.data.length}</h4>
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  {sqlQueries.slice(0, showComparison ? 2 : 1).map((q, idx) => (
                    q.result && (
                      <div key={`res-${idx}`} className="glass-card p-0 overflow-hidden border border-white/10">
                        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                          <h4 className="text-sm font-bold flex items-center gap-2">
                            <Table className="size-4 text-primary" /> SQL {idx + 1} 資料結果 ({q.result.data.length} 筆)
                          </h4>
                        </div>
                        <div className="overflow-x-auto max-h-[300px]">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-secondary/80 backdrop-blur-md z-10">
                              <tr>
                                {q.result.cols.map(col => (
                                  <th key={col} className="px-6 py-3 text-[10px] font-black text-text-secondary uppercase">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {q.result.data.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  {q.result.cols.map(col => (
                                    <td key={col} className="px-6 py-3 text-sm font-medium text-white/80">{String(row[col])}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'onboarding' && (
              <motion.div 
                key="onboarding"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                      <BookOpen className="size-8 text-primary" /> 新手教學設定
                    </h2>
                    <p className="text-text-secondary mt-1 font-medium">設定新客戶第一次互動時的自動引導流程</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-6">
                      <div className="space-y-4">
                        <textarea 
                          value={newStepMsg}
                          onChange={(e) => setNewStepMsg(e.target.value)}
                          placeholder="輸入給新客戶的回覆內容..."
                          className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white outline-none resize-none"
                        />
                        <button 
                          onClick={addOnboardingStep}
                          className="w-full bg-primary hover:bg-primary/80 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2"
                        >
                          <PlusCircle className="size-5" /> 加入新步驟
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {onboardingSteps.map((step) => (
                        <div key={step.id} className="glass-card p-6 flex flex-col gap-4 border-l-4 border-primary">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full">Step {step.step_index}</span>
                            <button onClick={() => deleteOnboardingStep(step.id)} className="text-text-secondary hover:text-red-500"><MinusCircle className="size-4" /></button>
                          </div>
                          <p className="text-white font-medium whitespace-pre-wrap">{step.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-transparent">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Zap className="size-5 text-yellow-400" /> 自動抓取規則</h3>
                      <div className="space-y-3">
                        {['電子郵件', '手機號碼', '性別稱呼'].map(rule => (
                          <div key={rule} className="bg-black/20 p-3 rounded-lg border border-white/5">
                            <div className="text-xs font-black text-primary uppercase mb-1">{rule}</div>
                            <div className="text-[10px] text-text-secondary">自動由 AI / Regex 進行辨識</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        
        {/* Sidebar: Logs / 系統日誌 */}
        <section className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="glass rounded-3xl h-[calc(100vh-160px)] flex flex-col overflow-hidden sticky top-8 border-primary/20 shadow-2xl">
            <div className="p-6 border-b border-glass-border bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Terminal className="size-5 text-primary" /> 即時偵測日誌
              </h2>
              <div className="size-2 rounded-full bg-success animate-pulse"></div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[10px] scroll-smooth">
              <AnimatePresence>
                {logs.length > 0 ? logs.map((log, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="border-l-2 border-primary/50 pl-3 py-2 bg-white/5 rounded-r-lg group hover:bg-white/10 transition-all shadow-sm"
                  >
                     <div className="text-primary/70 mb-1 font-bold flex justify-between">
                       <span>[{log.timestamp}]</span>
                       <span className="text-[9px] uppercase tracking-tighter opacity-0 group-hover:opacity-100">Live Trace</span>
                     </div>
                     <div className="font-black text-white mb-2 tracking-wide uppercase">{log.type}</div>
                     <pre className="text-text-secondary overflow-x-hidden whitespace-pre-wrap leading-relaxed opacity-90 break-all select-all">
                      {JSON.stringify(log.data, null, 1)}
                    </pre>
                  </motion.div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                    <Activity className="size-12 mb-4" />
                    等待活動產生...
                  </div>
                )}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
            
            <div className="p-4 bg-black/50 border-t border-glass-border">
              <div className="flex items-center gap-2 text-[10px] text-text-secondary font-mono">
                <span className="text-primary font-bold">ROOT@N8N-FACTORY:~$</span>
                <span className="animate-pulse">_</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] font-bold text-sm border ${
              notification.type === 'success' 
              ? 'bg-success/20 text-success border-success/30 backdrop-blur-xl' 
              : 'bg-error/20 text-error border-error/30 backdrop-blur-xl'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
