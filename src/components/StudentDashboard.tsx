import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, Play, Flame, Award, Clock, BookOpen, 
  ChevronRight, Calendar, AlertCircle, RefreshCw, Bell, Sparkles
} from 'lucide-react';
import { Batch, Announcement, DashboardStats } from '../types';

interface StudentDashboardProps {
  userId: string;
  userName: string;
  onViewLectures: (batchId: string) => void;
  batches: Batch[];
  enrolledBatchIds: string[];
}

export default function StudentDashboard({ userId, userName, onViewLectures, batches, enrolledBatchIds }: StudentDashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatsAndAnnouncements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('aura_session_token');
      // Stats API
      const statsRes = await fetch(`/api/progress/${userId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      setStats(statsData);

      // Announcements API
      const annRes = await fetch('/api/announcements');
      const annData = await annRes.json();
      setAnnouncements(annData);
    } catch (err) {
      console.error('Error loading student dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndAnnouncements();
  }, [userId]);

  // Filter batches enrolled vs not enrolled
  const enrolledBatches = batches.filter(b => enrolledBatchIds.includes(b.id));

  // Determine announcements applicable to this student (global or batch-specific)
  const applicableAnnouncements = announcements.filter(ann => {
    return !ann.batchId || enrolledBatchIds.includes(ann.batchId);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0071e3] mb-3"></div>
        <p className="text-xs font-semibold">Synchronizing Student Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* Welcome Greetings Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans">
            Welcome Back, {userName}!
          </h1>
          <p className="text-sm text-[#86868b] mt-1 font-medium">
            Your daily learning streak is active. Keep learning to maintain your progress.
          </p>
        </div>

        <button 
          onClick={fetchStatsAndAnnouncements}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-black/5 text-xs font-semibold text-gray-600 rounded-full transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0071e3]" />
          Sync Analytics
        </button>
      </div>

      {/* Analytics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Streak card */}
        <div className="apple-card p-6 bg-white flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase font-extrabold text-orange-500 tracking-widest">Active Streak</p>
            <h3 className="text-3xl font-bold text-[#1d1d1f] font-sans">
              {stats?.dailyStreak || 0} <span className="text-base font-medium text-gray-500">Days</span>
            </h3>
            <p className="text-xs text-[#86868b]">Logged in consecutively</p>
          </div>
          <div className="p-4 bg-orange-50 text-orange-500 rounded-2xl">
            <Flame className="w-8 h-8 fill-orange-500" />
          </div>
        </div>

        {/* Study hours card */}
        <div className="apple-card p-6 bg-white flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase font-extrabold text-[#0071e3] tracking-widest">Time Spent</p>
            <h3 className="text-3xl font-bold text-[#1d1d1f] font-sans">
              {stats?.learningHours || 0} <span className="text-base font-medium text-gray-500">Hours</span>
            </h3>
            <p className="text-xs text-[#86868b]">Calculated learning hours</p>
          </div>
          <div className="p-4 bg-[#0071e3]/10 text-[#0071e3] rounded-2xl">
            <Clock className="w-8 h-8" />
          </div>
        </div>

        {/* Progress card */}
        <div className="apple-card p-6 bg-white flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase font-extrabold text-emerald-600 tracking-widest">Progress</p>
            <h3 className="text-3xl font-bold text-[#1d1d1f] font-sans">
              {stats?.overallProgress || 0}%
            </h3>
            <p className="text-xs text-[#86868b]">Completed ({stats?.completedLectures}/{stats?.totalLectures}) lectures</p>
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Award className="w-8 h-8" />
          </div>
        </div>

        {/* Course enrollment card */}
        <div className="apple-card p-6 bg-white flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase font-extrabold text-purple-600 tracking-widest">Enrolled Batches</p>
            <h3 className="text-3xl font-bold text-[#1d1d1f] font-sans">
              {enrolledBatches.length} <span className="text-base font-medium text-gray-500">Batches</span>
            </h3>
            <p className="text-xs text-[#86868b]">Active classroom memberships</p>
          </div>
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
            <BookOpen className="w-8 h-8" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Learning Dashboard */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Continue Learning Callout */}
          {stats?.watchHistory && stats.watchHistory.length > 0 ? (
            <div className="apple-card p-6 bg-gradient-to-r from-zinc-900 to-black text-white relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Sparkles className="w-32 h-32 text-white" />
              </div>

              <div className="space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                  Continue Learning
                </span>

                <div>
                  <h4 className="text-lg font-bold truncate tracking-tight">{stats.watchHistory[0].lectureTitle}</h4>
                  <p className="text-xs text-gray-300 mt-1">
                    Classroom: <span className="font-semibold text-white">{stats.watchHistory[0].batchTitle}</span>
                  </p>
                </div>

                {/* Progress bar simulation */}
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="bg-[#0071e3] h-full" style={{ width: '60%' }} />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-gray-300 font-medium">Last active {new Date(stats.watchHistory[0].updatedAt).toLocaleDateString()}</span>
                  
                  {/* Find original batch corresponding to this watch history */}
                  {(() => {
                    const matchedBatch = batches.find(b => b.title === stats.watchHistory[0].batchTitle);
                    if (matchedBatch) {
                      return (
                        <button
                          id="resume-lecture-banner-btn"
                          onClick={() => onViewLectures(matchedBatch.id)}
                          className="flex items-center gap-1 bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          Resume Lecture
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="apple-card p-8 bg-white text-center space-y-4">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-gray-900">Start Your First Class</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  You are enrolled in free resources! Go to any active batch below, pick a physics or calculus lecture, and begin.
                </p>
              </div>
            </div>
          )}

          {/* Enrolled Batches list */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#1d1d1f] tracking-tight font-sans">
              Your Active Batches
            </h3>

            {enrolledBatches.length === 0 ? (
              <div className="apple-card p-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm">You have not enrolled in any batches yet.</p>
                <p className="text-xs text-gray-500 mt-1">Scroll down to discover our free and premium batches.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {enrolledBatches.map((batch) => (
                  <div key={batch.id} className="apple-card overflow-hidden bg-white flex flex-col h-full group">
                    <div className="aspect-video relative overflow-hidden bg-gray-50">
                      <img 
                        src={batch.thumbnailUrl} 
                        alt={batch.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{batch.category}</span>
                      <h4 className="text-base font-bold text-gray-900 tracking-tight mt-1 line-clamp-1">{batch.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">By {batch.instructor}</p>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{batch.totalLectures} Lectures</span>
                        <button
                          id={`dash-view-batch-btn-${batch.id}`}
                          onClick={() => onViewLectures(batch.id)}
                          className="text-xs font-bold text-[#0071e3] flex items-center gap-1 group cursor-pointer"
                        >
                          Launch Batch
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Announcements & Notifications Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="apple-card p-6 bg-white space-y-5">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-[#1d1d1f] font-sans">Batch Announcements</h3>
            </div>

            {applicableAnnouncements.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs leading-relaxed">
                <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                No announcements or system notifications reported recently.
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {applicableAnnouncements.map((ann) => {
                  let badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                  if (ann.type === 'maintenance') badgeColor = 'bg-red-50 text-red-700 border-red-100';
                  if (ann.type === 'notice') badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';

                  return (
                    <div key={ann.id} className="p-4 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-all space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                          {ann.type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(ann.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-gray-900 leading-tight">{ann.title}</h4>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{ann.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Micro Watch History Timeline */}
          {stats?.watchHistory && stats.watchHistory.length > 0 && (
            <div className="apple-card p-6 bg-white space-y-4">
              <h3 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">Recently Watched</h3>
              
              <div className="space-y-3">
                {stats.watchHistory.slice(0, 3).map((hist, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs">
                    <div className="p-1.5 bg-gray-100 rounded-full text-gray-500 shrink-0 mt-0.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 line-clamp-1">{hist.lectureTitle}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{hist.batchTitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
