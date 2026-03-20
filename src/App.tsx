/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  loginWithGoogle, 
  logout, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  FirebaseUser,
  OperationType,
  handleFirestoreError
} from './firebase';
import { UserProfile, ChatSession, ChatMessage, AppScreen, UserSettings } from './types';
import { generateChatResponse } from './services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Leaf, 
  Mail, 
  Lock, 
  Eye, 
  ArrowRight, 
  HelpCircle, 
  ShieldCheck, 
  Brain, 
  Verified, 
  Menu, 
  Search, 
  Sprout, 
  Flower2, 
  Flower, 
  Info, 
  PlusCircle, 
  Smile, 
  Mic, 
  Send, 
  MessageSquare, 
  History, 
  Compass, 
  Palette, 
  Mic2, 
  Bell, 
  Shield, 
  ChevronRight, 
  Delete, 
  PlayCircle,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
  CheckCircle2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-error-container flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-2xl font-headline font-bold text-error mb-4">Something went wrong</h2>
          <p className="text-on-surface-variant mb-6">We encountered an unexpected error. Please try refreshing the page.</p>
          <pre className="text-xs bg-surface-container p-4 rounded-lg overflow-auto max-h-40 mb-6 text-left">
            {errorInfo}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold"
          >
            Refresh App
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const SplashScreen = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-20 h-20 bg-primary-container/20 rounded-2xl flex items-center justify-center mb-6"
    >
      <Sprout className="text-primary w-12 h-12" />
    </motion.div>
    <h1 className="text-4xl font-headline font-black text-primary mb-2">Terra Chat</h1>
    <p className="text-on-surface-variant">Rooting your digital space...</p>
  </div>
);

// --- App Root ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const profileRef = doc(db, 'users', firebaseUser.uid);
        try {
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
            setCurrentScreen('chat');
          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              role: 'user',
              settings: {
                darkMode: false,
                themeAccent: '#4a7c59',
                aiLanguage: 'English (US) - Natural',
                speechSpeed: 1.1,
                autoPlayResponses: true
              },
              createdAt: Timestamp.now()
            };
            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
            setCurrentScreen('chat');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setProfile(null);
        setCurrentScreen('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <SplashScreen />;

  return (
    <ErrorBoundary>
      <div className={cn("min-h-screen bg-background text-on-surface", profile?.settings.darkMode && "dark")}>
        <AnimatePresence mode="wait">
          {currentScreen === 'login' && <LoginScreen key="login" onNavigate={setCurrentScreen} />}
          {currentScreen === 'register' && <RegisterScreen key="register" onNavigate={setCurrentScreen} />}
          {currentScreen === 'chat' && (
            <ChatScreen 
              key="chat" 
              profile={profile!} 
              onNavigate={setCurrentScreen} 
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
            />
          )}
          {currentScreen === 'voice' && <VoiceScreen key="voice" onNavigate={setCurrentScreen} />}
          {currentScreen === 'settings' && <SettingsScreen key="settings" profile={profile!} onNavigate={setCurrentScreen} />}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Screens ---

function LoginScreen({ onNavigate }: { onNavigate: (s: AppScreen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
    >
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-container/20 rounded-xl mb-4">
            <Sprout className="text-primary w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight">Terra Chat</h1>
          <p className="text-on-surface-variant font-body mt-2">Welcome back to a grounded space.</p>
        </div>

        <div className="bg-surface-container-low p-8 rounded-xl shadow-[0_4px_20px_rgba(46,50,48,0.06)] border border-outline-variant/10">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-secondary ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <input 
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="alex.rivers@terra.com"
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-semibold text-secondary">Password</label>
                <button className="text-xs font-bold text-tertiary hover:underline">Forgot Password?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                <input 
                  className="w-full pl-12 pr-12 py-3.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                  type="password"
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-1">
              <input type="checkbox" className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20" id="remember" />
              <label htmlFor="remember" className="text-sm text-on-surface-variant font-medium">Keep me logged in</label>
            </div>

            <button className="w-full bg-primary text-on-primary font-bold py-4 rounded-lg shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              Login to Terra
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/40"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-surface-container-low px-4 text-outline font-bold">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={loginWithGoogle}
              className="flex items-center justify-center gap-3 py-3 border border-outline-variant/50 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high transition-colors text-sm font-bold text-secondary"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Google
            </button>
            <button className="flex items-center justify-center gap-3 py-3 border border-outline-variant/50 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high transition-colors text-sm font-bold text-secondary">
              <span className="w-5 h-5 flex items-center justify-center"></span>
              Apple
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-on-surface-variant font-medium">
          New to Terra? 
          <button onClick={() => onNavigate('register')} className="text-primary font-bold hover:underline ml-1">Create an account</button>
        </p>

        <div className="mt-12 text-center">
          <div className="flex justify-center gap-6 text-xs font-bold text-outline uppercase tracking-wider">
            <button className="hover:text-tertiary transition-colors">Privacy Policy</button>
            <button className="hover:text-tertiary transition-colors">Terms of Service</button>
          </div>
        </div>
      </div>

      <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary-container/5 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-tertiary-container/5 rounded-full blur-[120px] -z-10"></div>
    </motion.div>
  );
}

function RegisterScreen({ onNavigate }: { onNavigate: (s: AppScreen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col"
    >
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-primary text-xl tracking-tight">Terra Chat</span>
        </div>
        <button className="text-secondary hover:bg-primary/5 p-2 rounded-full transition-colors">
          <HelpCircle className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-24">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="hidden lg:flex flex-col gap-8 pr-12">
            <div className="space-y-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container/20 text-primary font-bold text-xs uppercase tracking-wider">Join our community</span>
              <h1 className="text-5xl font-headline font-black text-on-background leading-tight">
                Rooted in conversation, <span className="text-primary italic">naturally.</span>
              </h1>
              <p className="text-lg text-on-surface-variant leading-relaxed max-w-md">
                Experience a chat platform that prioritizes human warmth, organic design, and thoughtful interaction.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-low p-6 rounded-xl shadow-sm flex flex-col gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary-container/30 flex items-center justify-center text-tertiary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-headline font-bold text-lg">Secure by Nature</h3>
                <p className="text-sm text-on-surface-variant leading-snug">Privacy that respects your space and conversations.</p>
              </div>
              <div className="bg-surface-container-high p-6 rounded-xl shadow-sm mt-8 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container/30 flex items-center justify-center text-primary">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="font-headline font-bold text-lg">Smart Knowledge</h3>
                <p className="text-sm text-on-surface-variant leading-snug">AI assistants that learn your preferences over time.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center w-full">
            <div className="bg-surface-container-lowest p-8 md:p-12 rounded-xl shadow-xl w-full max-w-md border border-outline-variant/10">
              <div className="mb-8 space-y-2">
                <h2 className="text-3xl font-headline font-bold text-on-surface">Create Account</h2>
                <p className="text-on-surface-variant">Start your journey with Terra Chat today.</p>
              </div>
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-on-surface-variant ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                    <input className="w-full pl-12 pr-4 py-3.5 bg-background border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary transition-all" placeholder="Alex Rivers" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-on-surface-variant ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                    <input className="w-full pl-12 pr-4 py-3.5 bg-background border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary transition-all" placeholder="alex@terra.com" type="email" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-on-surface-variant ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                      <input className="w-full pl-12 pr-4 py-3.5 bg-background border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary transition-all" placeholder="••••••••" type="password" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-on-surface-variant ml-1">Confirm</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
                      <input className="w-full pl-12 pr-4 py-3.5 bg-background border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary transition-all" placeholder="••••••••" type="password" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-2">
                  <input type="checkbox" className="w-4 h-4 text-primary bg-background border-outline-variant/50 rounded focus:ring-primary mt-1" id="terms" />
                  <label className="text-xs text-on-surface-variant leading-normal" htmlFor="terms">
                    I agree to the <button className="text-primary font-bold hover:underline">Terms & Conditions</button> and <button className="text-primary font-bold hover:underline">Privacy Policy</button>.
                  </label>
                </div>
                <button className="w-full py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4">
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/30"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 bg-surface-container-lowest text-outline font-bold">Or sign up with</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={loginWithGoogle}
                  className="flex items-center justify-center gap-2 py-3 bg-background border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors font-semibold text-sm"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  Google
                </button>
                <button className="flex items-center justify-center gap-2 py-3 bg-background border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors font-semibold text-sm">
                  <span></span>
                  Apple
                </button>
              </div>
              <p className="mt-8 text-center text-sm text-on-surface-variant">
                Already have an account? 
                <button onClick={() => onNavigate('login')} className="text-primary font-bold hover:underline ml-1">Log In</button>
              </p>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-8 left-8 hidden md:flex items-center gap-4 bg-tertiary-container/10 border border-tertiary-container/30 p-4 rounded-xl max-w-sm backdrop-blur-sm">
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-tertiary-container flex items-center justify-center text-on-tertiary-container">
          <Verified className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-tertiary uppercase tracking-wider">Trusted by 50k+</p>
          <p className="text-sm text-on-tertiary-container font-medium leading-tight">Join a community that values privacy and deep connection.</p>
        </div>
      </div>
    </motion.div>
  );
}

function ChatScreen({ profile, onNavigate, activeChatId, setActiveChatId }: { 
  profile: UserProfile, 
  onNavigate: (s: AppScreen) => void,
  activeChatId: string | null,
  setActiveChatId: (id: string | null) => void
}) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chatsQuery = query(
      collection(db, 'chats'),
      where('userId', '==', profile.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setChats(chatList);
      if (chatList.length > 0 && !activeChatId) {
        setActiveChatId(chatList[0].id);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    return () => unsubscribe();
  }, [profile.uid]);

  useEffect(() => {
    if (!activeChatId) return;

    const messagesQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(messageList);
      scrollToBottom();
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`));

    return () => unsubscribe();
  }, [activeChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    let chatId = activeChatId;
    const text = inputText;
    setInputText('');

    try {
      if (!chatId) {
        const chatRef = await addDoc(collection(db, 'chats'), {
          userId: profile.uid,
          title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
          lastMessage: text,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        chatId = chatRef.id;
        setActiveChatId(chatId);
      } else {
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: text,
          updatedAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        userId: profile.uid,
        role: 'user',
        content: text,
        createdAt: serverTimestamp()
      });

      setIsTyping(true);
      
      // Get history for Gemini
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const aiResponse = await generateChatResponse(text, history);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        role: 'model',
        content: aiResponse.text,
        thinking: aiResponse.thinking,
        createdAt: serverTimestamp()
      });

      setIsTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || window.innerWidth >= 768) && (
          <motion.aside 
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            className={cn(
              "fixed inset-y-0 left-0 z-[60] py-6 bg-surface-container-low shadow-xl rounded-r-2xl w-80 flex flex-col transition-transform md:relative md:translate-x-0",
              !sidebarOpen && "hidden md:flex"
            )}
          >
            <div className="px-6 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary">
                <Leaf className="w-6 h-6" />
              </div>
              <span className="font-serif font-black text-primary text-2xl">Terra</span>
            </div>

            <div className="px-4 mb-6">
              <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-outline-variant">
                  <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt={profile.displayName!} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-serif font-bold text-on-surface text-base">{profile.displayName}</div>
                  <div className="text-xs font-medium text-secondary">Pro Member</div>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 space-y-1">
              <button 
                onClick={createNewChat}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-primary hover:bg-primary/5 transition-all font-medium"
              >
                <PlusCircle className="w-5 h-5" />
                New Chat
              </button>
              <div className="pt-4 pb-2 px-4 text-xs font-bold text-outline uppercase tracking-widest">Recent Chats</div>
              {chats.map(chat => (
                <button 
                  key={chat.id}
                  onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
                  className={cn(
                    "w-full px-4 py-3 flex items-center gap-3 rounded-xl text-sm font-medium transition-all text-left",
                    activeChatId === chat.id ? "bg-primary/10 text-primary" : "text-secondary hover:bg-surface-container-high"
                  )}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </nav>

            <div className="px-2 mt-auto pt-4 border-t border-outline-variant/20">
              <button onClick={() => onNavigate('settings')} className="w-full px-4 py-3 flex items-center gap-3 rounded-xl text-secondary hover:bg-surface-container-high transition-all font-medium">
                <SettingsIcon className="w-5 h-5" />
                Settings
              </button>
              <button onClick={logout} className="w-full px-4 py-3 flex items-center gap-3 rounded-xl text-error hover:bg-error-container/20 transition-all font-medium">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-background">
        <header className="h-16 flex items-center justify-between px-6 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-primary">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-serif font-bold text-xl text-primary">Terra Chat</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-secondary hover:text-primary transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => onNavigate('settings')} className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant">
              <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-6">
              <div className="w-20 h-20 bg-primary-container/20 rounded-3xl flex items-center justify-center text-primary">
                <Sprout className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-headline font-bold text-on-surface">How can I help you today?</h2>
                <p className="text-on-surface-variant">I'm Terra, your grounded AI companion. Ask me anything about nature, gardening, or life's complex questions.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 w-full">
                <button onClick={() => setInputText("Tell me about companion planting for tomatoes")} className="p-4 bg-surface-container rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all text-left border border-outline-variant/10">
                  "Tell me about companion planting for tomatoes"
                </button>
                <button onClick={() => setInputText("How do I care for a fiddle leaf fig in winter?")} className="p-4 bg-surface-container rounded-xl text-sm font-medium hover:bg-surface-container-high transition-all text-left border border-outline-variant/10">
                  "How do I care for a fiddle leaf fig in winter?"
                </button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex items-start gap-4 max-w-[90%] md:max-w-[80%]", msg.role === 'user' ? "self-end flex-row-reverse" : "self-start")}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm",
                msg.role === 'user' ? "bg-secondary-container overflow-hidden" : "bg-primary-container text-on-primary"
              )}>
                {msg.role === 'user' ? (
                  <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <Sprout className="w-6 h-6" />
                )}
              </div>
              <div className={cn("flex flex-col gap-1.5", msg.role === 'user' ? "items-end" : "items-start")}>
                {msg.thinking && (
                  <details className="w-full bg-surface-container-low rounded-xl p-3 mb-2 text-xs text-on-surface-variant border border-outline-variant/20">
                    <summary className="cursor-pointer font-bold uppercase tracking-widest flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Thinking Process
                    </summary>
                    <div className="mt-2 pl-6 italic border-l-2 border-primary/20">
                      {msg.thinking}
                    </div>
                  </details>
                )}
                <div className={cn(
                  "p-5 leading-relaxed shadow-sm",
                  msg.role === 'user' 
                    ? "bg-primary text-on-primary rounded-l-2xl rounded-br-2xl" 
                    : "bg-surface-container rounded-r-2xl rounded-bl-2xl text-on-surface border border-outline-variant/10"
                )}>
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">
                  {msg.role === 'user' ? 'You' : 'Terra'} • {format(msg.createdAt?.toDate() || new Date(), 'hh:mm a')}
                </span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-4 self-start">
              <div className="w-10 h-10 rounded-xl bg-primary-container flex-shrink-0 flex items-center justify-center text-on-primary shadow-sm">
                <Sprout className="w-6 h-6 animate-pulse" />
              </div>
              <div className="bg-surface-container rounded-r-2xl rounded-bl-2xl p-5 flex gap-1">
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 md:p-8 bg-background/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex-1 bg-surface-container-highest rounded-2xl flex items-center px-4 py-1.5 shadow-inner border border-outline-variant/20">
              <button className="p-2 text-secondary hover:text-primary transition-colors">
                <PlusCircle className="w-6 h-6" />
              </button>
              <input 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface py-3 text-base" 
                placeholder="Message Terra..." 
              />
              <button className="p-2 text-secondary hover:text-primary transition-colors">
                <Smile className="w-6 h-6" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onNavigate('voice')} className="w-12 h-12 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg hover:opacity-90 active:scale-95 transition-all">
                <Mic className="w-6 h-6" />
              </button>
              <button onClick={handleSendMessage} className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg hover:opacity-90 active:scale-95 transition-all">
                <Send className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden flex justify-around items-center h-16 bg-background/95 backdrop-blur-md border-t border-outline-variant/10">
          <button onClick={() => onNavigate('chat')} className="flex flex-col items-center text-primary">
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Chat</span>
          </button>
          <button onClick={() => onNavigate('settings')} className="flex flex-col items-center text-outline">
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Settings</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

function VoiceScreen({ onNavigate }: { onNavigate: (s: AppScreen) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="min-h-screen flex flex-col bg-background"
    >
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-background/80 backdrop-blur-md border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('chat')} className="text-primary p-2 rounded-full hover:bg-primary/5">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-serif font-bold text-xl text-primary">Terra Chat</h1>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center pt-16 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-tertiary/5 rounded-full blur-3xl"></div>

        <div className="w-full max-w-lg flex flex-col items-center text-center space-y-12 z-10">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-48 h-48 rounded-full bg-primary/20 voice-ring-1"></div>
            <div className="absolute w-48 h-48 rounded-full bg-primary/10 voice-ring-2"></div>
            <div className="relative w-32 h-32 rounded-full bg-primary shadow-xl flex items-center justify-center z-20">
              <Mic className="text-on-primary w-12 h-12" />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-headline text-3xl font-bold text-on-surface">Listening...</h2>
            <p className="text-on-surface-variant font-medium max-w-xs mx-auto">Tell me about the flora in your garden or ask for a recipe.</p>
          </div>

          <div className="flex items-center gap-1.5 h-16">
            {[0.1, 0.3, 0.2, 0.5, 0.4, 0.6, 0.2].map((delay, i) => (
              <div key={i} className="waveform-bar w-1.5 bg-primary rounded-full" style={{ animationDelay: `${delay}s` }}></div>
            ))}
          </div>

          <div className="flex items-center gap-6 w-full justify-center">
            <button onClick={() => onNavigate('chat')} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center group-hover:bg-error-container group-hover:text-error transition-all duration-300">
                <Delete className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cancel</span>
            </button>
            <div className="h-10 w-[1px] bg-outline-variant/30 mx-2"></div>
            <button onClick={() => onNavigate('chat')} className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-all duration-300 shadow-md">
                <Send className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Send Now</span>
            </button>
          </div>
        </div>

        <div className="mt-16 w-full max-w-md px-4 z-10">
          <div className="bg-surface-container-low/80 backdrop-blur-xl p-6 rounded-xl shadow-sm border border-white/40">
            <div className="flex items-start gap-3">
              <span className="text-primary/60 text-lg">"</span>
              <p className="text-on-surface italic leading-relaxed">
                "How do I care for a fiddle leaf fig during the winter months when the air is dry..."
              </p>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}

function SettingsScreen({ profile, onNavigate }: { profile: UserProfile, onNavigate: (s: AppScreen) => void }) {
  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const profileRef = doc(db, 'users', profile.uid);
    try {
      await updateDoc(profileRef, {
        settings: { ...profile.settings, ...newSettings }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pb-24 bg-background"
    >
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-background/80 backdrop-blur-md border-b border-outline-variant/10">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('chat')} className="text-primary p-2 rounded-full hover:bg-primary/5">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-serif font-bold text-xl text-primary">Terra Chat</h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center overflow-hidden border-2 border-primary/20">
          <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt="Profile" className="w-full h-full object-cover" />
        </div>
      </header>

      <main className="pt-24 px-4 max-w-4xl mx-auto space-y-8">
        <section className="mb-6">
          <h2 className="text-3xl font-black text-on-surface leading-tight">Settings</h2>
          <p className="text-on-surface-variant mt-2 font-medium">Manage your rooted AI experience and preferences.</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-surface-container-low rounded-xl p-6 shadow-sm border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="text-primary w-6 h-6" />
              <h3 className="text-xl font-bold">Appearance</h3>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface">Dark Mode</p>
                  <p className="text-sm text-on-surface-variant">Switch to a darker earth-tone interface</p>
                </div>
                <button 
                  onClick={() => updateSettings({ darkMode: !profile.settings.darkMode })}
                  className={cn(
                    "w-12 h-6 rounded-full relative p-1 flex items-center transition-colors",
                    profile.settings.darkMode ? "bg-primary" : "bg-outline-variant/30"
                  )}
                >
                  <motion.div 
                    animate={{ x: profile.settings.darkMode ? 24 : 0 }}
                    className="w-4 h-4 bg-white rounded-full shadow-sm" 
                  />
                </button>
              </div>
              <div className="space-y-3">
                <p className="font-bold text-on-surface">Theme Accents</p>
                <div className="flex gap-3">
                  {['#4a7c59', '#705c30', '#6b6358', '#78a886'].map(color => (
                    <button 
                      key={color}
                      onClick={() => updateSettings({ themeAccent: color })}
                      style={{ backgroundColor: color }}
                      className={cn(
                        "w-10 h-10 rounded-full transition-all",
                        profile.settings.themeAccent === color && "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 bg-tertiary-container/20 rounded-xl p-6 flex flex-col justify-between border border-tertiary/10">
            <div className="flex justify-between items-start">
              <div className="w-16 h-16 rounded-2xl bg-white p-1 overflow-hidden shadow-sm">
                <img src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} alt="Profile" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className="bg-tertiary text-on-tertiary text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Pro Member</span>
            </div>
            <div className="mt-4">
              <h4 className="text-lg font-bold font-serif">{profile.displayName}</h4>
              <p className="text-sm text-on-tertiary-container mb-4">{profile.email}</p>
              <button className="w-full py-2 bg-tertiary text-on-tertiary rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">Edit Profile</button>
            </div>
          </div>

          <div className="md:col-span-12 bg-surface-container rounded-xl p-6 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <Mic2 className="text-primary w-6 h-6" />
              <h3 className="text-xl font-bold">Voice & Speech</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-bold text-on-surface-variant block mb-2 uppercase tracking-tighter">AI Language</span>
                  <select 
                    value={profile.settings.aiLanguage}
                    onChange={(e) => updateSettings({ aiLanguage: e.target.value })}
                    className="w-full bg-surface-container-lowest border-outline-variant/20 rounded-lg p-3 text-on-surface focus:ring-primary focus:border-primary"
                  >
                    <option>English (US) - Natural</option>
                    <option>Spanish (ES) - Cálido</option>
                    <option>French (FR) - Doux</option>
                    <option>German (DE) - Klar</option>
                  </select>
                </label>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-on-surface-variant uppercase tracking-tighter">Speech Speed</span>
                    <span className="text-xs font-bold text-primary">{profile.settings.speechSpeed}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1"
                    value={profile.settings.speechSpeed}
                    onChange={(e) => updateSettings({ speechSpeed: parseFloat(e.target.value) })}
                    className="w-full accent-primary h-2 bg-surface-container-highest rounded-lg appearance-none cursor-pointer" 
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                  <p className="text-sm italic text-on-surface-variant mb-3">"The morning dew clings to the emerald leaves of the forest floor."</p>
                  <button className="flex items-center gap-2 text-primary font-bold text-sm">
                    <PlayCircle className="w-5 h-5" />
                    Listen to sample
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-on-surface">Auto-play Responses</span>
                  <button 
                    onClick={() => updateSettings({ autoPlayResponses: !profile.settings.autoPlayResponses })}
                    className={cn(
                      "w-12 h-6 rounded-full relative p-1 flex items-center transition-colors",
                      profile.settings.autoPlayResponses ? "bg-primary" : "bg-outline-variant/30"
                    )}
                  >
                    <motion.div 
                      animate={{ x: profile.settings.autoPlayResponses ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="text-primary w-6 h-6" />
              <h3 className="text-xl font-bold">Notifications</h3>
            </div>
            <div className="space-y-4">
              {['Message Alerts', 'Daily Reminders', 'App Updates'].map((item, i) => (
                <div key={item} className="flex items-center justify-between p-3 bg-white/40 rounded-lg">
                  <div className="flex items-center gap-3">
                    {i === 0 && <MessageSquare className="w-5 h-5 text-on-surface-variant" />}
                    {i === 1 && <Brain className="w-5 h-5 text-on-surface-variant" />}
                    {i === 2 && <Leaf className="w-5 h-5 text-on-surface-variant" />}
                    <span className="font-medium">{item}</span>
                  </div>
                  <CheckCircle2 className={cn("w-5 h-5", i !== 1 ? "text-primary" : "text-outline-variant")} />
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-6 bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-primary w-6 h-6" />
              <h3 className="text-xl font-bold">Privacy</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-white/60 hover:bg-white/80 transition-colors rounded-xl text-left">
                <div className="flex items-center gap-3">
                  <History className="text-secondary w-5 h-5" />
                  <div>
                    <p className="font-bold text-sm">Chat History</p>
                    <p className="text-xs text-on-surface-variant">Store chats for 30 days</p>
                  </div>
                </div>
                <ChevronRight className="text-outline w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-white/60 hover:bg-white/80 transition-colors rounded-xl text-left">
                <div className="flex items-center gap-3">
                  <Lock className="text-secondary w-5 h-5" />
                  <div>
                    <p className="font-bold text-sm">Two-Factor Auth</p>
                    <p className="text-xs text-on-surface-variant">Secure your account</p>
                  </div>
                </div>
                <ChevronRight className="text-outline w-5 h-5" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-error/5 hover:bg-error/10 transition-colors rounded-xl text-left border border-error/10">
                <div className="flex items-center gap-3 text-error">
                  <Delete className="w-5 h-5" />
                  <p className="font-bold text-sm">Clear All Data</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center pt-8 pb-12">
          <p className="text-xs font-bold text-outline-variant uppercase tracking-[0.2em]">Terra Chat v1.0.0</p>
          <div className="mt-4 flex justify-center gap-6">
            <button className="text-sm font-bold text-primary hover:underline">Privacy Policy</button>
            <button className="text-sm font-bold text-primary hover:underline">Terms of Service</button>
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center h-16 bg-background/95 backdrop-blur-md border-t border-outline-variant/10">
        <button onClick={() => onNavigate('chat')} className="flex flex-col items-center text-outline">
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Chat</span>
        </button>
        <button className="flex flex-col items-center text-outline">
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">History</span>
        </button>
        <button onClick={() => onNavigate('settings')} className="flex flex-col items-center text-primary">
          <SettingsIcon className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Settings</span>
        </button>
      </nav>
    </motion.div>
  );
}
