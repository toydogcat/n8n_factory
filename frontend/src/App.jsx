import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
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
  Cpu
} from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

// 動態偵測後端 IP
const hostname = window.location.hostname === 'localhost' ? '192.168.0.147' : window.location.hostname;
const API_BASE = `http://${hostname}:8000`;
const WS_URL = `ws://${hostname}:8000/ws/logs`;

function App() {
  const [logs, setLogs] = useState([]);
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, leads, analytics
  const [isConnected, setIsConnected] = useState(false);
  const logEndRef = useRef(null);

  const fetchData = async () => {
    try {
      const [leadsRes, tasksRes] = await Promise.all([
        axios.get(`${API_BASE}/leads`),
        axios.get(`${API_BASE}/tasks`)
      ]);
      setLeads(leadsRes.data);
      setTasks(tasksRes.data);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
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
            { id: 'analytics', label: '數據分析' }
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
                          <td className="px-8 py-5 text-right">
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

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="glass-card p-8">
                  <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                    <BarChart3 className="size-6 text-accent-pink" /> 系統互動趨勢
                  </h3>
                  <div className="h-64 flex items-end justify-between gap-3 px-2">
                    {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.1, duration: 1, ease: "easeOut" }}
                        className="w-full bg-gradient-to-t from-primary/30 via-primary/70 to-primary rounded-t-xl transition-all hover:brightness-125 relative group"
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          {h*12}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-6 text-[10px] text-text-secondary font-black tracking-widest">
                    <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                  </div>
                </div>
                
                <div className="glass-card p-8 bg-gradient-to-br from-primary/10 to-transparent flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">自動化效能指標</h3>
                  <p className="text-sm text-text-secondary mb-8 font-medium">系統各節點穩定度與響應速度</p>
                  <div className="space-y-6">
                    {[
                      { label: '內容偵測準確率', val: '99.2%', color: 'text-primary' },
                      { label: '平均響應延遲', val: '84ms', color: 'text-accent-cyan' },
                      { label: '訊息送達成功率', val: '100%', color: 'text-success' },
                      { label: 'API 剩餘額度', val: '85%', color: 'text-accent-pink' }
                    ].map(stat => (
                      <div key={stat.label} className="flex justify-between items-center border-b border-white/5 pb-3">
                        <span className="text-sm font-bold text-text-secondary">{stat.label}</span>
                        <span className={`text-lg font-black font-mono ${stat.color}`}>{stat.val}</span>
                      </div>
                    ))}
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
    </div>
  );
}

export default App;
