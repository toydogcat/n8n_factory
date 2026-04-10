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
  User
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// 從 .env 讀取後端設定，若無則自動偵測當前 IP
const apiHost = import.meta.env.VITE_API_HOST || window.location.hostname;
const apiPort = import.meta.env.VITE_API_PORT || '8000';

const API_BASE = `http://${apiHost}:${apiPort}`;
const WS_URL = `ws://${apiHost}:${apiPort}/ws/logs`;

function App() {
  const [logs, setLogs] = useState([]);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, leads, customers, analytics
  const [isConnected, setIsConnected] = useState(false);
  
  // 客戶管理相關狀態
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadLogs, setLeadLogs] = useState([]);
  const [availableLists, setAvailableLists] = useState([]);
  const [currentLeadLists, setCurrentLeadLists] = useState([]);
  const [newListName, setNewListName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
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
  
  const logEndRef = useRef(null);

  const fetchData = async () => {
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
    }
  };
  
  useEffect(() => {
    fetchData();
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
            if (['BOT_CMD_IN', 'BOT_CMD_OUT', 'TRIGGER_SUCCESS'].includes(log.type)) {
              fetchData();
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
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

  const deleteList = async (listId) => {
    try {
      await axios.delete(`${API_BASE}/lists/${listId}`);
      fetchData();
    } catch (error) {
      console.error('Delete List Error:', error);
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
    } catch (err) {
      showNotification("執行失敗", "error");
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
            { id: 'customers', label: '客戶名單管理' },
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
                <div className="p-8 border-b border-glass-border bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Users className="size-6 text-accent-cyan" /> 線索管理系統
                  </h2>
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
                      {leads.length > 0 ? leads.map((lead, i) => (
                        <motion.tr 
                          key={lead.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="px-8 py-5">
                            <div className="font-bold text-lg">{lead.name || '訪客'}</div>
                            <div className="text-xs text-text-secondary font-mono opacity-60">{lead.line_uid.slice(0, 16)}...</div>
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
                {/* Left: Lead Selector (3 cols) */}
                <div className="lg:col-span-3 glass rounded-3xl overflow-hidden border border-glass-border flex flex-col h-[calc(100vh-280px)]">
                  <div className="p-6 border-b border-glass-border">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                      <Search className="size-5 text-accent-cyan" /> 選擇客戶
                    </h3>
                    <div className="relative">
                      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input 
                        type="text" 
                        placeholder="搜尋 UID 或 名稱..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-glass-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {leads.filter(l => 
                      (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                      l.line_uid.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => fetchLeadDetails(lead)}
                        className={`w-full text-left p-4 rounded-2xl transition-all ${
                          selectedLead?.id === lead.id 
                          ? 'bg-primary/20 border border-primary/30' 
                          : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <div className="font-bold">{lead.name || '訪客'}</div>
                        <div className="text-xs text-text-secondary font-mono truncate">{lead.line_uid}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Middle: Conversation Logs & List Management (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="glass rounded-3xl overflow-hidden border border-glass-border flex flex-col h-[400px]">
                    <div className="p-6 border-b border-glass-border flex justify-between items-center">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <MessageSquare className="size-5 text-primary" /> 對話紀錄
                        {selectedLead && <span className="text-xs font-normal text-text-secondary ml-2">({selectedLead.name || '訪客'})</span>}
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/20">
                      {selectedLead ? (
                        leadLogs.length > 0 ? leadLogs.map((log, i) => (
                          <div key={i} className={`flex ${log.event_type?.includes('IN') ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl ${
                              log.event_type?.includes('IN') 
                              ? 'bg-white/10 rounded-tl-none' 
                              : 'bg-primary/20 border border-primary/30 rounded-tr-none text-right'
                            }`}>
                              <div className="text-[9px] text-text-secondary mb-1">
                                {new Date(log.timestamp).toLocaleString()}
                              </div>
                              <div className="text-xs whitespace-pre-wrap">{log.content}</div>
                            </div>
                          </div>
                        )) : (
                          <div className="h-full flex items-center justify-center text-text-secondary italic text-sm">尚無對話紀錄</div>
                        )
                      ) : (
                        <div className="h-full flex items-center justify-center text-text-secondary italic text-sm">請先從左側選擇客戶</div>
                      )}
                    </div>
                  </div>

                  <div className="glass rounded-3xl p-6 border border-glass-border">
                    <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <Settings className="size-5 text-accent-pink" /> 名單標記
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">已加入名單</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedLead ? (
                            currentLeadLists.length > 0 ? currentLeadLists.map(list => (
                              <span key={list.id} className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-[10px] font-bold">
                                {list.name}
                                <button onClick={() => removeLeadFromList(list.id)} className="hover:text-error transition-colors">×</button>
                              </span>
                            )) : <div className="text-xs text-text-secondary italic">尚未加入</div>
                          ) : <div className="text-xs text-text-secondary italic">請先選擇客戶</div>}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">可選名單</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedLead && availableLists.filter(l => !currentLeadLists.some(cl => cl.id === l.id)).map(list => (
                            <button 
                              key={list.id} 
                              onClick={() => addLeadToList(list.id)}
                              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px]"
                            >
                              + {list.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Message Broadcast Panel (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="glass rounded-3xl p-6 border border-glass-border h-full flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Zap className="size-5 text-accent-yellow" /> LINE 訊息投放
                      </h3>
                      <div className="flex gap-2">
                        <button onClick={exportTemplate} title="匯出備份" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                          <Download className="size-4" />
                        </button>
                        <label className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                          <Upload className="size-4" />
                          <input type="file" onChange={importTemplate} className="hidden" accept=".json" />
                        </label>
                      </div>
                    </div>

                    {/* Slot Picker */}
                    <div className="flex justify-between mb-6 p-1 bg-black/20 rounded-xl">
                      {[1,2,3,4,5,6,7,8,9].map(i => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlot(i)}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                            currentSlot === i ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-text-secondary'
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                      <input 
                        type="text"
                        placeholder="給這個範本取個名字 (例如: 春季活動)"
                        value={editorName}
                        onChange={(e) => setEditorName(e.target.value)}
                        className="bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm focus:outline-none"
                      />
                      
                      <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                        <button 
                          onClick={() => setEditorType('text')}
                          className={`flex-1 py-1 text-xs rounded-lg ${editorType === 'text' ? 'bg-white/10 font-bold' : 'text-text-secondary'}`}
                        >純文字</button>
                        <button 
                          onClick={() => setEditorType('flex')}
                          className={`flex-1 py-1 text-xs rounded-lg ${editorType === 'flex' ? 'bg-white/10 font-bold' : 'text-text-secondary'}`}
                        >Flex 氣泡框</button>
                      </div>

                      <textarea 
                        className="flex-1 w-full bg-black/30 border border-glass-border rounded-2xl p-4 text-xs font-mono focus:outline-none resize-none"
                        placeholder={editorType === 'text' ? "輸入訊息內容..." : "請貼入 LINE Flex Message JSON..."}
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                      />
                      
                      <button 
                        onClick={saveCurrentTemplate}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-all mb-4"
                      >儲存目前分頁內容</button>

                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div>
                          <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">選擇目標名單</p>
                          <select 
                            value={targetListId}
                            onChange={(e) => setTargetListId(e.target.value)}
                            className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm focus:outline-none"
                          >
                            <option value="">-- 選擇名單 --</option>
                            {availableLists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">預約發送 (選填)</p>
                          <input 
                            type="datetime-local" 
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm focus:outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handleBroadcast(false)}
                            className="py-3 bg-primary hover:scale-[1.02] active:scale-[0.98] rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <Send className="size-4" /> 立即發送
                          </button>
                          <button 
                            onClick={() => handleBroadcast(true)}
                            className="py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                          >
                            <Clock className="size-4" /> 預約排程
                          </button>
                        </div>
                      </div>
                    </div>
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
