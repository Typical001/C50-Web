import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Play, FileText, Download, CheckCircle, 
  HelpCircle, PlayCircle, ArrowRight,
  Sparkles, Layers, MonitorPlay, BookOpen, FolderOpen, ListVideo,
  Clock, Eye, ArrowLeft
} from 'lucide-react';
import { Lecture } from '../types';

// ── Structure Types ──────────────────────────────────────────────

interface StructureLecture extends Lecture {
  completed?: boolean;
}

interface StructureChapter {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  lectures: StructureLecture[];
}

interface StructureSubject {
  id: string;
  batchId: string;
  title: string;
  description: string;
  chapters: StructureChapter[];
}

interface CoursePlayerProps {
  batchId: string;
  batchTitle: string;
  userId: string;
  onBack: () => void;
}

type InternalView = 'subjects' | 'chapters' | 'lectures' | 'player';

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('/embed/')) return url;
  
  // Robust match to capture 11 character YouTube video ID from watch, share, live, or mobile URLs
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }
  return url;
};

// ── Component ────────────────────────────────────────────────────

export default function CoursePlayer({ batchId, batchTitle, userId, onBack }: CoursePlayerProps) {
  const [structure, setStructure] = useState<StructureSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressState, setProgressState] = useState<Record<string, boolean>>({});

  // Internal navigation state
  const [internalView, setInternalView] = useState<InternalView>('subjects');
  const [activeSubject, setActiveSubject] = useState<StructureSubject | null>(null);
  const [activeChapter, setActiveChapter] = useState<StructureChapter | null>(null);
  const [activeLecture, setActiveLecture] = useState<StructureLecture | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'notes' | 'attachments'>('about');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // ── Data Loading ───────────────────────────────────────────────

  useEffect(() => {
    async function loadStructure() {
      try {
        setLoading(true);
        const res = await fetch(`/api/batches/${batchId}/structure`);
        const structData = await res.json();
        
        if (Array.isArray(structData)) {
          setStructure(structData);
        }

        // Load user progress
        try {
          const token = localStorage.getItem('aura_session_token');
          const progRes = await fetch(`/api/progress/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const progressData = await progRes.json();
          const progressMap: Record<string, boolean> = {};
          if (Array.isArray(progressData)) {
            progressData.forEach((p: any) => {
              if (p.completed) progressMap[p.lectureId] = true;
            });
          }
          setProgressState(progressMap);
        } catch (progErr) {
          console.warn('Failed to load user progress maps:', progErr);
        }
      } catch (err) {
        console.error('Error loading course structure:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStructure();
  }, [batchId, userId]);

  // ── Progress & History APIs ────────────────────────────────────

  const toggleComplete = async (lecId: string) => {
    const nextVal = !progressState[lecId];
    setProgressState(prev => ({ ...prev, [lecId]: nextVal }));

    try {
      const token = localStorage.getItem('aura_session_token');
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          lectureId: lecId,
          completed: nextVal,
          watchPercentage: nextVal ? 100 : 0
        })
      });
    } catch (err) {
      console.error('Error toggling progress:', err);
    }
  };

  const updateWatchHistory = async (lecId: string, timeSec: number) => {
    try {
      const token = localStorage.getItem('aura_session_token');
      await fetch('/api/watch-history', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          lectureId: lecId,
          playbackTime: timeSec
        })
      });
    } catch (err) {
      console.error('Error logging watch history:', err);
    }
  };

  // ── Navigation Helpers ─────────────────────────────────────────

  const navigateToSubject = (subject: StructureSubject) => {
    setActiveSubject(subject);
    setActiveChapter(null);
    setActiveLecture(null);
    setInternalView('chapters');
  };

  const navigateToChapter = (chapter: StructureChapter) => {
    setActiveChapter(chapter);
    setActiveLecture(null);
    setInternalView('lectures');
  };

  const navigateToLecture = (lecture: StructureLecture) => {
    setActiveLecture(lecture);
    setActiveTab('about');
    setInternalView('player');
    updateWatchHistory(lecture.id, 0);
  };

  const goBackOneLevel = () => {
    if (internalView === 'player') {
      setActiveLecture(null);
      setInternalView('lectures');
    } else if (internalView === 'lectures') {
      setActiveChapter(null);
      setInternalView('chapters');
    } else if (internalView === 'chapters') {
      setActiveSubject(null);
      setInternalView('subjects');
    } else {
      onBack();
    }
  };

  // Get lectures in current chapter for prev/next navigation
  const chapterLectures = activeChapter?.lectures || [];
  const currentLecIdx = activeLecture ? chapterLectures.findIndex(l => l.id === activeLecture.id) : -1;

  const handlePrev = () => {
    if (currentLecIdx > 0) {
      const prevLec = chapterLectures[currentLecIdx - 1];
      setActiveLecture(prevLec);
      setActiveTab('about');
      updateWatchHistory(prevLec.id, 0);
    }
  };

  const handleNext = () => {
    if (currentLecIdx < chapterLectures.length - 1) {
      const nextLec = chapterLectures[currentLecIdx + 1];
      setActiveLecture(nextLec);
      setActiveTab('about');
      updateWatchHistory(nextLec.id, 0);
    }
  };

  // ── Count helpers ──────────────────────────────────────────────

  const countLecturesInSubject = (sub: StructureSubject) => {
    return sub.chapters.reduce((sum, ch) => sum + (ch.lectures?.length || 0), 0);
  };

  const countCompletedInSubject = (sub: StructureSubject) => {
    let count = 0;
    sub.chapters.forEach(ch => {
      (ch.lectures || []).forEach(l => {
        if (progressState[l.id]) count++;
      });
    });
    return count;
  };

  const countCompletedInChapter = (ch: StructureChapter) => {
    return (ch.lectures || []).filter(l => progressState[l.id]).length;
  };

  // ── Loading State ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0071e3] mb-4"></div>
        <p className="text-sm font-medium">Loading Course Content...</p>
      </div>
    );
  }

  // ── Breadcrumb ─────────────────────────────────────────────────

  const renderBreadcrumb = () => {
    const crumbs: { label: string; onClick: () => void }[] = [
      { label: batchTitle, onClick: () => { setActiveSubject(null); setActiveChapter(null); setActiveLecture(null); setInternalView('subjects'); } }
    ];

    if (activeSubject && (internalView === 'chapters' || internalView === 'lectures' || internalView === 'player')) {
      crumbs.push({ label: activeSubject.title, onClick: () => { setActiveChapter(null); setActiveLecture(null); setInternalView('chapters'); } });
    }

    if (activeChapter && (internalView === 'lectures' || internalView === 'player')) {
      crumbs.push({ label: activeChapter.title, onClick: () => { setActiveLecture(null); setInternalView('lectures'); } });
    }

    if (activeLecture && internalView === 'player') {
      crumbs.push({ label: activeLecture.title, onClick: () => {} });
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-[#86868b] font-medium flex-wrap">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
              <button
                onClick={crumb.onClick}
                disabled={isLast}
                className={`truncate max-w-[180px] transition-colors ${
                  isLast 
                    ? 'text-[#1d1d1f] font-semibold cursor-default' 
                    : 'hover:text-[#0071e3] cursor-pointer'
                }`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ── Empty State ────────────────────────────────────────────────

  if (structure.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button onClick={onBack} className="flex items-center gap-1 text-[#0071e3] font-medium hover:underline text-sm group">
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </button>
        </div>
        <div className="apple-card p-12 text-center text-gray-500 max-w-lg mx-auto">
          <HelpCircle className="w-12 h-12 text-[#86868b] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2">No Syllabus Configured Yet</h3>
          <p className="text-sm text-[#86868b] leading-relaxed mb-4">
            The administrator has created this batch, but has not published any subjects, chapters, or video lectures yet.
          </p>
          <button onClick={onBack} className="apple-btn-secondary text-xs">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header: Back + Breadcrumb ─────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={goBackOneLevel}
          className="flex items-center gap-1.5 text-[#0071e3] font-medium hover:underline text-sm group shrink-0"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        {renderBreadcrumb()}
      </div>

      {/* ══════════════════════════════════════════════════════════
          VIEW: SUBJECTS LIST
          ══════════════════════════════════════════════════════════ */}
      {internalView === 'subjects' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1d1d1f] tracking-tight">{batchTitle}</h1>
            <p className="text-sm text-[#86868b] mt-1">{structure.length} Subject{structure.length !== 1 ? 's' : ''} available</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {structure.map((subject, idx) => {
              const totalLecs = countLecturesInSubject(subject);
              const completedLecs = countCompletedInSubject(subject);
              const progressPct = totalLecs > 0 ? Math.round((completedLecs / totalLecs) * 100) : 0;

              return (
                <button
                  key={subject.id}
                  onClick={() => navigateToSubject(subject)}
                  className="apple-card p-6 bg-white text-left hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col"
                >
                  {/* Icon + Index */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0071e3]/10 to-[#0071e3]/5 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-[#0071e3]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-[#86868b] tracking-widest">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-[#1d1d1f] tracking-tight line-clamp-2 group-hover:text-[#0071e3] transition-colors">
                    {subject.title}
                  </h3>
                  {subject.description && (
                    <p className="text-xs text-[#86868b] mt-1.5 line-clamp-2 leading-relaxed">{subject.description}</p>
                  )}

                  {/* Stats */}
                  <div className="mt-auto pt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                    <span>{subject.chapters.length} Chapter{subject.chapters.length !== 1 ? 's' : ''}</span>
                    <span>{totalLecs} Lecture{totalLecs !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Progress bar */}
                  {totalLecs > 0 && (
                    <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#0071e3] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${progressPct}%` }} 
                      />
                    </div>
                  )}

                  {/* Arrow indicator */}
                  <div className="flex items-center justify-end mt-3">
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#0071e3] transition-all group-hover:translate-x-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════
          VIEW: CHAPTERS LIST
          ══════════════════════════════════════════════════════════ */}
      {internalView === 'chapters' && activeSubject && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1d1d1f] tracking-tight">{activeSubject.title}</h1>
            <p className="text-sm text-[#86868b] mt-1">
              {activeSubject.chapters.length} Chapter{activeSubject.chapters.length !== 1 ? 's' : ''}
              {activeSubject.description && <> &middot; {activeSubject.description}</>}
            </p>
          </div>

          <div className="space-y-4">
            {activeSubject.chapters.map((chapter, idx) => {
              const lecCount = chapter.lectures?.length || 0;
              const completedCount = countCompletedInChapter(chapter);
              const progressPct = lecCount > 0 ? Math.round((completedCount / lecCount) * 100) : 0;

              return (
                <button
                  key={chapter.id}
                  onClick={() => navigateToChapter(chapter)}
                  className="apple-card w-full p-5 bg-white text-left hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Chapter number */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 flex items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold text-purple-600">{idx + 1}</span>
                    </div>

                    {/* Title & meta */}
                    <div className="flex-grow min-w-0">
                      <h3 className="text-sm font-bold text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors truncate">
                        {chapter.title}
                      </h3>
                      {chapter.description && (
                        <p className="text-xs text-[#86868b] mt-0.5 truncate">{chapter.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868b]">
                          {lecCount} Lecture{lecCount !== 1 ? 's' : ''}
                        </span>
                        {completedCount > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> {completedCount}/{lecCount} done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress + Arrow */}
                    <div className="flex items-center gap-3 shrink-0">
                      {lecCount > 0 && (
                        <div className="w-16">
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${progressPct}%` }} 
                            />
                          </div>
                          <p className="text-[9px] text-gray-400 mt-1 text-center font-semibold">{progressPct}%</p>
                        </div>
                      )}
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#0071e3] transition-all group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════
          VIEW: LECTURES LIST
          ══════════════════════════════════════════════════════════ */}
      {internalView === 'lectures' && activeChapter && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1d1d1f] tracking-tight">{activeChapter.title}</h1>
            <p className="text-sm text-[#86868b] mt-1">
              {activeChapter.lectures?.length || 0} Lecture{(activeChapter.lectures?.length || 0) !== 1 ? 's' : ''} in this chapter
            </p>
          </div>

          {(!activeChapter.lectures || activeChapter.lectures.length === 0) ? (
            <div className="apple-card p-10 text-center text-gray-400">
              <ListVideo className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium">No lectures published in this chapter yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeChapter.lectures.map((lecture, idx) => {
                const isCompleted = progressState[lecture.id];

                return (
                  <button
                    key={lecture.id}
                    onClick={() => navigateToLecture(lecture)}
                    className="apple-card w-full p-4 bg-white text-left hover:shadow-lg transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      {/* Play icon or completed checkmark */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCompleted 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-[#0071e3]/10 text-[#0071e3]'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </div>

                      {/* Lecture info */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#86868b]">{String(idx + 1).padStart(2, '0')}</span>
                          <h3 className={`text-sm font-bold truncate group-hover:text-[#0071e3] transition-colors ${
                            isCompleted ? 'text-emerald-700' : 'text-[#1d1d1f]'
                          }`}>
                            {lecture.title}
                          </h3>
                        </div>
                        {lecture.description && (
                          <p className="text-xs text-[#86868b] mt-0.5 truncate">{lecture.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {lecture.duration}
                          </span>
                          {lecture.notesUrl && (
                            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                              <FileText className="w-3 h-3" /> Notes
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] text-emerald-600 font-bold">{'\u2713'} Completed</span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#0071e3] transition-all group-hover:translate-x-0.5 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════
          VIEW: VIDEO PLAYER
          ══════════════════════════════════════════════════════════ */}
      {internalView === 'player' && activeLecture && (
        <div className="space-y-6">
          
          {/* Video Player */}
          <div className="apple-card overflow-hidden bg-black aspect-video relative shadow-xl">
            {(() => {
              const embedBase = getEmbedUrl(activeLecture.videoUrl);
              const separator = embedBase.includes('?') ? '&' : '?';
              const finalSrc = `${embedBase}${separator}autoplay=1&enablejsapi=1`;
              return (
                <iframe
                  id="lecture-video-player"
                  className="w-full h-full"
                  src={finalSrc}
                  title={activeLecture.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                ></iframe>
              );
            })()}
          </div>

          {/* Video Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 px-6 bg-white border border-black/5 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <button
                disabled={currentLecIdx <= 0}
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-700 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                disabled={currentLecIdx >= chapterLectures.length - 1}
                onClick={handleNext}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-gray-700 rounded-full transition-colors cursor-pointer"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-gray-400 font-medium">
                {currentLecIdx + 1} / {chapterLectures.length}
              </span>
            </div>

            <div className="flex items-center gap-4">


              {/* Complete Toggle */}
              <button
                id="mark-completed-btn"
                onClick={() => toggleComplete(activeLecture.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  progressState[activeLecture.id]
                    ? 'bg-emerald-500 text-white shadow-emerald-500/10'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CheckCircle className={`w-4 h-4 ${progressState[activeLecture.id] ? 'fill-white text-emerald-500' : ''}`} />
                {progressState[activeLecture.id] ? 'Completed' : 'Mark Completed'}
              </button>
            </div>
          </div>

          {/* Tabs: About / Notes / Attachments */}
          <div className="apple-card p-6 bg-white space-y-6">
            <div className="border-b border-gray-100 pb-1 flex gap-6">
              {(['about', 'notes', 'attachments'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-semibold capitalize relative cursor-pointer outline-none transition-colors ${
                    activeTab === tab ? 'text-[#0071e3]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {tab === 'about' ? 'About Lecture' : tab === 'notes' ? 'Handouts & Notes' : 'Attachments'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0071e3] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{activeLecture.title}</h2>
                <div className="flex flex-wrap items-center gap-3.5 text-xs font-medium text-gray-500">
                  <span className="bg-gray-100 px-2.5 py-1 rounded-full text-gray-700">Duration: {activeLecture.duration}</span>
                  {activeLecture.notesUrl && (
                    <span className="bg-emerald-50 px-2.5 py-1 rounded-full text-emerald-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Study Note Included
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed pt-2">
                  {activeLecture.description || 'No lecture syllabus description provided.'}
                </p>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-6">
                {activeLecture.notesUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-500/10">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{activeLecture.notesTitle || 'Handwritten Study Notes'}</h4>
                          <p className="text-xs text-gray-500">Official companion note in PDF format</p>
                        </div>
                      </div>
                      <a
                        id="download-notes-btn"
                        href={activeLecture.notesUrl}
                        download
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </a>
                    </div>

                    {/* Inline PDF Viewer */}
                    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-inner">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#0071e3]" />
                          Embedded Smart Reader
                        </span>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Page 1 of 1</span>
                      </div>
                      <div className="bg-[#525659] py-8 px-4 flex justify-center min-h-[400px]">
                        <iframe 
                          src={`${activeLecture.notesUrl}#toolbar=0`} 
                          className="w-full max-w-2xl bg-white shadow-2xl rounded-sm"
                          style={{ height: '450px' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    No study notes uploaded for this specific lecture. Check back soon!
                  </div>
                )}
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                {activeLecture.attachments && activeLecture.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeLecture.attachments.map((file, idx) => {
                      const attachmentUrl = /^https?:\/\//i.test(file) ? file : null;
                      return (
                      <div key={idx} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[#0071e3]/10 text-[#0071e3] rounded-xl">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="truncate max-w-[150px]">
                            <h5 className="text-xs font-bold text-gray-900 truncate">{file}</h5>
                            <p className="text-[10px] text-gray-400">Additional Handout</p>
                          </div>
                        </div>
                        {attachmentUrl ? (
                          <a href={attachmentUrl} download className="text-xs font-bold text-[#0071e3] hover:underline">Download</a>
                        ) : (
                          <span className="text-xs text-gray-400" title="This legacy local attachment is no longer available">Unavailable</span>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    No homework attachments or test sheets published for this lecture.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
