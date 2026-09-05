import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, LogIn, LogOut, User as UserIcon, LayoutDashboard,
  ShieldCheck, Search, Sparkles, X, Menu, Phone, Mail,
  MapPin, Check, Heart, HelpCircle, ChevronRight, ChevronLeft, ChevronDown, RefreshCw,
  Award, Clock, Flame, PlaySquare, FileText, Upload, Play, ArrowRight, GraduationCap, TrendingUp, Video, Smartphone, Send, Star
} from 'lucide-react';

import { User, Batch } from './types';
import AppleHero from './components/AppleHero';
import BatchCard from './components/BatchCard';
import CoursePlayer from './components/CoursePlayer';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import PaymentModal from './components/PaymentModal';
import { supabase } from './lib/supabaseClient';

type AppView = 'home' | 'free-batches' | 'paid-batches' | 'student-dashboard' | 'admin-dashboard' | 'profile' | 'player';

export default function App() {
  // Navigation & View States
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ batches: Batch[]; subjects: any[]; lectures: any[] }>({ batches: [], subjects: [], lectures: [] });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Authentication States
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<'student' | 'admin'>('student');
  const [authError, setAuthError] = useState('');

  // Security & URL states
  const [isAdminPath, setIsAdminPath] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Forgot Password / Reset Password States
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

  // Data States
  const [batches, setBatches] = useState<Batch[]>([]);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [faculties, setFaculties] = useState<{ name: string; role: string; bio: string; imageUrl?: string }[]>([]);
  const [enrolledBatchIds, setEnrolledBatchIds] = useState<string[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchesError, setBatchesError] = useState('');
  const [showHero, setShowHero] = useState(true);
  const [showFaculty, setShowFaculty] = useState(true);
  const [showTestimonials, setShowTestimonials] = useState(true);
  const [showFaq, setShowFaq] = useState(true);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);

  // Checkout State
  const [activeCheckoutBatch, setActiveCheckoutBatch] = useState<Batch | null>(null);

  // Profile Form States
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);

  // Homepage interactive states
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [hoveredNavItem, setHoveredNavItem] = useState<string | null>(null);

  // Dynamic reviews state
  const [reviews, setReviews] = useState([
    { name: 'Rahul Sharma', city: 'Gwalior', role: 'Rank 14, MPPSC 2023', text: 'Carrier-50 completely transformed my Mains preparation. The answer evaluation tool is unmatched; got detailed feedback on my history answers in hours. The dynamic platform keeps you fully focused without any ads.', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150' },
    { name: 'Priya Singh', city: 'Indore', role: 'Selected as Deputy Collector', text: 'The Madhya Pradesh GK modules are extremely detailed and structured. Having previously studied at offline centers, I found Carrier-50\'s study sheets and daily MCQ tests far more effective. A truly premium EdTech product!', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150' },
    { name: 'Arjun Mehta', city: 'Bhopal', role: 'Prelims Qualified, Mains Aspirant', text: 'Best platform for MPPSC mock test series. The analytics tool identified my weak areas in MP Polity and helped me work on them. Thanks to Sarah Vance Ma\'am, constitutional acts are now easy to understand.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150' }
  ]);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewCity, setNewReviewCity] = useState('');
  const [newReviewRole, setNewReviewRole] = useState('');
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);

  const handleAddReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName || !newReviewText) return;

    const newReview = {
      name: newReviewName,
      city: newReviewCity || 'Madhya Pradesh',
      role: newReviewRole || 'MPPSC Aspirant',
      text: newReviewText,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150'
    };

    setReviews([newReview, ...reviews]);
    setTestimonialIndex(0);
    setShowAddReviewModal(false);

    setNewReviewName('');
    setNewReviewCity('');
    setNewReviewRole('');
    setNewReviewText('');
    setNewReviewRating(5);
  };

  // Observe URL Path/Hash to identify if accessing admin panel
  useEffect(() => {
    const handleLocationCheck = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const isAdm = path.endsWith('/admin') || path.endsWith('./admin') || hash.includes('admin');

      setIsAdminPath(isAdm);

      if (isAdm) {
        if (user && user.role === 'admin') {
          setCurrentView('admin-dashboard');
        } else {
          setCurrentView('home');
          setAuthMode('login');
        }
      }
    };

    handleLocationCheck();
    window.addEventListener('popstate', handleLocationCheck);
    return () => window.removeEventListener('popstate', handleLocationCheck);
  }, [user]);

  // -----------------------------------------------------------------
  // Initial Sync & Boot
  // -----------------------------------------------------------------
  useEffect(() => {
    // Check local storage for persistent session
    const storedUser = localStorage.getItem('aura_session_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setProfileName(parsed.name);
        setProfileAvatar(parsed.avatarUrl || '');
        loadEnrollments(parsed.id);
      } catch (err) {
        console.error('Error restoring session:', err);
      }
    }

    // Capture potential reset parameters from URL path & hash (Supabase Auth format)
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;

    if (path.startsWith('/reset-password') || path.includes('reset-password')) {
      setAuthMode('login');
      setShowReset(true);

      if (hash) {
        const params = new URLSearchParams(hash.substring(1)); // strip '#'
        const accessToken = params.get('access_token');
        const errorDesc = params.get('error_description');
        const errorCode = params.get('error_code');

        if (errorDesc) {
          let userFriendlyError = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
          if (errorCode === 'otp_expired') {
            userFriendlyError = "This password reset link has expired or was already used. Please request a new link.";
          }
          setResetError(userFriendlyError);
        } else if (accessToken) {
          setResetToken(accessToken);
          setResetEmail('');
        }
      }
    } else {
      // Capture fallback search query reset parameters
      const queryParams = new URLSearchParams(search);
      const tok = queryParams.get('token');
      const em = queryParams.get('email');
      if (tok && em) {
        setResetToken(tok);
        setResetEmail(em);
        setAuthMode('login');
        setShowReset(true);
      }
    }

    loadBatches();
    loadHomepage();
  }, []);

  // Sync enrollments whenever user changes (NOT on every view change)
  useEffect(() => {
    if (user) {
      loadEnrollments(user.id);
    } else {
      setEnrolledBatchIds([]);
    }
  }, [user]);

  // Load payment history when navigating to profile
  useEffect(() => {
    if (user && currentView === 'profile') {
      loadPaymentsHistory(user.id);
    }
  }, [user, currentView]);

  const loadBatches = async () => {
    try {
      setLoadingBatches(true);
      setBatchesError('');
      const res = await fetch('/api/batches');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        throw new Error('Could not load courses. Please try again.');
      }
      setBatches(data);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      setBatchesError('Could not load courses. Please try again.');
    } finally {
      setLoadingBatches(false);
    }
  };

  const loadHomepage = async () => {
    try {
      const res = await fetch('/api/homepage');
      const data = await res.json();
      if (data) {
        setHeroTitle(data.hero_title || '');
        setHeroSubtitle(data.hero_subtitle || '');
        if (data.testimonials && Array.isArray(data.testimonials)) {
          setReviews(data.testimonials);
        }
        if (data.faculties && Array.isArray(data.faculties)) {
          setFaculties(data.faculties);
        }
        if (data.faqs && Array.isArray(data.faqs)) {
          setFaqs(data.faqs);
        }
        setShowHero(data.show_hero !== false);
        setShowFaq(data.show_faq !== false);
        setShowTestimonials(data.show_testimonials !== false);
        setShowFaculty(data.show_faculty !== false);
      }
    } catch (err) {
      console.error('Failed to fetch homepage settings:', err);
    }
  };

  const loadEnrollments = async (userId: string) => {
    try {
      const storedToken = localStorage.getItem('aura_session_token');
      if (!storedToken) {
        handleLogout();
        return;
      }
      const res = await fetch(`/api/enrollments/${userId}`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnrolledBatchIds(data.map((e: any) => e.batchId));
      }
    } catch (err) {
      console.error('Failed to fetch student enrollments:', err);
    }
  };

  const loadPaymentsHistory = async (userId: string) => {
    try {
      const storedToken = localStorage.getItem('aura_session_token');
      const res = await fetch(`/api/payments/history/${userId}`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      const data = await res.json();
      setPaymentsHistory(data);
    } catch (err) {
      console.error('Failed to fetch payment ledger:', err);
    }
  };

  // -----------------------------------------------------------------
  // Global Search Engine
  // -----------------------------------------------------------------
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults({ batches: [], subjects: [], lectures: [] });
      setShowSearchDropdown(false);
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      const data = await res.json();
      setSearchResults(data);
      setShowSearchDropdown(true);
    } catch (err) {
      console.error('Global search fail:', err);
    }
  };

  // -----------------------------------------------------------------
  // Authentication Actions
  // -----------------------------------------------------------------
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (authMode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
          setUser(data.user);
          setProfileName(data.user.name);
          setProfileAvatar(data.user.avatarUrl || '');
          localStorage.setItem('aura_session_user', JSON.stringify(data.user));
          localStorage.setItem('aura_session_token', data.token);
          setAuthMode(null);
          resetAuthForm();
          // Route based on role
          if (data.user.role === 'admin') {
            setCurrentView('admin-dashboard');
          } else {
            setCurrentView('student-dashboard');
          }
        } else {
          setAuthError(data.error || 'Authentication failed.');
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: regName, role: regRole })
        });
        const data = await res.json();

        if (res.ok) {
          setUser(data.user);
          setProfileName(data.user.name);
          setProfileAvatar(data.user.avatarUrl || '');
          localStorage.setItem('aura_session_user', JSON.stringify(data.user));
          localStorage.setItem('aura_session_token', data.token);
          setAuthMode(null);
          resetAuthForm();
          setCurrentView('student-dashboard');
        } else {
          setAuthError(data.error || 'Registration failed.');
        }
      }
    } catch (err) {
      console.error('Auth request failed:', err);
      setAuthError('Connection error. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aura_session_user');
    localStorage.removeItem('aura_session_token');
    setUser(null);
    setCurrentView('home');
    resetAuthForm();
  };

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setRegName('');
    setAuthError('');
  };

  // Secure verification handler
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setVerificationError('');
    setVerificationSuccess('');
    setVerifying(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        const updatedUser = { ...user, isVerified: true };
        setUser(updatedUser);
        localStorage.setItem('aura_session_user', JSON.stringify(updatedUser));
        setVerificationSuccess('Your email has been successfully verified! Happy learning.');
        setVerificationCode('');
      } else {
        setVerificationError(data.error || 'Verification failed. Please check the code.');
      }
    } catch (err) {
      console.error('Verify email fail:', err);
      setVerificationError('Verification failed. Connection error.');
    } finally {
      setVerifying(false);
    }
  };

  // Forgot password triggers
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMsg('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setForgotMsg(data.message || 'Reset link sent successfully.');
        setForgotEmail('');
      } else {
        setForgotError(data.error || 'Request failed.');
      }
    } catch (err) {
      console.error('Forgot password fail:', err);
      setForgotError('Connection error.');
    }
  };

  // Reset password action
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMsg('');

    try {
      if (resetToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: resetToken,
          refresh_token: ''
        });
        if (sessionError) {
          setResetError(sessionError.message);
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: resetNewPassword });

      if (updateError) {
        setResetError(updateError.message);
      } else {
        setResetMsg('Your password has been successfully reset. Please log in with your new credentials.');
        setResetEmail('');
        setResetToken('');
        setResetNewPassword('');
        // Instantly transition to login
        setTimeout(() => {
          setShowReset(false);
          setAuthMode('login');
        }, 3000);
      }
    } catch (err) {
      console.error('Reset password fail:', err);
      setResetError('Connection error.');
    }
  };

  // Developer Quick reviewer access bypass
  const handleQuickBypass = (role: 'student' | 'admin') => {
    setEmail(role === 'admin' ? 'admin@carrier50.com' : 'student@carrier50.com');
    setPassword(role === 'admin' ? 'admin123' : 'student123');
    setAuthMode('login');
  };

  const handleEnrollFreeBatch = async (batchId: string) => {
    if (!user) {
      setAuthMode('login');
      return;
    }

    try {
      const token = localStorage.getItem('aura_session_token');
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          batchId
        })
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (res.ok) {
        await loadEnrollments(user.id);
        setActiveBatchId(batchId);
        setCurrentView('player');
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to enroll');
      }
    } catch (err) {
      console.error('Failed to enroll in free batch:', err);
    }
  };

  // -----------------------------------------------------------------
  // Profile Update Logic
  // -----------------------------------------------------------------
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileMsg('');

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: profileName,
          avatarUrl: profileAvatar
        })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('aura_session_user', JSON.stringify(data.user));
        setProfileMsg('Your profile modifications were saved successfully.');
      } else {
        setProfileMsg(data.error || 'Profile update failed.');
      }
    } catch (err) {
      console.error('Update profile fail:', err);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-[#6D5DF6]/20 selection:text-[#6D5DF6]">

      {/* -------------------------------------------------------------
          NAVIGATION BAR (APPLE GLASSMORPHISM NAV)
          ------------------------------------------------------------- */}
      <nav className="glass-nav fixed top-0 left-0 right-0 z-40 bg-white/72 backdrop-blur-md border-b border-black/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">

            {/* Logo / Brand */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('home')}>
              <img
                src="/logo.png"
                alt="Aura Academy Logo"
                className="w-8 h-8 object-contain rounded-full shadow-md"
              />
              <span className="font-sans font-extrabold text-sm text-[#1d1d1f] tracking-tight hover:text-[#6D5DF6] transition-colors">
                Carrier-50
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <div
              className="hidden lg:flex items-center gap-1.5 relative bg-gray-50/50 p-1 rounded-full border border-gray-100/50"
              onMouseLeave={() => setHoveredNavItem(null)}
            >
              {[
                { id: 'home', label: 'Home', action: () => setCurrentView('home') },
                { id: 'foundation', label: 'MPPSC Foundation', action: () => setCurrentView('paid-batches') },
                { id: 'free', label: 'Free Resources', action: () => setCurrentView('free-batches') },
                { id: 'current-affairs', label: 'Current Affairs', action: () => setCurrentView('free-batches') },
                {
                  id: 'about', label: 'About', action: () => {
                    const el = document.getElementById('faculty-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    else setCurrentView('home');
                  }
                },
                {
                  id: 'contact', label: 'Contact', action: () => {
                    const el = document.getElementById('footer-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    else setCurrentView('home');
                  }
                }
              ].map((item) => {
                const isActive = (item.id === 'home' && currentView === 'home') ||
                  (item.id === 'foundation' && currentView === 'paid-batches') ||
                  (item.id === 'free' && currentView === 'free-batches');
                const isHovered = hoveredNavItem === item.id;

                // Show slider if hovered or if active and no other button is hovered
                const showSlider = isHovered || (isActive && hoveredNavItem === null);

                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setHoveredNavItem(item.id)}
                    className={`relative px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-colors duration-300 z-10 cursor-pointer ${isActive || isHovered ? 'text-[#6D5DF6]' : 'text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    {item.label}
                    {showSlider && (
                      <motion.div
                        layoutId="nav-slider"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="absolute inset-0 bg-[#6D5DF6]/10 border border-[#6D5DF6]/15 rounded-full -z-10"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Global Search and Auth Actions */}
            <div className="hidden lg:flex items-center gap-4">
              {/* Search input bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  id="global-search-bar"
                  type="text"
                  placeholder="Search MPPSC prep..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => { if (searchQuery) setShowSearchDropdown(true); }}
                  className="bg-gray-50 hover:bg-gray-100 focus:bg-white text-xs font-semibold pl-9 pr-4 py-2 rounded-full outline-none w-48 transition-all border border-gray-100 focus:border-[#6D5DF6]/30"
                />

                {/* Dropdown results modal */}
                <AnimatePresence>
                  {showSearchDropdown && (
                    <div className="absolute top-11 right-0 w-80 bg-white border border-black/5 rounded-2xl shadow-xl p-4 space-y-3 z-50 text-xs">
                      <div className="flex items-center justify-between border-b pb-1">
                        <span className="font-bold text-gray-400">SEARCH RESULTS</span>
                        <button onClick={() => setShowSearchDropdown(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {searchResults.batches.length > 0 && (
                          <div className="space-y-1">
                            <p className="font-extrabold text-[#6D5DF6] text-[10px] tracking-wider uppercase">Course Batches</p>
                            {searchResults.batches.map(b => (
                              <button
                                key={b.id}
                                onClick={() => {
                                  setShowSearchDropdown(false);
                                  setSearchQuery('');
                                  setCurrentView(enrolledBatchIds.includes(b.id) ? 'student-dashboard' : (b.isFree ? 'free-batches' : 'paid-batches'));
                                }}
                                className="w-full text-left p-1.5 hover:bg-gray-50 rounded font-semibold text-gray-800 truncate"
                              >
                                {b.title}
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.lectures.length > 0 && (
                          <div className="space-y-1">
                            <p className="font-extrabold text-emerald-600 text-[10px] tracking-wider uppercase">Lectures</p>
                            {searchResults.lectures.map(l => (
                              <div
                                key={l.id}
                                className="p-1.5 border-b border-gray-50 text-gray-700"
                              >
                                <p className="font-bold line-clamp-1">{l.title}</p>
                                <p className="text-[9px] text-gray-400">Duration: {l.duration}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {searchResults.batches.length === 0 && searchResults.lectures.length === 0 && (
                          <p className="text-gray-400 text-center py-4 italic">No matching academic assets found.</p>
                        )}
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Session buttons */}
              {user ? (
                <div className="flex items-center gap-4 text-xs font-bold">
                  {user.role === 'admin' ? (
                    <button
                      id="nav-admin-dash-btn"
                      onClick={() => setCurrentView('admin-dashboard')}
                      className={`text-purple-600 flex items-center gap-1 hover:underline cursor-pointer ${currentView === 'admin-dashboard' ? 'underline' : ''}`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin Console
                    </button>
                  ) : (
                    <button
                      id="nav-stud-dash-btn"
                      onClick={() => setCurrentView('student-dashboard')}
                      className={`text-[#6D5DF6] flex items-center gap-1 hover:underline cursor-pointer ${currentView === 'student-dashboard' ? 'underline' : ''}`}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Dashboard
                    </button>
                  )}

                  <button
                    id="nav-profile-btn"
                    onClick={() => setCurrentView('profile')}
                    className="flex items-center gap-1.5 hover:text-[#6D5DF6] transition-colors cursor-pointer"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover border"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span className="max-w-[80px] truncate">{user.name}</span>
                  </button>

                  <button
                    id="nav-logout-btn"
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    id="nav-login-btn"
                    onClick={() => { resetAuthForm(); setAuthMode('login'); }}
                    className="text-xs font-bold text-[#1d1d1f] hover:text-[#6D5DF6] transition-colors cursor-pointer px-3 py-1.5"
                  >
                    Login
                  </button>
                  <button
                    id="nav-register-btn"
                    onClick={() => { resetAuthForm(); setAuthMode('register'); }}
                    className="apple-btn-primary text-[11px] px-4 py-1.5 cursor-pointer shadow-sm shadow-[#6D5DF6]/10"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Icon */}
            <div className="lg:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1 text-gray-600 focus:outline-none"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b border-gray-100 overflow-hidden text-xs font-semibold text-gray-700 flex flex-col divide-y divide-gray-50"
            >
              <button onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }} className="p-4 text-left">Home</button>
              <button onClick={() => { setCurrentView('paid-batches'); setMobileMenuOpen(false); }} className="p-4 text-left">MPPSC Foundation</button>
              <button onClick={() => { setCurrentView('free-batches'); setMobileMenuOpen(false); }} className="p-4 text-left">Free Resources</button>

              {user ? (
                <>
                  {user.role === 'admin' ? (
                    <button onClick={() => { setCurrentView('admin-dashboard'); setMobileMenuOpen(false); }} className="p-4 text-left text-purple-600 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Admin Console
                    </button>
                  ) : (
                    <button onClick={() => { setCurrentView('student-dashboard'); setMobileMenuOpen(false); }} className="p-4 text-left text-[#6D5DF6] flex items-center gap-1.5">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </button>
                  )}
                  <button onClick={() => { setCurrentView('profile'); setMobileMenuOpen(false); }} className="p-4 text-left flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4" /> Profile Details
                  </button>
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="p-4 text-left text-red-500 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </>
              ) : (
                <div className="p-4 flex gap-3">
                  <button onClick={() => { setAuthMode('login'); setMobileMenuOpen(false); }} className="w-1/2 py-2 border rounded-full text-center">Login</button>
                  <button onClick={() => { setAuthMode('register'); setMobileMenuOpen(false); }} className="w-1/2 py-2 bg-[#6D5DF6] text-white rounded-full text-center">Register</button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Workspace Frame container */}
      <main className="flex-grow pt-12">
        {batchesError && (
          <div role="alert" className="mx-auto max-w-7xl rounded-xl bg-red-50 p-4 text-red-700">
            {batchesError}
            <button onClick={loadBatches} disabled={loadingBatches} className="ml-3 font-semibold underline">
              Retry
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {user && !user.isVerified && user.role !== 'admin' ? (
              <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
                <div className="apple-card p-8 bg-white text-center space-y-6">
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                    ✉️
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Verify Your Email Address</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      A 6-digit verification code has been generated for your email <span className="font-semibold text-gray-700">{user.email}</span>. Please enter it below to unlock distraction-free learning batches.
                    </p>
                  </div>

                  {verificationSuccess && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold">
                      {verificationSuccess}
                    </div>
                  )}

                  {verificationError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
                      {verificationError}
                    </div>
                  )}

                  <form onSubmit={handleVerifyEmail} className="space-y-4">
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="e.g. 123456"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full text-center tracking-[0.5em] text-lg font-bold px-3 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                    />

                    <button
                      type="submit"
                      disabled={verifying}
                      className="w-full apple-btn-primary text-xs py-3 font-bold cursor-pointer"
                    >
                      {verifying ? 'Verifying...' : 'Verify & Unlock'}
                    </button>
                  </form>

                  <p className="text-[10px] text-gray-400">
                    Need help? Contact support@carrier50.com or try signing out.
                  </p>

                  <button
                    onClick={handleLogout}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <>

                {/* -------------------------------------------------------------
                VIEW: LANDING HOME PAGE
                ------------------------------------------------------------- */}
                {currentView === 'home' && (
                  <div className="space-y-24 bg-white pb-20">
                    {showHero && (
                      <AppleHero
                        onExploreFree={() => setCurrentView('free-batches')}
                        onExplorePaid={() => setCurrentView('paid-batches')}
                        isAuthenticated={!!user}
                        onGetStarted={() => {
                          if (user) {
                            setCurrentView(user.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
                          } else {
                            setAuthMode('login');
                          }
                        }}
                        heroTitle={heroTitle}
                        heroSubtitle={heroSubtitle}
                      />
                    )}

                    {/* Trusted By Brand Bar */}
                    <div className="max-w-7xl mx-auto px-6 py-6 border-y border-gray-100 bg-[#f8f7ff]/30">
                      <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                        Trusted by students from top institutions
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 md:gap-x-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        <span className="text-sm font-extrabold tracking-tight text-gray-900">UPSC ASPIRANTS</span>
                        <span className="text-sm font-extrabold tracking-tight text-gray-900">MPPSC TOPPERS</span>
                        <span className="text-sm font-extrabold tracking-tight text-gray-900">GOVT DEPARTMENTS</span>
                        <span className="text-sm font-extrabold tracking-tight text-gray-900">STATE UNIVERSITIES</span>
                      </div>
                    </div>

                    {/* Features Section */}
                    <div className="max-w-7xl mx-auto px-6">
                      <div className="text-center space-y-3 mb-16">
                        <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Powerful Features</span>
                        <h2 className="text-3xl font-extrabold text-[#1d1d1f] sm:text-4xl tracking-tight font-sans">
                          Everything You Need to Crack MPPSC
                        </h2>
                        <p className="text-sm text-[#86868b] max-w-lg mx-auto">
                          Our platform is designed to provide you with the best learning experience with advanced features.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[
                          { title: 'Live Classes', desc: 'Interactive daily live lectures with real-time chat.', icon: <Play className="w-5 h-5" /> },
                          { title: 'Recorded Lectures', desc: 'Access study archives anytime with offline mode.', icon: <PlaySquare className="w-5 h-5" /> },
                          { title: 'Study Notes', desc: 'Handwritten chapter notes and syllabus booklets.', icon: <FileText className="w-5 h-5" /> },
                          { title: 'Current Affairs', desc: 'Daily MP and national current affairs analysis.', icon: <Sparkles className="w-5 h-5" /> },
                          { title: 'Performance Analytics', desc: 'Identify strengths and weaknesses with AI.', icon: <TrendingUp className="w-5 h-5" /> },
                          { title: 'Mentorship', desc: '1-on-1 calls with toppers and retired officers.', icon: <UserIcon className="w-5 h-5" /> },
                          { title: 'Doubt Solving', desc: 'Instant support for complex preparation queries.', icon: <HelpCircle className="w-5 h-5" /> }
                        ].map((feat, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ scale: 1.03, translateY: -4 }}
                            className="apple-card p-6 bg-white border border-gray-100 flex flex-col items-start text-left cursor-default group"
                          >
                            <div className="p-3 bg-[#6D5DF6]/10 text-[#6D5DF6] rounded-2xl mb-4 group-hover:bg-[#6D5DF6] group-hover:text-white transition-all duration-300">
                              {feat.icon}
                            </div>
                            <h4 className="font-extrabold text-[#1d1d1f] text-sm tracking-tight">{feat.title}</h4>
                            <p className="text-xs text-[#86868b] mt-2 leading-relaxed">{feat.desc}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Popular Courses Section */}
                    <div id="landing-courses" className="max-w-7xl mx-auto px-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
                        <div className="text-left space-y-3">
                          <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Popular Courses</span>
                          <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans sm:text-4xl">Top Courses for You</h2>
                        </div>
                        <button
                          onClick={() => setCurrentView('paid-batches')}
                          className="text-xs font-extrabold text-[#6D5DF6] hover:text-[#7C4DFF] flex items-center gap-1 group cursor-pointer uppercase tracking-wider"
                        >
                          View All Courses
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>

                      {loadingBatches ? (
                        <div className="text-center py-12 text-gray-500">Loading course batches...</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          {batches.filter(b => !b.isFree).slice(0, 3).map((batch) => (
                            <BatchCard
                              key={batch.id}
                              batch={batch}
                              isEnrolled={enrolledBatchIds.includes(batch.id)}
                              onEnrollFree={handleEnrollFreeBatch}
                              onPurchaseClick={(b) => {
                                if (!user) {
                                  setAuthMode('login');
                                } else {
                                  setActiveCheckoutBatch(b);
                                }
                              }}
                              onViewLectures={(bId) => {
                                setActiveBatchId(bId);
                                setCurrentView('player');
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Learning Process Section */}
                    <div className="max-w-7xl mx-auto px-6">
                      <div className="text-center space-y-3 mb-16">
                        <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Roadmap</span>
                        <h2 className="text-3xl font-extrabold text-[#1d1d1f] sm:text-4xl tracking-tight font-sans">
                          Our Learning Process
                        </h2>
                        <p className="text-sm text-[#86868b] max-w-lg mx-auto">
                          Follow our structured preparation pipeline to maximize your chances of cracking the civil services exams.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-6 gap-6 relative">
                        {[
                          { step: '01', title: 'Enroll', desc: 'Register & pick your target batch.' },
                          { step: '02', title: 'Watch Lectures', desc: 'Attend daily interactive live classes.' },
                          { step: '03', title: 'Practice MCQs', desc: 'Solve daily quizzes for Prelims.' },
                          { step: '04', title: 'Attempt Mock Tests', desc: 'Write full-length simulated papers.' },
                          { step: '05', title: 'Track Performance', desc: 'Review analytics and expert feedback.' },
                          { step: '06', title: 'Crack MPPSC', desc: 'Ace Prelims, Mains & Mock Panels!' }
                        ].map((step, idx) => (
                          <div key={idx} className="flex flex-col items-center text-center p-4 relative">
                            <div className="w-12 h-12 rounded-full bg-[#6D5DF6]/10 text-[#6D5DF6] flex items-center justify-center font-extrabold text-sm mb-4 border border-[#6D5DF6]/20">
                              {step.step}
                            </div>
                            <h4 className="font-extrabold text-gray-900 text-sm tracking-tight">{step.title}</h4>
                            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{step.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>



                    {showFaculty && (
                      <div id="faculty-section" className="max-w-7xl mx-auto px-6 space-y-12">
                        <div className="text-center space-y-3">
                          <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">World Class Mentors</span>
                          <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans">Our Elite Faculty</h2>
                          <p className="text-sm text-[#86868b] max-w-lg mx-auto">
                            Learn MP General Studies, History, and Polity from Madhya Pradesh's leading civil services mentors.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                          {(faculties.length > 0 ? faculties : [
                            {
                              name: "Mr. Prathvish Singh",
                              role: "MP History & General Studies Lead",
                              bio: "Ph.D. from IIT Kanpur with 15+ years of experience training top rankers for the MPPSC Prelims & Mains.",
                              imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
                            },
                            {
                              name: "Prof. Sarah Vance",
                              role: "Polity & State Governance Head",
                              bio: "Oxford graduate with extensive research on public administration and central-state assembly architectures.",
                              imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
                            },
                            {
                              name: "Hitesh Choudhary",
                              role: "Current Affairs & Economy Lead",
                              bio: "Mentored over 50,000 civil service aspirants with high-quality daily GK and MP State budget analysis tutorials.",
                              imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200"
                            }
                          ]).map((f, idx) => (
                            <div key={idx} className="apple-card p-8 bg-white text-center flex flex-col items-center border border-gray-100">
                              <img
                                src={f.imageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"}
                                alt={f.name}
                                className="w-24 h-24 rounded-full object-cover mb-4 border-2 border-gray-100 shadow"
                                referrerPolicy="no-referrer"
                              />
                              <h4 className="text-lg font-extrabold text-gray-900">{f.name}</h4>
                              <p className="text-xs text-[#6D5DF6] font-bold mt-1 uppercase tracking-wider">{f.role}</p>
                              <p className="text-xs text-[#86868b] mt-3 leading-relaxed">{f.bio}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showTestimonials && (
                      <div className="bg-[#f8f7ff]/40 py-20 border-y border-gray-100">
                        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative">
                          <div className="space-y-3 flex flex-col items-center">
                            <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Student Stories</span>
                            <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans">
                              What Our Students Say
                            </h2>
                            <button
                              onClick={() => setShowAddReviewModal(true)}
                              className="mt-2 inline-flex items-center gap-1.5 bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white text-[10px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all cursor-pointer shadow-md hover:shadow-[#6D5DF6]/20 active:scale-95"
                            >
                              Add a Review
                            </button>
                          </div>

                          <div className="relative min-h-[180px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                              {(() => {
                                const r = reviews[testimonialIndex] || reviews[0];
                                if (!r) return null;
                                return (
                                  <motion.div
                                    key={testimonialIndex}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                  >
                                    <div className="flex justify-center text-amber-500 gap-1">
                                      {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                                    </div>
                                    <blockquote className="text-xl font-medium text-gray-700 italic leading-relaxed">
                                      &ldquo;{r.text}&rdquo;
                                    </blockquote>
                                    <div className="flex items-center justify-center gap-3">
                                      <img src={r.avatar} alt={r.name} className="w-12 h-12 rounded-full object-cover border" referrerPolicy="no-referrer" />
                                      <div className="text-left">
                                        <p className="font-extrabold text-gray-900 text-sm">{r.name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{r.role} • {r.city}</p>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })()}
                            </AnimatePresence>
                          </div>

                          <div className="flex justify-center gap-4 pt-4">
                            <button
                              onClick={() => setTestimonialIndex((prev) => (prev === 0 ? 2 : prev - 1))}
                              className="p-2 border border-gray-200 hover:bg-[#6D5DF6]/5 text-gray-600 hover:text-[#6D5DF6] rounded-full transition-all cursor-pointer"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setTestimonialIndex((prev) => (prev === 2 ? 0 : prev + 1))}
                              className="p-2 border border-gray-200 hover:bg-[#6D5DF6]/5 text-gray-600 hover:text-[#6D5DF6] rounded-full transition-all cursor-pointer"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="max-w-7xl mx-auto px-6">
                      <div className="text-center space-y-3 mb-16">
                        <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Free Resources</span>
                        <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans">
                          Start Learning for Free
                        </h2>
                        <p className="text-sm text-[#86868b] max-w-lg mx-auto">
                          Access our library of previous year booklets, current affairs newsletters, and daily quizzes.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                          { title: 'Current Affairs PDFs', size: '12.4 MB', icon: <FileText className="w-5 h-5 text-purple-500" /> },
                          { title: 'Previous Year Papers', size: '8.1 MB', icon: <BookOpen className="w-5 h-5 text-[#6D5DF6]" /> },
                          { title: 'Syllabus & Notes Notes', size: '15.2 MB', icon: <Award className="w-5 h-5 text-emerald-500" /> },
                          { title: 'Practice Question Sets', size: '6.4 MB', icon: <Check className="w-5 h-5 text-amber-500" /> },
                          { title: 'Daily MCQ Quizzes', size: 'Interactive', icon: <Sparkles className="w-5 h-5 text-pink-500" /> },
                          { title: 'Carrier-50 Prep Blog', size: 'Weekly articles', icon: <PlaySquare className="w-5 h-5 text-indigo-500" /> }
                        ].map((res, idx) => (
                          <div key={idx} className="apple-card p-6 bg-white border border-gray-100 flex items-center justify-between group cursor-pointer hover:border-[#6D5DF6]/20">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-[#6D5DF6]/5 transition-colors duration-300">
                                {res.icon}
                              </div>
                              <div className="text-left">
                                <h4 className="font-extrabold text-gray-900 text-sm group-hover:text-[#6D5DF6] transition-colors">{res.title}</h4>
                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">{res.size}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#6D5DF6] group-hover:translate-x-1 transition-all" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {showFaq && (
                      <div className="max-w-4xl mx-auto px-6 space-y-12">
                        <div className="text-center space-y-3">
                          <span className="text-xs font-extrabold uppercase text-[#6D5DF6] tracking-widest">Questions</span>
                          <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans text-center">
                            Frequently Asked Questions
                          </h2>
                          <p className="text-sm text-[#86868b] max-w-lg mx-auto text-center">
                            Quick answers to common questions about batches, enrollments, and preparation.
                          </p>
                        </div>

                        <div className="space-y-4">
                          {(faqs.length > 0 ? faqs : [
                            {
                              question: "What is C50 Academy?",
                              answer: "C50 is a premium learning platform specifically designed for MPPSC civil service aspirants with structured study plans, notes, and interactive lectures."
                            },
                            {
                              question: "How do I access free batches?",
                              answer: "You can enroll in free courses directly from the Home tab. Simply sign up for an account to start studying immediately."
                            },
                            {
                              question: "Are PDF notes downloadable?",
                              answer: "Yes, study notes uploaded by instructors can be viewed and downloaded directly within each subject tab."
                            }
                          ]).map((faq, idx) => {
                            const isOpen = openFaqIndex === idx;
                            return (
                              <div
                                key={idx}
                                className="bg-white border border-gray-100 rounded-3xl overflow-hidden transition-all duration-300 hover:border-[#6D5DF6]/15 shadow-sm"
                              >
                                <button
                                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer hover:bg-gray-50/50 transition-colors"
                                >
                                  <span className="font-bold text-gray-900 text-sm md:text-base pr-4">
                                    {faq.question}
                                  </span>
                                  <span className={`p-1.5 rounded-full bg-gray-50 text-gray-600 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-[#6D5DF6]/5 text-[#6D5DF6]' : ''}`}>
                                    <ChevronDown className="w-4 h-4" />
                                  </span>
                                </button>

                                <div
                                  className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 border-t border-gray-50' : 'max-h-0 opacity-0 pointer-events-none'}`}
                                >
                                  <div className="p-6 text-xs md:text-sm text-gray-500 leading-relaxed bg-[#f8f7ff]/10">
                                    {faq.answer}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="max-w-7xl mx-auto px-6">
                      <div className="apple-card p-10 bg-gradient-to-br from-zinc-900 to-black text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                          <Smartphone className="w-64 h-64 text-white" />
                        </div>

                        <div className="text-left space-y-4 max-w-xl relative z-10">
                          <span className="text-[9px] uppercase font-extrabold tracking-widest bg-white/15 px-3 py-1 rounded-full text-white">
                            Mobile App
                          </span>
                          <h3 className="text-3xl font-extrabold sm:text-4xl tracking-tight leading-none">
                            Study Anytime. Anywhere.
                          </h3>
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Download the Carrier-50 app to attend live sessions, save notes offline, write mock tests, and get real-time MPPSC updates on the go.
                          </p>

                          <div className="flex flex-wrap gap-4 pt-2">
                            <button className="bg-white text-black font-extrabold text-xs px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2 cursor-pointer shadow-md">
                              <Play className="w-4 h-4 fill-black" /> Google Play
                            </button>
                            <button className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer">
                              App Store (Coming Soon)
                            </button>
                          </div>
                        </div>

                        <div className="w-full max-w-[280px] shrink-0 relative z-10 bg-zinc-800 p-3 rounded-[32px] border border-zinc-700 shadow-2xl">
                          <div className="aspect-[9/19] bg-zinc-950 rounded-[24px] overflow-hidden flex flex-col items-center justify-center p-6 border border-zinc-800">
                            <div className="w-10 h-10 bg-[#6D5DF6] rounded-full flex items-center justify-center font-extrabold text-sm text-white mb-3">C</div>
                            <p className="text-xs font-bold text-white tracking-tight">Carrier-50</p>
                            <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold tracking-widest">Active learning</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-6">
                      <div className="apple-card p-10 bg-[#f8f7ff]/70 border border-gray-100 text-center space-y-6 max-w-3xl mx-auto">
                        <div className="p-3 bg-[#6D5DF6]/10 text-[#6D5DF6] rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                          <Send className="w-5 h-5" />
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight font-sans">
                            Stay Updated with MPPSC Notifications
                          </h3>
                          <p className="text-xs text-[#86868b] max-w-md mx-auto leading-relaxed">
                            Subscribe to our weekly current affairs updates and state service notifications. No spam, unsubscribe anytime.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <input
                              type="email"
                              placeholder="yourname@domain.com"
                              className="flex-grow px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-xs font-semibold focus:border-[#6D5DF6]/30 shadow-sm"
                            />
                            <button className="apple-btn-primary py-2.5 px-6 text-xs font-bold shrink-0">
                              Subscribe
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* -------------------------------------------------------------
                VIEW: FREE BATCHES CATALOG
                ------------------------------------------------------------- */}
                {currentView === 'free-batches' && (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
                    <div>
                      <span className="text-xs font-extrabold uppercase text-emerald-600 tracking-widest">Self Enrollment Classroom</span>
                      <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans mt-0.5">Free Batch Resources</h2>
                      <p className="text-sm text-[#86868b] mt-1">
                        Instant access to complete courses for self-directed online learners. Just register and click Enroll.
                      </p>
                    </div>

                    {loadingBatches ? (
                      <p className="text-gray-500">Loading course syllabus...</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {batches.filter(b => b.isFree).map((batch) => (
                          <BatchCard
                            key={batch.id}
                            batch={batch}
                            isEnrolled={enrolledBatchIds.includes(batch.id)}
                            onEnrollFree={handleEnrollFreeBatch}
                            onPurchaseClick={() => { }}
                            onViewLectures={(bId) => {
                              setActiveBatchId(bId);
                              setCurrentView('player');
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}


                {/* -------------------------------------------------------------
                VIEW: PAID BATCHES CATALOG
                ------------------------------------------------------------- */}
                {currentView === 'paid-batches' && (
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
                    <div>
                      <span className="text-xs font-extrabold uppercase text-[#0071e3] tracking-widest">Premium Interactive Courses</span>
                      <h2 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans mt-0.5">Premium Batches</h2>
                      <p className="text-sm text-[#86868b] mt-1">
                        Exhaustive, highly intensive test-prep courses featuring handwritten review notes, doubt sessions, and homework sheets.
                      </p>
                    </div>

                    {loadingBatches ? (
                      <p className="text-gray-500">Loading premium classrooms...</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {batches.filter(b => !b.isFree).map((batch) => (
                          <BatchCard
                            key={batch.id}
                            batch={batch}
                            isEnrolled={enrolledBatchIds.includes(batch.id)}
                            onEnrollFree={() => { }}
                            onPurchaseClick={(b) => {
                              if (!user) {
                                setAuthMode('login');
                              } else {
                                setActiveCheckoutBatch(b);
                              }
                            }}
                            onViewLectures={(bId) => {
                              setActiveBatchId(bId);
                              setCurrentView('player');
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}


                {/* -------------------------------------------------------------
                VIEW: STUDENT PERSONAL DASHBOARD
                ------------------------------------------------------------- */}
                {currentView === 'student-dashboard' && user && (
                  <StudentDashboard
                    userId={user.id}
                    userName={user.name}
                    batches={batches}
                    enrolledBatchIds={enrolledBatchIds}
                    onViewLectures={(bId) => {
                      setActiveBatchId(bId);
                      setCurrentView('player');
                    }}
                  />
                )}


                {/* -------------------------------------------------------------
                VIEW: ADMIN CMS DASHBOARD
                ------------------------------------------------------------- */}
                {currentView === 'admin-dashboard' && user && user.role === 'admin' && (
                  <AdminDashboard
                    batches={batches}
                    onRefreshBatches={loadBatches}
                    userId={user.id}
                  />
                )}


                {/* -------------------------------------------------------------
                VIEW: CINEMA COURSE LECTURES PLAYER
                ------------------------------------------------------------- */}
                {currentView === 'player' && activeBatchId && (
                  <CoursePlayer
                    batchId={activeBatchId}
                    batchTitle={batches.find(b => b.id === activeBatchId)?.title || 'LMS Lecture Player'}
                    userId={user?.id || 'usr_anonymous'}
                    onBack={() => {
                      if (user) {
                        setCurrentView(user.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
                      } else {
                        setCurrentView('home');
                      }
                    }}
                  />
                )}


                {/* -------------------------------------------------------------
                VIEW: USER PROFILE SETTINGS
                ------------------------------------------------------------- */}
                {currentView === 'profile' && user && (
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">
                    <div>
                      <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight font-sans">Account Settings</h2>
                      <p className="text-sm text-gray-500 mt-1">Edit your personal public profile, link avatars, and audit purchases.</p>
                    </div>

                    {profileMsg && (
                      <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border text-xs font-semibold">
                        {profileMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Left panel: Avatar edit */}
                      <div className="md:col-span-1 apple-card p-6 bg-white text-center flex flex-col items-center">
                        <img
                          src={profileAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format'}
                          alt=""
                          className="w-24 h-24 rounded-full object-cover border-2 border-gray-100 shadow"
                          referrerPolicy="no-referrer"
                        />
                        <h4 className="font-bold text-gray-900 mt-3">{user.name}</h4>
                        <p className="text-[10px] uppercase font-extrabold text-gray-400 mt-1">{user.role}</p>

                        <div className="w-full mt-4 space-y-1 text-left text-xs">
                          <label className="font-bold text-gray-500">Avatar Image Link</label>
                          <input
                            type="text"
                            value={profileAvatar}
                            onChange={(e) => setProfileAvatar(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="w-full p-2 border rounded-lg text-[10px]"
                          />
                        </div>
                      </div>

                      {/* Right panel: Details form */}
                      <div className="md:col-span-2 apple-card p-6 bg-white space-y-6">
                        <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                          <div className="space-y-1.5">
                            <label className="font-bold text-gray-600">Registered Email (Read Only)</label>
                            <input
                              type="email"
                              disabled
                              value={user.email}
                              className="w-full px-3.5 py-2 border bg-gray-50 text-gray-400 rounded-xl outline-none"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="font-bold text-gray-600">Full Name</label>
                            <input
                              type="text"
                              required
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                            />
                          </div>

                          <button
                            type="submit"
                            className="apple-btn-primary text-xs px-5 py-2 cursor-pointer"
                          >
                            Save Settings
                          </button>
                        </form>

                        {/* Order / Purchase History inside Profile tab */}
                        <div className="pt-6 border-t border-gray-100 space-y-3">
                          <h4 className="text-sm font-bold text-gray-900">Your Purchase History Ledger</h4>
                          {paymentsHistory.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No purchase records registered for this account.</p>
                          ) : (
                            <div className="space-y-2 text-xs">
                              {paymentsHistory.map((p) => (
                                <div key={p.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between border">
                                  <div>
                                    <p className="font-bold text-gray-800">
                                      {batches.find(b => b.id === p.batchId)?.title || p.batchId}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Order: {p.razorpayOrderId}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-extrabold text-gray-900">₹{p.amount}</p>
                                    <span className="text-[9px] font-bold text-emerald-600">SUCCESS</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* -------------------------------------------------------------
          SECURE PAYMENTS OVERLAY DIALOG (RAZORPAY GATEWAY SIMULATOR)
          ------------------------------------------------------------- */}
      {activeCheckoutBatch && user && (
        <PaymentModal
          batch={activeCheckoutBatch}
          userId={user.id}
          onClose={() => setActiveCheckoutBatch(null)}
          onPaymentSuccess={() => {
            loadEnrollments(user.id);
            setActiveBatchId(activeCheckoutBatch.id);
            setCurrentView('player');
            setActiveCheckoutBatch(null);
          }}
        />
      )}

      {/* -------------------------------------------------------------
          AUTHENTICATION DIALOG MODAL OVERLAY (LOGIN / SIGN UP)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {authMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 flex flex-col"
            >
              {/* Modal close */}
              <button
                onClick={() => { setAuthMode(null); setShowForgot(false); }}
                className="absolute top-5 right-5 p-2 hover:bg-gray-100 rounded-full transition-all outline-none cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>

              {/* FORGOT PASSWORD VIEW */}
              {showForgot ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2 mb-6">
                    <div className="w-8 h-8 bg-[#6D5DF6] text-white rounded-full flex items-center justify-center font-bold text-xs mx-auto">
                      A
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight font-sans">
                      Reset Password
                    </h3>
                    <p className="text-xs text-gray-400">Enter your registered email below</p>
                  </div>

                  {forgotMsg && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold">
                      {forgotMsg}
                    </div>
                  )}

                  {forgotError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
                      {forgotError}
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-4 text-xs font-medium">
                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-600">Email Address</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full apple-btn-primary text-xs py-3 mt-4 font-bold shadow-lg shadow-[#6D5DF6]/10 cursor-pointer"
                    >
                      Send Password Reset Link
                    </button>
                  </form>

                  <div className="mt-5 text-center text-xs">
                    <button
                      onClick={() => setShowForgot(false)}
                      className="text-[#6D5DF6] font-bold hover:underline cursor-pointer"
                    >
                      &larr; Back to Login
                    </button>
                  </div>
                </div>
              ) : showReset ? (
                /* RESET PASSWORD VIEW (WITH TOKEN) */
                <div className="space-y-4">
                  <div className="text-center space-y-2 mb-6">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-xs mx-auto">
                      A
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight font-sans">
                      New Password Setup
                    </h3>
                    <p className="text-xs text-gray-400">Complete password modification securely</p>
                  </div>

                  {resetMsg && (
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-semibold">
                      {resetMsg}
                    </div>
                  )}

                  {resetError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
                      {resetError}
                    </div>
                  )}

                  <form onSubmit={handleResetPassword} className="space-y-4 text-xs font-medium">
                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-600">Email Address</label>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-600">Verification Token</label>
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Enter token"
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-600">New Secure Password</label>
                      <input
                        type="password"
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full apple-btn-primary text-xs py-3 mt-4 font-bold shadow-lg shadow-[#6D5DF6]/10 cursor-pointer"
                    >
                      Update Password Securely
                    </button>
                  </form>

                  <div className="mt-5 text-center text-xs">
                    <button
                      onClick={() => setShowReset(false)}
                      className="text-[#6D5DF6] font-bold hover:underline cursor-pointer"
                    >
                      Cancel Reset
                    </button>
                  </div>
                </div>
              ) : (
                /* MAIN LOGIN / REGISTER VIEW */
                <>
                  {/* Header Title */}
                  <div className="text-center space-y-2 mb-6">
                    <div className={`w-8 h-8 ${isAdminPath ? 'bg-purple-600' : 'bg-[#6D5DF6]'} text-white rounded-full flex items-center justify-center font-bold text-xs mx-auto`}>
                      C
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight font-sans">
                      {isAdminPath ? (
                        'Carrier-50 Admin Panel'
                      ) : (
                        authMode === 'login' ? 'Login to Carrier-50' : 'Create Student Account'
                      )}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {isAdminPath ? 'Authorized administrative login only' : 'Distraction-free learning awaits you'}
                    </p>
                  </div>

                  {/* Bypass helpers inside Auth block (Conditional based on URL path) */}
                  <div className={`p-3 border rounded-2xl mb-6 text-[10px] space-y-1.5 text-gray-600 ${isAdminPath ? 'bg-purple-50/50 border-purple-100' : 'bg-[#6D5DF6]/5 border-[#6D5DF6]/10'}`}>
                    <p className="font-bold text-gray-500 uppercase tracking-wider text-[9px]">
                      {isAdminPath ? 'Carrier-50 Secure Admin Access' : 'Reviewer Quick Access'}
                    </p>
                    <div className="flex gap-2">
                      {isAdminPath ? (
                        <button
                          id="bypass-login-admin-btn"
                          onClick={() => handleQuickBypass('admin')}
                          className="w-full bg-white hover:bg-gray-100 text-purple-600 py-1.5 border rounded-lg font-bold transition-all cursor-pointer text-[10px]"
                        >
                          Login as Admin (admin@carrier50.com)
                        </button>
                      ) : (
                        <button
                          id="bypass-login-student-btn"
                          onClick={() => handleQuickBypass('student')}
                          className="w-full bg-white hover:bg-gray-100 text-[#6D5DF6] py-1.5 border rounded-lg font-bold transition-all cursor-pointer text-[10px]"
                        >
                          Login as Student (student@carrier50.com)
                        </button>
                      )}
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl mb-4 text-xs font-semibold">
                      {authError}
                    </div>
                  )}

                  {/* Main Auth Form */}
                  <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs font-medium">
                    {authMode === 'register' && !isAdminPath && (
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Full Name</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="e.g. Arjun Kumar"
                          className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="font-bold text-gray-600">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={isAdminPath ? "admin@carrier50.com" : "student@carrier50.com"}
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-gray-600">Password</label>
                        {authMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => { setForgotError(''); setForgotMsg(''); setShowForgot(true); }}
                            className="text-[10px] text-[#6D5DF6] hover:underline font-bold"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 border rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full apple-btn-primary text-xs py-3 mt-4 font-bold shadow-lg shadow-[#6D5DF6]/10 cursor-pointer"
                    >
                      {authMode === 'login' ? 'Login' : 'Sign Up'}
                    </button>
                  </form>

                  {/* Toggles (Only display toggle options for student interface; admin is login-only) */}
                  {!isAdminPath && (
                    <div className="mt-5 text-center text-xs">
                      {authMode === 'login' ? (
                        <p className="text-gray-400">
                          New to Carrier-50?{' '}
                          <button onClick={() => { resetAuthForm(); setAuthMode('register'); }} className="text-[#6D5DF6] font-bold hover:underline cursor-pointer">
                            Register Now
                          </button>
                        </p>
                      ) : (
                        <p className="text-gray-400">
                          Already registered?{' '}
                          <button onClick={() => { resetAuthForm(); setAuthMode('login'); }} className="text-[#6D5DF6] font-bold hover:underline cursor-pointer">
                            Login
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Review Modal */}
      <AnimatePresence>
        {showAddReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddReviewModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-black/5 rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 space-y-6 text-left"
            >
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight font-sans">Share Your Experience</h3>
                <button
                  onClick={() => setShowAddReviewModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddReviewSubmit} className="space-y-4 text-xs font-semibold text-gray-700">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newReviewName}
                    onChange={(e) => setNewReviewName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 border border-gray-100 rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-600">City</label>
                    <input
                      type="text"
                      required
                      value={newReviewCity}
                      onChange={(e) => setNewReviewCity(e.target.value)}
                      placeholder="e.g. Indore"
                      className="w-full px-3.5 py-2.5 border border-gray-100 rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-600">Role / Achievement</label>
                    <input
                      type="text"
                      required
                      value={newReviewRole}
                      onChange={(e) => setNewReviewRole(e.target.value)}
                      placeholder="e.g. Mains Aspirant"
                      className="w-full px-3.5 py-2.5 border border-gray-100 rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Review Rating</label>
                  <div className="flex gap-1.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewReviewRating(star)}
                        className="cursor-pointer text-amber-400 hover:scale-110 transition-transform"
                      >
                        <Star className={`w-6 h-6 ${star <= newReviewRating ? 'fill-current' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Your Review</label>
                  <textarea
                    rows={4}
                    required
                    value={newReviewText}
                    onChange={(e) => setNewReviewText(e.target.value)}
                    placeholder="Tell other aspirants how Carrier-50 helped you in your MPPSC preparation..."
                    className="w-full px-3.5 py-2.5 border border-gray-100 rounded-xl outline-none focus:ring-1 focus:ring-[#6D5DF6] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#6D5DF6] hover:bg-[#5b4ee4] text-white py-3 rounded-xl font-bold tracking-wider uppercase transition-colors shadow-lg cursor-pointer"
                >
                  Submit Review
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          FOOTER COMPONENT (CARRIER-50 4-COLUMN FOOTER)
          ------------------------------------------------------------- */}
      <footer id="footer-section" className="bg-white border-t border-black/5 mt-20 text-xs text-[#86868b] leading-relaxed">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b">

            {/* Brand Column */}
            <div className="md:col-span-8 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Carrier-50 Logo"
                  className="w-8 h-8 object-contain rounded-full"
                />
                <span className="font-sans font-extrabold text-sm text-[#1d1d1f]">Carrier-50</span>
              </div>
              <p className="max-w-xs text-xs text-gray-400">
                Indore's premier SaaS-style LMS dedicated exclusively to MPPSC civil services preparation. Learn from the best educators in Madhya Pradesh.
              </p>
            </div>

            {/* Support Column */}
            <div className="md:col-span-4 space-y-3 text-left">
              <h5 className="font-bold text-[#1d1d1f] uppercase tracking-wider text-[10px]">Support</h5>
              <div className="flex flex-col gap-2 text-xs">
                <a href="mailto:support@carrier50.com" className="hover:text-[#6D5DF6] flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> typical232@gmail.com</a>
                <a href="tel:+919876543210" className="hover:text-[#6D5DF6] flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +91 8109794298</a>
                <span className="flex items-start gap-1 text-[11px] text-gray-400 mt-1"><MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" /> Gwalior, MP, India</span>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-semibold">
            <p>Copyright &copy; 2026 Carrier-50 Inc. All rights reserved.</p>
            <div className="flex gap-4">
              <span className="hover:underline cursor-pointer">Privacy Policy</span>
              <span>•</span>
              <span className="hover:underline cursor-pointer">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
