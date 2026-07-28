import { create } from 'zustand';
import { Database } from '../database/Database';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'virla';
  text: string;
  timestamp: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  isThinking?: boolean;
}

export interface AIMemory {
  key: string;
  value: string;
  category: 'Resume' | 'Interview' | 'Career Goals' | 'Skills' | 'Applications' | 'Weak Areas' | 'Preferred Companies';
}

export interface DailyCoachBriefing {
  goals: string[];
  missedGoals: string[];
  upcomingInterview: string;
  resumeReminder: string;
  applicationsReminder: string;
  learningRecommendation: string;
  quote: string;
}

interface AIState {
  messages: ChatMessage[];
  memories: AIMemory[];
  briefing: DailyCoachBriefing;
  isThinking: boolean;
  isVoiceActive: boolean;
  voiceTranscript: string;
  voiceResponse: string;
  voiceState: 'listening' | 'thinking' | 'speaking';
  
  // Actions
  sendMessage: (text: string) => void;
  regenerateMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
  togglePinMessage: (id: string) => void;
  toggleFavoriteMessage: (id: string) => void;
  addMemory: (key: string, value: string, category: AIMemory['category']) => void;
  setVoiceActive: (active: boolean) => void;
  triggerVoicePrompt: (prompt: string) => void;
  triggerMockNotification: (type: 'resume' | 'questions' | 'practice' | 'milestone') => void;
  syncFromDB: () => void;
}

const mockReplies: Record<string, string> = {
  'improve resume': "Based on your targets, let's quantify your impact. Rewrite your experience bullet to: 'Engineered cross-platform React Native apps, reducing load times by 35% and boosting retention by 22%.'",
  'prepare interview': "Let's run a mock behavioral loop. Google often asks: 'Describe a time you solved a complex architectural constraint under short deadlines.' Keep your answer focused on STAR methodology.",
  'find jobs': "I found 3 matching roles for you: 1. Senior Mobile Engineer (Google, Remote), 2. Tech Lead (Whoop, Bengaluru), 3. React Native Architect (Nike, Mumbai). Ready to tailor your applications?",
  'salary negotiation': "Always let the company anchor the initial offer. When negotiating, emphasize that your expertise in Expo cross-platform architectures mitigates their release risks.",
  'practice hr': "HR mock question: 'Why are you looking to leave your current role?' Frame it around seeking technical scaling opportunities and driving larger product decisions.",
  'mock coding': "Let's practice a classic problem: 'Design a high-throughput notifications queue store in React Native'. Think about store persistence, caching, and state sync.",
  'update linkedin': "Upgrade your headline: 'Tech Lead | React Native & Expo Architect | Building High-Performance Consumer Apps'. This increases recruiter discovery hits by 40%.",
  'career switch': "Transitioning from Engineer to Tech Lead requires showcasing leadership. Focus your resume on mentorship, architectural design decisions, and system ownership.",
  'daily goal': "Your goal today: complete 1 mock interview section and log 1 workout session. A balanced developer mind builds the best systems.",
  'learning plan': "Learning recommendation: review micro-frontend bundlers and native bridge APIs in React Native. Dedicate 30 mins to reading the latest Expo v57 docs."
};

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  memories: [
    { key: 'Target Role', value: 'Tech Lead / Senior Software Engineer', category: 'Career Goals' },
    { key: 'Preferred Companies', value: 'Google, Apple, Nike, Whoop', category: 'Preferred Companies' },
    { key: 'Core Skills', value: 'TypeScript, React Native, Expo, System Design', category: 'Skills' }
  ],
  briefing: {
    goals: ['Log morning hydration stretch session', 'Prepare System Design overview', 'Complete 1 home-workout activity'],
    missedGoals: ['Practice salary negotiating prompts yesterday'],
    upcomingInterview: 'Mock Interview (Google Tech Lead) - Tomorrow @ 2:00 PM',
    resumeReminder: 'Tailor resume experience section for Senior Mobile Architect',
    applicationsReminder: '3 applications pending follow-ups this week',
    learningRecommendation: 'Review native modules bridges in React Native Expo',
    quote: '"The best way to predict the future is to create it." — Peter Drucker'
  },
  isThinking: false,
  isVoiceActive: false,
  voiceTranscript: '',
  voiceResponse: '',
  voiceState: 'listening',

  sendMessage: (text) => {
    const userId = Database.getCurrentUserId() || 'guest';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Save to DB
    const userMsg = Database.sendChatMessage('ai-coach', text, 'user');
    
    set((state) => ({
      messages: [...state.messages, {
        id: userMsg.id,
        sender: 'user',
        text: userMsg.text,
        timestamp: userMsg.timestamp
      }],
      isThinking: true
    }));

    // Find smart suggestions response or fallback response
    const query = text.toLowerCase();
    let responseText = "I'm analyzing your request. Let's cross-reference this with your skills and goals to design the best next action.";
    
    for (const key in mockReplies) {
      if (query.includes(key)) {
        responseText = mockReplies[key];
        break;
      }
    }

    // Simulate streaming text reply (Apple Intelligence style)
    setTimeout(() => {
      const aiMsg = Database.sendChatMessage('ai-coach', responseText, 'virla' as any);
      
      const placeholderMsg: ChatMessage = {
        id: aiMsg.id,
        sender: 'virla',
        text: '',
        timestamp: timeStr,
        isThinking: false
      };

      set((state) => ({
        messages: [...state.messages, placeholderMsg],
        isThinking: false
      }));

      // Stream character by character
      let currentLen = 0;
      const interval = setInterval(() => {
        currentLen += 8;
        if (currentLen >= responseText.length) {
          clearInterval(interval);
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === aiMsg.id ? { ...m, text: responseText } : m
            )
          }));
        } else {
          const partial = responseText.substring(0, currentLen);
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === aiMsg.id ? { ...m, text: partial } : m
            )
          }));
        }
      }, 50);

    }, 1200);
  },

  regenerateMessage: (id) => {
    const state = get();
    const index = state.messages.findIndex(m => m.id === id);
    if (index === -1) return;
    
    const prevUserMsg = state.messages.slice(0, index).reverse().find(m => m.sender === 'user');
    if (!prevUserMsg) return;

    set({ isThinking: true });
    
    setTimeout(() => {
      const regeneratedText = `[Regenerated advice] Let's try another perspective on "${prevUserMsg.text}". Consider focusing on metrics and business outcomes to highlight leadership maturity.`;
      
      // Update in DB messages array
      const dbMsg = Database.schema.messages.find(m => m.id === id);
      if (dbMsg) dbMsg.text = regeneratedText;

      set((state) => ({
        isThinking: false,
        messages: state.messages.map(m =>
          m.id === id ? { ...m, text: regeneratedText } : m
        )
      }));
    }, 1000);
  },

  deleteMessage: (id) => {
    Database.schema.messages = Database.schema.messages.filter(m => m.id !== id);
    set((state) => ({
      messages: state.messages.filter(m => m.id !== id)
    }));
  },

  togglePinMessage: (id) => {
    const dbMsg = Database.schema.messages.find(m => m.id === id);
    if (dbMsg) dbMsg.isPinned = !dbMsg.isPinned;
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, isPinned: !m.isPinned } : m
      )
    }));
  },

  toggleFavoriteMessage: (id) => {
    const dbMsg = Database.schema.messages.find(m => m.id === id);
    if (dbMsg) dbMsg.isFavorite = !dbMsg.isFavorite;
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === id ? { ...m, isFavorite: !m.isFavorite } : m
      )
    }));
  },

  addMemory: (key, value, category) => {
    set((state) => ({
      memories: [...state.memories, { key, value, category }]
    }));
  },

  setVoiceActive: (active) => {
    set({ 
      isVoiceActive: active,
      voiceTranscript: active ? 'Listening for your command...' : '',
      voiceResponse: '',
      voiceState: 'listening'
    });
  },

  triggerVoicePrompt: (prompt) => {
    set({
      voiceTranscript: `"${prompt}"`,
      voiceState: 'thinking'
    });

    setTimeout(() => {
      let voiceReply = "Processing your request. Adjusting your daily career objectives now.";
      const query = prompt.toLowerCase();
      if (query.includes('resume')) voiceReply = "Sure, I have opened your target resume template and flagged 2 improvements.";
      else if (query.includes('interview')) voiceReply = "System Design mock session is queued. Let me know when you're ready to start.";
      else if (query.includes('workout')) voiceReply = "Alright, let's schedule a Reset Recovery session for this evening.";

      set({
        voiceState: 'speaking',
        voiceResponse: voiceReply
      });
    }, 1500);
  },

  triggerMockNotification: (type) => {
    const configMap = {
      resume: {
        title: 'AI Smart Tip: Resume Upgrade 💡',
        body: 'Virla recommends tailoring your summary headline for Senior Architect roles.',
        icon: 'award'
      },
      questions: {
        title: 'Interview Q&A Ready 🏆',
        body: 'Virla generated 5 custom System Design interview questions based on Google logs.',
        icon: 'lock'
      },
      practice: {
        title: 'Daily Practice Goal ⏱',
        body: 'Virla suggests completing a 15-minute behavioral STAR review session today.',
        icon: 'user-check'
      },
      milestone: {
        title: 'Milestone Unlocked 🎉',
        body: 'Congratulations! You maintained your active preparation streak for 5 days.',
        icon: 'plus-circle'
      }
    };
    
    const notificationStoreModule = require('./notificationStore');
    if (notificationStoreModule && notificationStoreModule.useNotificationStore) {
      notificationStoreModule.useNotificationStore.getState().addNotification(configMap[type]);
    }
  },

  syncFromDB: () => {
    const userId = Database.getCurrentUserId();
    if (userId) {
      const profile = Database.getProfile(userId);
      const chatMessages = Database.getChatMessages('ai-coach');
      const recs = Database.getAIRecommendations(userId);
      
      const goalList = recs.map(r => r.title);
      
      set({
        messages: chatMessages.map(m => ({
          id: m.id,
          sender: m.sender === 'user' ? 'user' : 'virla',
          text: m.text,
          timestamp: m.timestamp,
          isPinned: m.isPinned,
          isFavorite: m.isFavorite
        })),
        briefing: {
          goals: goalList.length > 0 ? goalList : ['Log morning hydration stretch session', 'Prepare System Design overview', 'Complete 1 home-workout activity'],
          missedGoals: ['Practice salary negotiating prompts yesterday'],
          upcomingInterview: 'Mock Interview (Google Tech Lead) - Tomorrow @ 2:00 PM',
          resumeReminder: 'Tailor resume experience section for Senior Mobile Architect',
          applicationsReminder: '3 applications pending follow-ups this week',
          learningRecommendation: 'Review native modules bridges in React Native Expo',
          quote: '"The best way to predict the future is to create it." — Peter Drucker'
        }
      });
    } else {
      set({
        messages: [],
        briefing: {
          goals: [],
          missedGoals: [],
          upcomingInterview: '',
          resumeReminder: '',
          applicationsReminder: '',
          learningRecommendation: '',
          quote: ''
        }
      });
    }
  }
}));
