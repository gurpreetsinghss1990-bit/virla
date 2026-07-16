import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Clipboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAIStore, ChatMessage, AIMemory } from '../store/aiStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

export default function VirlaAIScreen() {
  const router = useRouter();
  
  // Bind AI Store
  const {
    messages,
    memories,
    briefing,
    isThinking,
    isVoiceActive,
    voiceTranscript,
    voiceResponse,
    voiceState,
    sendMessage,
    regenerateMessage,
    deleteMessage,
    togglePinMessage,
    toggleFavoriteMessage,
    addMemory,
    setVoiceActive,
    triggerVoicePrompt,
    triggerMockNotification
  } = useAIStore();

  const [activeTab, setActiveTab] = useState<'home' | 'chat'>('home');
  const [chatInput, setChatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [expandedKnowledgeCard, setExpandedKnowledgeCard] = useState<string | null>(null);

  // Voice conversation orb animation
  const orbScale = useRef(new Animated.Value(1)).current;
  const waveHeight1 = useRef(new Animated.Value(20)).current;
  const waveHeight2 = useRef(new Animated.Value(15)).current;
  const waveHeight3 = useRef(new Animated.Value(25)).current;

  // Voice status change actions
  useEffect(() => {
    if (isVoiceActive) {
      // Loop scale animation for pulsing orb
      Animated.loop(
        Animated.sequence([
          Animated.timing(orbScale, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(orbScale, { toValue: 0.95, duration: 1200, useNativeDriver: true })
        ])
      ).start();

      // Loop wave oscillations
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(waveHeight1, { toValue: 45, duration: 400, useNativeDriver: false }),
            Animated.timing(waveHeight1, { toValue: 15, duration: 400, useNativeDriver: false })
          ]),
          Animated.sequence([
            Animated.timing(waveHeight2, { toValue: 35, duration: 500, useNativeDriver: false }),
            Animated.timing(waveHeight2, { toValue: 10, duration: 500, useNativeDriver: false })
          ]),
          Animated.sequence([
            Animated.timing(waveHeight3, { toValue: 55, duration: 350, useNativeDriver: false }),
            Animated.timing(waveHeight3, { toValue: 20, duration: 350, useNativeDriver: false })
          ])
        ])
      ).start();
    } else {
      orbScale.setValue(1);
    }
  }, [isVoiceActive]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  const handleSuggestionTap = (query: string) => {
    setActiveTab('chat');
    sendMessage(query);
  };

  const handleCopyMessage = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied to Clipboard', 'AI response text copied successfully.');
  };

  const filteredMessages = messages.filter(msg =>
    msg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const knowledgeCards = [
    {
      id: 'k-1',
      title: '💡 Technical Interview Tips',
      desc: 'Master Google & Meta coding standards',
      detail: 'Always state constraints, discuss multiple time-space complexity tradeoffs (O(N) vs O(N log N)), dry run with edge cases (empty arrays, negative numbers), and modularize clean helper structures.'
    },
    {
      id: 'k-2',
      title: '📝 Premium Resume Templates',
      desc: 'Tailor profiles for ATS algorithms',
      detail: 'Use direct action verbs (e.g. Architected, Headed, Optimized), format outcomes with metric indicators (X%, ₹Y, Z hours), and list technology stacks under clean index tags.'
    },
    {
      id: 'k-3',
      title: '💵 Salary Negotiation Tactics',
      desc: 'Command peak equity benchmarks',
      detail: 'Request full total compensation breakdown, defer initial anchor parameters to HR, detail rival stock/equity counterpoints, and emphasize execution confidence.'
    },
    {
      id: 'k-4',
      title: '👑 Executive Leadership Drills',
      desc: 'Build strong ownership maturity',
      detail: 'Focus on scaling processes, cross-team mentorship plans, technology risk mitigations, and aligning product metrics with engineer velocity.'
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FB]">
      {/* Header */}
      <View className="h-14 flex-row items-center px-6 border-b border-[#E5E7EB] bg-white justify-between">
        <TouchableOpacity onPress={() => router.back()} className="w-8 h-8 items-center justify-center">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        
        <View className="flex-row bg-[#F1F3F5] p-1 rounded-full">
          <TouchableOpacity
            onPress={() => setActiveTab('home')}
            className={`px-4 py-1.5 rounded-full ${activeTab === 'home' ? 'bg-white shadow-xs' : ''}`}
          >
            <Text className="text-[10px] font-black uppercase text-zinc-950">AI Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded-full ${activeTab === 'chat' ? 'bg-white shadow-xs' : ''}`}
          >
            <Text className="text-[10px] font-black uppercase text-zinc-950">AI Chat</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => setVoiceActive(true)} className="w-9 h-9 bg-zinc-900 rounded-full items-center justify-center">
          <Feather name="mic" size={14} color="white" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View className="flex-1">
        {activeTab === 'home' ? (
          /* =============================================================== */
          /* ======================== VIRLA AI HOME ======================== */
          /* =============================================================== */
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="gap-6">
              
              {/* Dynamic Welcome card */}
              <View className="gap-1">
                <Text className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Your AI Copilot</Text>
                <Text className="text-zinc-900 text-2xl font-black tracking-tight leading-tight">Good Evening, Viral ☀️</Text>
                <Text className="text-[#4F46E5] text-xs font-bold mt-1">🎯 Career Goal: Tech Lead & Mobile Architect</Text>
              </View>

              {/* Today's Daily Coach briefing Card (Feature 7) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <View className="flex-row justify-between items-center border-b border-zinc-100 pb-3">
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider">Morning briefing</Text>
                  <Feather name="sun" size={14} color="#F59E0B" />
                </View>

                <View className="gap-3">
                  {briefing.goals.map((goal, idx) => (
                    <View key={idx} className="flex-row items-center gap-2.5">
                      <Feather name="check-circle" size={12} color="#10B981" />
                      <Text className="text-zinc-700 text-xs font-semibold leading-relaxed flex-1">{goal}</Text>
                    </View>
                  ))}
                  
                  {briefing.missedGoals.map((goal, idx) => (
                    <View key={idx} className="flex-row items-center gap-2.5">
                      <Feather name="alert-circle" size={12} color="#EF4444" />
                      <Text className="text-zinc-500 text-xs font-semibold leading-relaxed flex-1 line-through">{goal}</Text>
                    </View>
                  ))}
                </View>

                <View className="h-[1px] bg-zinc-50 my-1" />

                <View className="gap-2 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                  <Text className="text-indigo-600 text-[8px] font-black uppercase">Coach Tip of the Day</Text>
                  <Text className="text-zinc-700 text-xs font-semibold leading-relaxed">{briefing.learningRecommendation}</Text>
                  <Text className="text-zinc-400 text-[10px] font-medium italic mt-1">{briefing.quote}</Text>
                </View>
              </View>

              {/* Suggested Questions Grid (Feature 5) */}
              <View className="gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">Ask Virla Anything</Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {[
                    { label: 'Improve Resume', query: 'improve resume' },
                    { label: 'Prepare Interview', query: 'prepare interview' },
                    { label: 'Find Jobs', query: 'find jobs' },
                    { label: 'Salary Negotiation', query: 'salary negotiation' },
                    { label: 'Practice HR', query: 'practice hr' },
                    { label: 'Mock Coding', query: 'mock coding' },
                    { label: 'Update LinkedIn', query: 'update linkedin' },
                    { label: 'Learning Plan', query: 'learning plan' }
                  ].map((btn, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleSuggestionTap(btn.query)}
                      className="bg-white border border-[#E5E7EB] px-3.5 py-2.5 rounded-2xl shadow-xs"
                    >
                      <Text className="text-zinc-900 text-[10px] font-black">{btn.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Expandable AI Knowledge Cards (Feature 8) */}
              <View className="gap-3">
                <Text className="text-[#111827] text-xs font-black uppercase tracking-widest pl-1">AI Knowledge Cards</Text>
                <View className="gap-3">
                  {knowledgeCards.map((card) => {
                    const isExpanded = expandedKnowledgeCard === card.id;
                    return (
                      <TouchableOpacity
                        key={card.id}
                        activeOpacity={0.9}
                        onPress={() => setExpandedKnowledgeCard(isExpanded ? null : card.id)}
                        className="bg-white border border-[#E5E7EB] p-4.5 rounded-[24px] shadow-xs gap-2"
                      >
                        <View className="flex-row justify-between items-center">
                          <View>
                            <Text className="text-zinc-950 text-xs font-black">{card.title}</Text>
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase mt-0.5">{card.desc}</Text>
                          </View>
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
                        </View>
                        {isExpanded && (
                          <View className="mt-2 pt-2 border-t border-zinc-50">
                            <Text className="text-zinc-600 text-xs font-semibold leading-relaxed">{card.detail}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Local Memory Storage Cards (Feature 4) */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Local Memory Logs</Text>
                <View className="gap-3">
                  {memories.map((mem, idx) => (
                    <View key={idx} className="flex-row justify-between items-center py-1 border-b border-zinc-50 pb-2">
                      <View className="flex-1 pr-3">
                        <Text className="text-zinc-900 text-xs font-black">{mem.key}</Text>
                        <Text className="text-zinc-500 text-[10px] font-semibold mt-0.5">{mem.value}</Text>
                      </View>
                      <View className="bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                        <Text className="text-[#4F46E5] text-[7px] font-black uppercase">{mem.category}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* AI Workspace drawer trigger (Feature 9) */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowWorkspace(!showWorkspace)}
                className="bg-zinc-950 p-5 rounded-[28px] shadow-lg flex-row justify-between items-center"
              >
                <View className="flex-row items-center gap-3">
                  <Feather name="folder" size={16} color="white" />
                  <View>
                    <Text className="text-white text-xs font-black uppercase tracking-wider">Open AI Workspace</Text>
                    <Text className="text-zinc-400 text-[8px] font-bold mt-0.5">Pinned chats, saved advice, bookmarks</Text>
                  </View>
                </View>
                <Feather name={showWorkspace ? 'chevron-up' : 'chevron-down'} size={14} color="white" />
              </TouchableOpacity>

              {showWorkspace && (
                <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-4">
                  <Text className="text-zinc-950 text-xs font-black uppercase tracking-wider pl-1">Saved Workspace Advice</Text>
                  <View className="gap-3">
                    {messages.filter(m => m.isPinned || m.isFavorite).length > 0 ? (
                      messages.filter(m => m.isPinned || m.isFavorite).map((m) => (
                        <View key={m.id} className="bg-zinc-50 border border-zinc-100 p-3 rounded-2xl gap-1">
                          <View className="flex-row justify-between">
                            <Text className="text-zinc-500 text-[8px] font-bold uppercase">{m.sender}</Text>
                            <Feather name={m.isPinned ? 'pin' : 'star'} size={10} color="#4F46E5" />
                          </View>
                          <Text className="text-zinc-800 text-xs font-semibold leading-relaxed mt-0.5">{m.text}</Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-zinc-400 text-[10px] text-center py-3 font-semibold">Bookmarks list empty. Favorite or Pin chat bubbles to save.</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Developer Notification Simulator Tools */}
              <View className="bg-white border border-[#E5E7EB] p-5 rounded-[28px] shadow-sm gap-3">
                <Text className="text-amber-500 text-xs font-black uppercase tracking-wider">AI Notification Push Simulator</Text>
                <View className="flex-row flex-wrap gap-2.5 mt-1">
                  <TouchableOpacity onPress={() => triggerMockNotification('resume')} className="bg-zinc-900 px-3 py-2 rounded-xl">
                    <Text className="text-white text-[7px] font-black uppercase">Tailor Resume</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => triggerMockNotification('questions')} className="bg-zinc-900 px-3 py-2 rounded-xl">
                    <Text className="text-white text-[7px] font-black uppercase">Interview Prep</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => triggerMockNotification('practice')} className="bg-zinc-900 px-3 py-2 rounded-xl">
                    <Text className="text-white text-[7px] font-black uppercase">STAR Review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => triggerMockNotification('milestone')} className="bg-zinc-900 px-3 py-2 rounded-xl">
                    <Text className="text-white text-[7px] font-black uppercase">Streak Milestone</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </ScrollView>
        ) : (
          /* =============================================================== */
          /* ======================== VIRLA AI CHAT ======================== */
          /* =============================================================== */
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            {/* Conversation Search Bar */}
            <View className="bg-white border-b border-zinc-150 p-3 flex-row items-center gap-2 px-6">
              <Feather name="search" size={12} color="#9CA3AF" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search conversation text..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 text-zinc-900 text-xs font-semibold"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={12} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 50 }}>
              <View className="gap-5">
                {filteredMessages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <View key={msg.id} className={`max-w-[80%] gap-1.5 ${isUser ? 'self-end' : 'self-start'}`}>
                      
                      <View className={`p-4.5 rounded-[24px] ${
                        isUser 
                          ? 'bg-zinc-950 rounded-tr-none' 
                          : 'bg-white border border-zinc-200 rounded-tl-none'
                      }`}>
                        <Text className={`text-xs font-semibold leading-relaxed ${isUser ? 'text-white' : 'text-zinc-900'}`}>
                          {msg.text}
                        </Text>
                      </View>

                      {/* Bubble Actions bar for AI reply */}
                      {!isUser && (
                        <View className="flex-row gap-3 pl-2 mt-0.5 items-center">
                          <TouchableOpacity onPress={() => handleCopyMessage(msg.text)}>
                            <Feather name="copy" size={10} color="#9CA3AF" />
                          </TouchableOpacity>
                          
                          <TouchableOpacity onPress={() => togglePinMessage(msg.id)}>
                            <Feather name="pin" size={10} color={msg.isPinned ? '#4F46E5' : '#9CA3AF'} />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => toggleFavoriteMessage(msg.id)}>
                            <Feather name="star" size={10} color={msg.isFavorite ? '#F59E0B' : '#9CA3AF'} />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => regenerateMessage(msg.id)}>
                            <Feather name="rotate-ccw" size={10} color="#9CA3AF" />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => deleteMessage(msg.id)}>
                            <Feather name="trash" size={10} color="#EF4444" opacity={0.7} />
                          </TouchableOpacity>

                          <Text className="text-zinc-400 text-[7px] font-bold uppercase ml-auto">{msg.timestamp}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* AI Thinking loader state */}
                {isThinking && (
                  <View className="bg-white border border-zinc-200 p-4.5 rounded-[24px] rounded-tl-none self-start max-w-[40%] flex-row gap-1 items-center">
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" />
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce delay-100" />
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce delay-200" />
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Input message bar */}
            <View className="p-4 border-t border-zinc-150 bg-white flex-row gap-3 items-center">
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask Virla advice or coding problems..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 bg-zinc-50 border border-zinc-150 p-4.5 rounded-2xl text-zinc-900 text-xs font-semibold"
              />
              <TouchableOpacity
                onPress={handleSend}
                className="w-12 h-12 rounded-2xl bg-zinc-950 items-center justify-center shadow-xs"
              >
                <Feather name="arrow-up" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Apple Intelligence Style Voice Copilot Overlay (Feature 3) */}
      {isVoiceActive && (
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/95 z-50 items-center justify-center p-6 gap-8">
          
          <TouchableOpacity
            onPress={() => setVoiceActive(false)}
            className="absolute top-12 right-6 w-10 h-10 rounded-full bg-zinc-900 items-center justify-center"
          >
            <Feather name="x" size={18} color="white" />
          </TouchableOpacity>

          <View className="items-center gap-1.5">
            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest">Virla voice copilot</Text>
            <Text className="text-white text-lg font-black text-center mt-1">Apple Intelligence active</Text>
          </View>

          {/* Large pulsing orb and waves */}
          <View className="relative w-48 h-48 items-center justify-center my-6">
            <Animated.View
              style={{
                transform: [{ scale: orbScale }],
                opacity: 0.85
              }}
              className="w-36 h-36 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl items-center justify-center"
            >
              <Svg width={144} height={144} viewBox="0 0 144 144" className="absolute">
                <Defs>
                  <RadialGradient id="grad-orb" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                    <Stop offset="50%" stopColor="#EC4899" stopOpacity="0.5" />
                    <Stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle cx={72} cy={72} r={65} fill="url(#grad-orb)" />
              </Svg>
            </Animated.View>
            
            {/* Shifting voice height wave graphics */}
            <View className="absolute bottom-2 flex-row gap-1 items-end h-16 justify-center w-full">
              <Animated.View style={{ height: waveHeight1 }} className="w-1.5 rounded-full bg-indigo-400" />
              <Animated.View style={{ height: waveHeight2 }} className="w-1.5 rounded-full bg-purple-400" />
              <Animated.View style={{ height: waveHeight3 }} className="w-1.5 rounded-full bg-pink-400" />
              <Animated.View style={{ height: waveHeight1 }} className="w-1.5 rounded-full bg-cyan-400" />
            </View>
          </View>

          {/* Transcription details */}
          <View className="items-center gap-3 px-6 max-w-[90%]">
            <Text className="text-zinc-400 text-xs font-semibold italic text-center leading-relaxed">
              {voiceTranscript || 'Listening for your instructions...'}
            </Text>
            {voiceResponse.length > 0 && (
              <Text className="text-[#A5B4FC] text-sm font-bold text-center leading-relaxed mt-2 bg-indigo-950/40 p-4.5 rounded-2xl border border-indigo-900/30">
                📢 {voiceResponse}
              </Text>
            )}
          </View>

          {/* Voice Prompt Simulator Buttons */}
          <View className="gap-2.5 items-center w-full mt-4">
            <Text className="text-zinc-600 text-[8px] font-black uppercase tracking-wider">Tap simulated query prompts</Text>
            <View className="flex-row gap-2.5 justify-center">
              <TouchableOpacity
                onPress={() => triggerVoicePrompt('Tailor my resume for a Tech Lead post.')}
                className="bg-zinc-900 px-3.5 py-2.5 rounded-xl border border-zinc-800"
              >
                <Text className="text-white text-[8px] font-black uppercase">Tailor Resume</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => triggerVoicePrompt('Start Google System Design Interview Prep.')}
                className="bg-zinc-900 px-3.5 py-2.5 rounded-xl border border-zinc-800"
              >
                <Text className="text-white text-[8px] font-black uppercase">Start Mock Prep</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => triggerVoicePrompt('Log recovery card workout logs.')}
                className="bg-zinc-900 px-3.5 py-2.5 rounded-xl border border-zinc-800"
              >
                <Text className="text-white text-[8px] font-black uppercase">Reset Workout</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Controls Bar */}
          <View className="flex-row gap-6 mt-6">
            <TouchableOpacity className="w-12 h-12 rounded-full bg-zinc-900 items-center justify-center">
              <Feather name="volume-2" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setVoiceActive(false)} className="w-12 h-12 rounded-full bg-red-600 items-center justify-center">
              <Feather name="phone-off" size={16} color="white" />
            </TouchableOpacity>
          </View>

        </View>
      )}
    </SafeAreaView>
  );
}
