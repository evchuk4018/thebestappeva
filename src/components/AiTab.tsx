import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  MessageSquare,
  Briefcase,
  Layers,
  Sliders,
  Terminal,
  Code,
  LayoutGrid,
  Search,
  ArrowRight,
  Sparkles,
  GraduationCap,
  PenTool,
  Coffee,
  Lightbulb,
  Trash2,
  ChevronDown,
  Download,
  User,
  Send,
  Mic,
  Headphones,
  Paperclip,
  Bookmark,
  ChevronUp
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  category?: string;
  messages: Message[];
  date: string;
}

export default function AiTab() {
  const navigate = useNavigate();
  
  // Mobile / Desktop States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Model Select state
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState('Haiku 4.5 Extended');

  // Static pre-populated chats matching Claude recents in the screenshot and the LiftLog context
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'chat-1',
      title: 'Comprehensive personal productivity system',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Design a comprehensive personal productivity system for a lifter who also works as a software engineer.' },
        { 
          role: 'assistant', 
          content: `Here is a high-performance productivity system tailored for a high-mental-load job (Software Engineer) and high-physical-demand hobby (Lifting):\n\n### 1. The "Single Source of Truth" Stack\n* **Calendar**: Hard block meetings, deep-work sessions (2h blocks), and workouts (e.g., Mon/Wed/Fri 6:30 PM). Workouts are treated as non-negotiable prod deployments.\n* **Task Manager**: Use a simple backlog + sprints approach. Keep coding backlog and gym progression targets in a markdown folder structure.\n\n### 2. Time-Blocking Protocol\n* **08:00 AM - 10:00 AM**: Deep Code Work (No Slack, no meetings).\n* **10:00 AM - 12:00 PM**: Collaborative syncs and lighter code reviews.\n* **05:30 PM**: Wrap-up and transitional pre-workout meal.\n* **06:30 PM - 08:30 PM**: Lift (High intensity, phone on Do Not Disturb).\n\n### 3. Nutrition Automation\n* **Decision Fatigue Reduction**: Prep lunches on Sunday. Choose 3 primary high-protein dishes and cycle them. Automated grocery deliveries of core staples (eggs, chicken breast, oats, yogurt).` 
        }
      ]
    },
    {
      id: 'chat-2',
      title: 'Power outage apology for missed meeting',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Can you write a short professional message apologizing to my team for missing a sprint review due to a sudden power outage?' },
        { 
          role: 'assistant', 
          content: `Here is a professional, polite, and brief message you can share in Slack or via Email:\n\n"Hi everyone,\n\nI apologize for missing the sprint review meeting earlier today. A sudden power outage took out my local internet connection right before we were scheduled to log on, and I was unable to join or send a heads-up in time.\n\nI have reviewed the shared deck and will sync with [Name] directly to catch up on any action items. My apologies again for the disruption!\n\nBest,\nJohn"` 
        }
      ]
    },
    {
      id: 'chat-3',
      title: 'File upload time calculation',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'How long would a 2.5 GB dataset take to upload with an upload speed of 12 Mbps?' },
        { 
          role: 'assistant', 
          content: `Let's calculate that file upload duration step-by-step:\n\n1. **Convert Gigabytes (GB) to Gigabits (Gb)**:\n   * 1 byte = 8 bits, so 2.5 GB = 2.5 × 8 = 20 Gigabits (Gb).\n\n2. **Convert to Megabits (Mb)**:\n   * 20 Gb × 1000 = 20,000 Megabits (Mb).\n\n3. **Divide by Upload Speed (12 Mbps)**:\n   * 20,000 Mb / 12 Mb per second ≈ 1,666.67 seconds.\n\n4. **Convert to Minutes**:\n   * 1,666.67 seconds / 60 ≈ **27.78 minutes** (or about 27 minutes and 47 seconds).\n\n*Note: This is the theoretical minimum. Real-world overhead generally adds 5-15% duration.*` 
        }
      ]
    },
    {
      id: 'chat-4',
      title: 'Awoo installation error during software build',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'I am getting a weird error running awoo compile scripts about missing environment targets.' },
        { 
          role: 'assistant', 
          content: `Ah, that typically indicates your target shell environment hasn't exported the critical compiler binaries before running the scripts.\n\nTry running:\n\`export AWOO_CORE_PATH=$(pwd)/bin\`\nand make sure you compile against the correct libc/musl architecture!` 
        }
      ]
    },
    {
      id: 'chat-5',
      title: 'Greeting',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Ayo hello' },
        { role: 'assistant', content: 'Good evening! How can I assist you with your productivity, fitness coding, or workouts tonight?' }
      ]
    },
    {
      id: 'chat-6',
      title: 'Web search context pollution prevention',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Explain web search context pollution in simple terms.' },
        { 
          role: 'assistant', 
          content: `Web search context pollution happens when irrelevant search results, SEO spam, or dynamic tracking tokens leak into an LLM's active reasoning workspace. When an AI searches the web, retrieving cluttered metadata (headers, cookie banners, navigation crumbs) distracts its narrow context window, reducing accuracy. Preventing this requires using high-quality clean Markdown filters.` 
        }
      ]
    },
    {
      id: 'chat-7',
      title: 'Open source models comparable to proprietary ones',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'What are the top open source LLMs right now?' },
        { role: 'assistant', content: `Currently, the most competitive open-weights LLMs are:\n\n1. **Llama 3.1 & 3.2** (Meta): Outstanding general-purpose and tool-use capabilities.\n2. **Gemma 2** (Google): Exceptionally high-quality lightweight models with incredible training efficiency.\n3. **Mistral / Mixtral** (Mistral AI): Pioneers in Mixture-of-Experts architecture.\n4. **DeepSeek-V3**: Extremely cost-efficient, state-of-the-art developer model.` }
      ]
    },
    {
      id: 'chat-8',
      title: 'Simple AI logo design',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'What makes a clean AI logo?' },
        { role: 'assistant', content: `A clean AI logo avoids cliché 'glowing brains' or generic blue microchip vectors. Instead, focus on:\n\n1. **Asymmetrical Organic Shapes**: Smooth flower starbursts (like Claude's warm asterisk) or simple geometry.\n2. **High-Contrast Warm Grays**: Humanistic color palettes over cold sci-fi neon.\n3. **Thoughtful Typography Pairing**.` }
      ]
    }
  ]);

  // Adjust sidebar state based on window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when typing or messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats, selectedChatId, isTyping]);

  const activeChat = chats.find(c => c.id === selectedChatId) || null;

  // Custom prompt helpers
  const handleSuggestionClick = (text: string) => {
    let customPrompt = '';
    if (text === 'Code') {
      customPrompt = 'Help me write a typescript utility to log and calculate my active workout volume.';
    } else if (text === 'Learn') {
      customPrompt = 'How should I calculate my daily protein and carbohydrate goals for fat loss?';
    } else if (text === 'Write') {
      customPrompt = 'Write a 4-day workout program focusing entirely on compound lifts.';
    } else if (text === 'Life stuff') {
      customPrompt = 'How do I maintain my gym streak when feeling mentally fatigued and burned out from coding?';
    } else if (text === "Claude's choice") {
      customPrompt = 'Give me a scientific breakdown of squat biomechanics: bar path vs hip flexor torque.';
    }
    setInputValue(customPrompt);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (selectedChatId === id) {
      setSelectedChatId(null);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;
    const userMsg = inputValue;
    setInputValue('');

    if (selectedChatId === null) {
      // Create new chat
      const wordCount = userMsg.split(' ').slice(0, 4).join(' ');
      const newTitle = wordCount.length > 30 ? wordCount.slice(0, 30) + '...' : wordCount || 'New workout discussion';
      const newId = `chat-${Date.now()}`;
      
      const newChatObj: Chat = {
        id: newId,
        title: newTitle,
        date: 'Just now',
        messages: [{ role: 'user', content: userMsg }]
      };

      setChats(prev => [newChatObj, ...prev]);
      setSelectedChatId(newId);
      triggerAiReply(newId, userMsg);
    } else {
      // Append message to existing chat
      setChats(prev => prev.map(c => {
        if (c.id === selectedChatId) {
          return {
            ...c,
            messages: [...c.messages, { role: 'user', content: userMsg }]
          };
        }
        return c;
      }));
      triggerAiReply(selectedChatId, userMsg);
    }
  };

  const triggerAiReply = (chatId: string, messageText: string) => {
    setIsTyping(true);
    
    // Custom responsive simulated AI responses based on input questions
    setTimeout(() => {
      let responseText = '';
      const text = messageText.toLowerCase();

      if (text.includes('code') || text.includes('typescript') || text.includes('utility')) {
        responseText = `Here is a custom TypeScript utility function for LiftLog to calculate target training volume:\n\n\`\`\`typescript\ninterface WorkoutSet {\n  kg: number;\n  reps: number;\n}\n\nexport function calculateTrainingVolume(sets: WorkoutSet[]): number {\n  return sets.reduce((total, set) => total + (set.kg * set.reps), 0);\n}\n\n// Example usage:\nconst volumeSq = calculateTrainingVolume([\n  { kg: 100, reps: 5 },\n  { kg: 100, reps: 5 },\n  { kg: 102, reps: 4 }\n]);\nconsole.log(\`Squat volume: \${volumeSq} kg\`); // => 1408 kg\n\`\`\`\n\nThis simple utility acts as a perfect baseline for tracking workouts inside the frontend. Would you like me to refine this system with individual exercise types?`;
      } else if (text.includes('squat') || text.includes('form') || text.includes('knees')) {
        responseText = `Let's break down squat form mechanics! For safety and maximum quad/glute activation, follow these steps:\n\n1. **Bracing**: Draw a huge belly breath, tighten your core outward like you're about to be punched. This secures your lumbar spine.\n2. **Hip Hinge**: Break at the hips slightly first, driving them back. Allow your knees to follow, track outward inline with toes.\n3. **Stable Footing**: Maintain three points of contact: big toe, pinky toe, and heel. Press through your mid-foot on the way up.\n\nNever let your knees cave in ("valgus collapse"). If this happens, lower the weight and practice band-resisted walks.`;
      } else if (text.includes('protein') || text.includes('diet') || text.includes('macros') || text.includes('fat loss')) {
        responseText = `For fat loss while preserving muscle tissue, structure your daily macronutrients like this:\n\n1. **Protein**: Aim for 1.8g to 2.2g of protein per kilogram of body weight. For an 80kg person, that translates to **144g - 176g of protein daily**.\n2. **Fats**: Keep them around 20-30% of total calorie intake (roughly 0.7g - 1g per kg of body weight) to support hormonal health.\n3. **Carbohydrates**: Fill the remainder of your daily calorie target with clean carbs (oats, brown rice, sweet potatoes) to power intense lifting sessions.\n\nTo lose fat, maintain a modest calorie deficit of 300 - 500 kcal below maintenance.`;
      } else if (text.includes('program') || text.includes('workout') || text.includes('split')) {
        responseText = `Here is a highly effective 4-day compound-focused training split:\n\n* **Day 1: Upper (Push Focus)**: Bench Press (3x5), Overhead Press (3x8), Incline Dumbbell Flyes (3x10), Triceps Pulldowns.\n* **Day 2: Lower (Squat Focus)**: Barbell Squats (3x5), Romanian Deadlifts (3x10), Leg Press (3x12), Standing Calf Raises.\n* **Day 3: Rest/Mobility**\n* **Day 4: Upper (Pull Focus)**: Deadlifts (1x5), Lat Pulldown / Pullups (3x8), Chest Supported Rows (3x10), Bicep Curls.\n* **Day 5: Lower (Accessory Focus)**: Hack Squats (3x10), Lying Leg Curls (3x12), Leg Extensions, Hanging Leg Raises.\n\nKeep track of weights and strive for **progressive overload** week over week!`;
      } else if (text.includes('streak') || text.includes('burnout') || text.includes('fatigue')) {
        responseText = `Dealing with mental fatigue from coding and trying to stay consistent at the gym is extremely common for developers. Try the **"10-Minute Gym Rule"**:\n\nOn days you feel totally drained, commit to just changing clothes, driving to the gym, and doing 10 minutes of light lifting. If you still hate it after 10 minutes, you are free to leave.\n\n**90% of the time, the blood starts flowing, the atmosphere kicks in, and you end up finishing a fantastic session.** For the other 10%, you successfully maintained your consistency habit without burning out. Be kind to your central nervous system!`;
      } else {
        responseText = `Thanks for asking that! Under the hood, I'm analyzing LiftLog's training metrics. \n\nAs your AI Coach, I suggest structuring workouts using compound paths. To achieve those fitness targets, we want to align a high-protein diet with customized set counts. \n\nWhat other questions can I answer about squat form, nutrition tracking, or programming?`;
      }

      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: [...c.messages, { role: 'assistant', content: responseText }]
          };
        }
        return c;
      }));
      setIsTyping(false);
    }, 1200);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#1b1b19] text-[#efeae4] font-sans overflow-hidden relative">
      
      {/* MOBILE HEADER BAR */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-zinc-800 text-[#efeae4] bg-[#121210] absolute top-0 left-0 right-0 z-30">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 px-2 rounded hover:bg-[#20201e]"
        >
          <PanelLeft size={20} />
        </button>
        <span className="font-serif text-xl tracking-tight text-[#efeae4]/95 font-medium flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded-full bg-[#e2875e]/20 text-[#e2875e] text-xs leading-none text-center font-bold">✴</span>
          Claude
        </span>
        <button 
          onClick={() => {
            setSelectedChatId(null);
            setSidebarOpen(false);
          }}
          className="p-1.5 rounded-full hover:bg-[#20201e]"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* BACKDROP FOR MOBILE SIDEBAR */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR PANEL */}
      <div
        className={`fixed md:relative top-0 bottom-0 left-0 z-40 w-72 md:w-64 lg:w-72 bg-[#121210] border-r border-[#242422]/60 flex flex-col justify-between select-none h-full transform transition-transform duration-300 md:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full md:absolute md:w-0 md:opacity-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col flex-1 h-0 overflow-y-auto">
          {/* Logo / Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="font-serif text-2xl tracking-wide text-[#efeae4] font-medium selection:bg-orange-500/30">
              Claude
            </span>
            <div className="flex items-center gap-1.5">
              <button className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#20201e] cursor-pointer">
                <Search size={16} />
              </button>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-[#20201e] cursor-pointer"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 flex flex-col gap-1">
            {/* New chat button */}
            <button
              onClick={() => {
                setSelectedChatId(null);
                if (isMobile) setSidebarOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-[#2f2f2b] hover:bg-[#1a1a18] text-sm text-[#efeae4] font-medium duration-150 cursor-pointer text-left"
            >
              <span className="flex items-center gap-2">
                <Plus size={16} className="text-zinc-400" />
                <span>New chat</span>
              </span>
              <span className="text-[10px] text-zinc-500 bg-[#1d1d1b] border border-[#292926] px-1.5 py-0.5 rounded font-mono">⌘K</span>
            </button>
          </div>

          {/* Menu Items */}
          <div className="px-2 py-1.5 flex flex-col gap-0.5 text-sm font-normal text-zinc-400">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
              <MessageSquare size={16} className="text-zinc-500" />
              <span>Chats</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
              <Briefcase size={16} className="text-zinc-500" />
              <span>Projects</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
              <Layers size={16} className="text-zinc-500" />
              <span>Artifacts</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
              <Sliders size={16} className="text-zinc-500" />
              <span>Customize</span>
            </button>
          </div>

          {/* Products Section */}
          <div className="mt-4 px-2">
            <div className="px-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1 select-none">
              Products
            </div>
            <div className="flex flex-col gap-0.5 text-sm text-zinc-400">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
                <LayoutGrid size={16} className="text-zinc-600" />
                <span>Cowork</span>
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a18] text-left cursor-pointer">
                <Terminal size={16} className="text-zinc-600" />
                <span>Code</span>
              </button>
            </div>
          </div>

          {/* Recents Section */}
          <div className="mt-5 px-2 flex-1 pb-4 flex flex-col">
            <div className="px-3 flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 select-none">
              <span>Recents</span>
              <button className="text-zinc-600 hover:text-zinc-400 p-0.5 rounded cursor-pointer">
                <Sliders size={11} />
              </button>
            </div>
            
            {/* Scrollable list of recent chats */}
            <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[320px] pr-1">
              {chats.map(chat => {
                const isActive = chat.id === selectedChatId;
                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-normal duration-150 relative cursor-pointer text-left ${
                      isActive 
                        ? 'bg-[#272724] text-[#efeae4] font-medium' 
                        : 'text-zinc-400 hover:bg-[#1a1a18] hover:text-[#efeae4]'
                    }`}
                  >
                    <span className="truncate pr-4 w-full select-none">{chat.title}</span>
                    
                    <button
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#20201e] text-zinc-500 hover:text-red-400 absolute right-1.5 top-1/2 -translate-y-1/2 duration-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {chats.length === 0 && (
                <div className="px-3 py-4 text-zinc-600 text-xs italic">
                  No chats yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM USER PROFILE */}
        <div className="border-t border-[#242422]/60 p-3 bg-[#11110f] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate('/')}
                title="Exit AI to Gym Lobby"
                className="w-8 h-8 rounded-full bg-[#f4ebd0] text-[#121210] flex items-center justify-center font-bold text-xs hover:bg-[#e8deb8] active:scale-95 transition-all cursor-pointer shadow-md border border-[#efeae4]/10 focus:outline-none"
              >
                JS
              </button>
              <div className="flex flex-col text-left select-none">
                <span className="text-xs font-semibold text-[#efeae4] max-w-[124px] truncate">john skibidi</span>
                <span className="text-[10px] text-zinc-500 leading-none">Free plan</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-500">
              <button className="p-1 rounded hover:bg-[#1a1a18] hover:text-[#efeae4] cursor-pointer">
                <Download size={14} />
              </button>
              <button className="p-1 rounded hover:bg-[#1a1a18] hover:text-[#efeae4] cursor-pointer">
                <ChevronUp size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SCREEN AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        
        {/* TOP FLOATING TOGGLE FOR SIDEBAR - DESKTOP */}
        {!sidebarOpen && !isMobile && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 rounded-xl bg-[#20201e] border border-[#2c2c28] text-zinc-300 hover:text-white duration-200 shadow-xl cursor-pointer"
          >
            <PanelLeft size={18} />
          </button>
        )}

        {/* WORKSPACE ELEMENT: HEADER PILL */}
        <div className="flex items-center justify-center h-16 pt-3 select-none">
          <div className="inline-flex items-center gap-1 bg-[#121210]/40 border border-[#2f2f2b]/45 rounded-full px-3 py-1.5 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <span>Free plan</span>
            <span className="text-zinc-600 px-1">•</span>
            <button className="text-[#e2875e] font-medium hover:underline cursor-pointer">Upgrade</button>
          </div>
        </div>

        {/* MAIN BODY CHAT CONTENT */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 pt-2 flex flex-col items-center"
        >
          {activeChat === null ? (
            /* CLAUID INTEGRATED EMPTY STATE */
            <div className="w-full max-w-xl md:max-w-2xl flex flex-col items-center justify-center my-auto py-12 md:py-20 text-center">
              
              {/* CLAUDE MULTI-TONE SUNBURST ICON */}
              <div className="mb-6 flex items-center justify-center">
                <div className="p-4 rounded-3xl bg-[#d97757]/10 border border-[#d97757]/20 relative">
                  <svg className="w-9 h-9 text-[#e2875e]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a1 1 0 0 1 1 1v7.65l6.57-4.78a1 1 0 0 1 1.18 1.62l-6.23 4.53 6.23 4.53a1 1 0 0 1-1.18 1.62L13 14.35V22a1 1 0 0 1-2 0v-7.65l-6.57 4.78a1 1 0 0 1-1.18-1.62l6.23-4.53-6.23-4.53A1 1 0 0 1 4.45 6.5L11 11.28V2a1 1 0 0 1 1-1z" />
                  </svg>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e2875e] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#e2875e]"></span>
                  </span>
                </div>
              </div>

              {/* SERIF HEADING */}
              <h1 className="font-serif text-3xl md:text-5xl tracking-normal text-[#efeae4] font-normal mb-8 selection:bg-orange-500/30">
                Good evening, john skibidi
              </h1>

              {/* CHAT BOX */}
              <div className="w-full bg-[#20201e] border border-[#2f2f2b] rounded-2xl p-3 flex flex-col focus-within:border-[#e2875e]/60 focus-within:shadow-2xl focus-within:shadow-[#e2875e]/5 duration-200 mb-6">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="How can I help you today?"
                  className="w-full text-sm placeholder-zinc-500 text-zinc-100 bg-transparent resize-none border-none outline-none focus:ring-0 min-h-[76px] py-1 text-left"
                />
                
                <div className="flex items-center justify-between pt-2 border-t border-[#292925]">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <button className="p-2 rounded-xl hover:bg-[#282825] hover:text-zinc-300 duration-150 cursor-pointer">
                      <Paperclip size={16} />
                    </button>
                    <button className="p-2 rounded-xl hover:bg-[#282825] hover:text-zinc-300 duration-150 cursor-pointer">
                      <Mic size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Model Select Pill */}
                    <div className="relative">
                      <button 
                        onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#272724] border border-[#33332d] hover:bg-[#2e2e2a] hover:text-zinc-200 text-[11px] font-medium text-zinc-400 transition cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e2875e]"></span>
                        <span>{currentModel}</span>
                        <ChevronDown size={11} className="stroke-[2.5]" />
                      </button>

                      <AnimatePresence>
                        {modelDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute right-0 bottom-full mb-1.5 z-50 w-52 bg-[#1a1a18] border border-[#2f2f2b] rounded-xl p-1.5 shadow-xl flex flex-col text-left"
                            >
                              <div className="px-2 py-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border-b border-[#292925] mb-1 select-none">
                                Choose Model
                              </div>
                              {['Haiku 4.5 Extended', 'Claude 3.5 Sonnet', 'Claude 3.5 Opus'].map(m => (
                                <button
                                  key={m}
                                  onClick={() => {
                                    setCurrentModel(m);
                                    setModelDropdownOpen(false);
                                  }}
                                  className={`w-full px-2 py-1.5 rounded-lg text-left text-xs duration-100 flex items-center justify-between ${
                                    currentModel === m ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                                  }`}
                                >
                                  <span>{m}</span>
                                  {currentModel === m && <div className="w-1.5 h-1.5 rounded-full bg-[#e2875e]" />}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    <button className="p-2 rounded-xl hover:bg-[#282825] hover:text-zinc-300 duration-150 text-zinc-500 cursor-pointer">
                      <Headphones size={16} />
                    </button>

                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className={`p-2 rounded-xl duration-150 cursor-pointer ${
                        inputValue.trim() 
                          ? 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]' 
                          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CHAT PROMPT SUGGESTIONS */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg md:max-w-xl text-xs select-none">
                <button
                  onClick={() => handleSuggestionClick('Code')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#20201e]/80 border border-[#2c2c28] hover:bg-[#2c2c28]/95 hover:border-[#42423c] rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer duration-150"
                >
                  <Terminal size={13} className="text-[#e2875e]" />
                  <span>Code</span>
                </button>
                <button
                  onClick={() => handleSuggestionClick('Learn')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#20201e]/80 border border-[#2c2c28] hover:bg-[#2c2c28]/95 hover:border-[#42423c] rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer duration-150"
                >
                  <GraduationCap size={13} className="text-[#e2875e]" />
                  <span>Learn</span>
                </button>
                <button
                  onClick={() => handleSuggestionClick('Write')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#20201e]/80 border border-[#2c2c28] hover:bg-[#2c2c28]/95 hover:border-[#42423c] rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer duration-150"
                >
                  <PenTool size={13} className="text-[#e2875e]" />
                  <span>Write</span>
                </button>
                <button
                  onClick={() => handleSuggestionClick('Life stuff')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#20201e]/80 border border-[#2c2c28] hover:bg-[#2c2c28]/95 hover:border-[#42423c] rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer duration-150"
                >
                  <Coffee size={13} className="text-[#e2875e]" />
                  <span>Life stuff</span>
                </button>
                <button
                  onClick={() => handleSuggestionClick("Claude's choice")}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#20201e]/80 border border-[#2c2c28] hover:bg-[#2c2c28]/95 hover:border-[#42423c] rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer duration-150"
                >
                  <Lightbulb size={13} className="text-[#e2875e]" />
                  <span>Claude's choice</span>
                </button>
              </div>

            </div>
          ) : (
            /* ACTIVE CHAT TIMELINE VIEW */
            <div className="w-full max-w-xl md:max-w-2xl flex flex-col gap-6 py-6 pb-24 h-full">
              
              <div className="border-b border-[#2d2d2a]/50 pb-4 flex items-center justify-between">
                <div className="flex flex-col text-left">
                  <span className="text-xs text-zinc-500 font-mono">Conversation Thread</span>
                  <h2 className="text-base md:text-lg font-serif font-semibold text-[#efeae4] leading-tight truncate max-w-[340px] md:max-w-[500px]">
                    {activeChat.title}
                  </h2>
                </div>
                <span className="px-2.5 py-1 text-[10px] bg-[#272724] border border-zinc-800 rounded text-zinc-400 font-mono">
                  {currentModel}
                </span>
              </div>

              {activeChat.messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col max-w-full ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 text-[10px] text-zinc-500 font-medium">
                      {isUser ? (
                        <>
                          <span>john skibidi</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-600" />
                          <span>User</span>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-1">
                            <span className="text-[#e2875e]">✴</span>
                            <span>Claude</span>
                          </span>
                          <span className="w-1 h-1 rounded-full bg-zinc-650" />
                          <span>Coach Model</span>
                        </>
                      )}
                    </div>
                    
                    <div 
                      className={`p-4 rounded-2xl text-left leading-relaxed text-sm shadow-sm border ${
                        isUser 
                          ? 'bg-[#21211f]/60 text-zinc-100 border-[#2f2f2b]/80 max-w-[85%]' 
                          : 'bg-transparent text-zinc-200 border-transparent max-w-full'
                      }`}
                    >
                      {/* Formats lines nicely with line breaks */}
                      <p className="whitespace-pre-line select-text">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Glowing Typing animation */}
              {isTyping && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-zinc-500 font-medium">
                    <span className="text-[#e2875e]">✴</span>
                    <span>Claude AI is processing...</span>
                  </div>
                  <div className="px-4 py-2 border border-transparent rounded-2xl flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e2875e] animate-bounce duration-300" style={{ animationDelay: '0s' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e2875e] animate-bounce duration-300" style={{ animationDelay: '0.15s' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e2875e] animate-bounce duration-300" style={{ animationDelay: '0.3s' }}></span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* PERSISTENT FLOATING BOTTOM CHATBOX FOR ACTIVE CONVERSATIONS */}
        {activeChat !== null && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#1b1b19] border-t border-[#242422]/60 px-4 py-4 md:px-8 z-20 flex justify-center">
            <div className="w-full max-w-xl md:max-w-2xl bg-[#20201e] border border-[#2f2f2b] rounded-2xl p-2 flex items-center justify-between shadow-2xl focus-within:border-[#e2875e]/60">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Message Claude (${currentModel})...`}
                className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 text-zinc-100 placeholder-zinc-500 px-3 py-1 text-left"
              />
              <div className="flex items-center gap-1.5 text-zinc-500">
                <button className="p-1.5 rounded-lg hover:bg-zinc-800 hover:text-zinc-300 cursor-pointer">
                  <Paperclip size={16} />
                </button>
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className={`p-1.5 rounded-xl duration-150 cursor-pointer ${
                    inputValue.trim() && !isTyping
                      ? 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]' 
                      : 'bg-zinc-800 text-zinc-650 cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
