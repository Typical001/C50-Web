import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, BookOpen, Layers, PlaySquare, 
  FileText, Megaphone, DollarSign, Users, Trash, Upload,
  Sparkles, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { Batch, Subject, Chapter, Lecture, Announcement, Payment } from '../types';

interface AdminDashboardProps {
  batches: Batch[];
  onRefreshBatches: () => void;
  userId: string;
}

interface SyllabusStructure {
  id: string;
  batchId: string;
  title: string;
  description: string;
  chapters: {
    id: string;
    subjectId: string;
    title: string;
    description: string;
    lectures: Lecture[];
  }[];
}

export default function AdminDashboard({ batches, onRefreshBatches, userId }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'batches' | 'syllabus' | 'announcements' | 'payments'>('batches');
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Batch Form State
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchForm, setBatchForm] = useState({
    title: '',
    description: '',
    instructor: '',
    price: '',
    discountPrice: '',
    duration: '6 Months',
    language: 'English/Hindi',
    difficulty: 'Beginner' as 'Beginner' | 'Intermediate' | 'Advanced',
    tags: '',
    category: 'Competitive Exams',
    isFree: false,
    thumbnailUrl: '',
    bannerUrl: ''
  });

  // Syllabus Selection State
  const [selectedSyllabusBatch, setSelectedSyllabusBatch] = useState<Batch | null>(null);
  const [syllabusStructure, setSyllabusStructure] = useState<SyllabusStructure[]>([]);
  
  // Subject Builder Form
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subjectTitle, setSubjectTitle] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');

  // Chapter Builder Form
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterDesc, setChapterDesc] = useState('');

  // Lecture Builder Form
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [showLectureForm, setShowLectureForm] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDesc, setLectureDesc] = useState('');
  const [lectureVideoUrl, setLectureVideoUrl] = useState('');
  const [lectureDuration, setLectureDuration] = useState('45:00');
  const [lectureNotesUrl, setLectureNotesUrl] = useState('');
  const [lectureNotesTitle, setLectureNotesTitle] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Announcement Form State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState<'notice' | 'update' | 'maintenance' | 'course'>('notice');
  const [annBatchId, setAnnBatchId] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'payments') {
      loadPayments();
    } else if (activeTab === 'announcements') {
      loadAnnouncements();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedSyllabusBatch) {
      loadSyllabus(selectedSyllabusBatch.id);
    }
  }, [selectedSyllabusBatch]);

  // Load Sales/Payments
  const loadPayments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error('Error fetching payments details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Announcements
  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/announcements');
      const data = await res.json();
      setAnnouncements(data);
    } catch (err) {
      console.error('Error loading notices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Syllabus Structure for Builder
  const loadSyllabus = async (bId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/batches/${bId}/structure`);
      const data = await res.json();
      setSyllabusStructure(data);
    } catch (err) {
      console.error('Error loading batch structure:', err);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------
  // Batch Create/Edit Logic
  // -----------------------------------------------------------------
  const handleBatchFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBatch ? `/api/batches/${editingBatch.id}` : '/api/batches';
      const method = editingBatch ? 'PUT' : 'POST';

      const payload = {
        ...batchForm,
        tags: batchForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowBatchForm(false);
        setEditingBatch(null);
        resetBatchForm();
        onRefreshBatches();
      }
    } catch (err) {
      console.error('Error saving batch:', err);
    }
  };

  const handleEditBatchClick = (batch: Batch) => {
    setEditingBatch(batch);
    setBatchForm({
      title: batch.title,
      description: batch.description,
      instructor: batch.instructor,
      price: String(batch.price),
      discountPrice: String(batch.discountPrice),
      duration: batch.duration,
      language: batch.language,
      difficulty: batch.difficulty,
      tags: batch.tags.join(', '),
      category: batch.category,
      isFree: batch.isFree,
      thumbnailUrl: batch.thumbnailUrl,
      bannerUrl: batch.bannerUrl
    });
    setShowBatchForm(true);
  };

  const handleDeleteBatchClick = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this batch and all its associated chapters & lectures?')) return;
    try {
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshBatches();
        if (selectedSyllabusBatch?.id === id) {
          setSelectedSyllabusBatch(null);
        }
      }
    } catch (err) {
      console.error('Error deleting batch:', err);
    }
  };

  const resetBatchForm = () => {
    setBatchForm({
      title: '',
      description: '',
      instructor: '',
      price: '',
      discountPrice: '',
      duration: '6 Months',
      language: 'English/Hindi',
      difficulty: 'Beginner',
      tags: '',
      category: 'Competitive Exams',
      isFree: false,
      thumbnailUrl: '',
      bannerUrl: ''
    });
  };

  // -----------------------------------------------------------------
  // Syllabus Builder Logic (Subjects, Chapters, Lectures)
  // -----------------------------------------------------------------
  const handleAddSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSyllabusBatch) return;

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedSyllabusBatch.id,
          title: subjectTitle,
          description: subjectDesc
        })
      });

      if (res.ok) {
        setSubjectTitle('');
        setSubjectDesc('');
        setShowSubjectForm(false);
        loadSyllabus(selectedSyllabusBatch.id);
      }
    } catch (err) {
      console.error('Error adding subject:', err);
    }
  };

  const handleAddChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedSyllabusBatch) return;

    try {
      const res = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          title: chapterTitle,
          description: chapterDesc
        })
      });

      if (res.ok) {
        setChapterTitle('');
        setChapterDesc('');
        setShowChapterForm(false);
        loadSyllabus(selectedSyllabusBatch.id);
      }
    } catch (err) {
      console.error('Error adding chapter:', err);
    }
  };

  // Base64 File Uploader implementation
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileData
          })
        });
        const uploadResponse = await res.json();
        if (uploadResponse.url) {
          setLectureNotesUrl(uploadResponse.url);
          setLectureNotesTitle(file.name.replace('.pdf', '') + ' Class Notes');
        }
      } catch (err) {
        console.error('File upload failed:', err);
      } finally {
        setUploadingPdf(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddLectureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChapterId || !selectedSyllabusBatch) return;

    try {
      const res = await fetch('/api/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapterId,
          title: lectureTitle,
          description: lectureDesc,
          videoUrl: lectureVideoUrl,
          duration: lectureDuration,
          notesUrl: lectureNotesUrl,
          notesTitle: lectureNotesTitle
        })
      });

      if (res.ok) {
        setLectureTitle('');
        setLectureDesc('');
        setLectureVideoUrl('');
        setLectureDuration('45:00');
        setLectureNotesUrl('');
        setLectureNotesTitle('');
        setShowLectureForm(false);
        loadSyllabus(selectedSyllabusBatch.id);
        onRefreshBatches(); // Refresh lecture counts in batch view
      }
    } catch (err) {
      console.error('Error adding lecture:', err);
    }
  };

  const handleDeleteLectureClick = async (lecId: string) => {
    if (!window.confirm('Delete this video lecture permanently?')) return;
    try {
      const res = await fetch(`/api/lectures/${lecId}`, { method: 'DELETE' });
      if (res.ok && selectedSyllabusBatch) {
        loadSyllabus(selectedSyllabusBatch.id);
        onRefreshBatches();
      }
    } catch (err) {
      console.error('Error deleting lecture:', err);
    }
  };

  // -----------------------------------------------------------------
  // Announcements Logic
  // -----------------------------------------------------------------
  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle,
          content: annContent,
          type: annType,
          batchId: annBatchId || null,
          authorId: userId
        })
      });

      if (res.ok) {
        setAnnTitle('');
        setAnnContent('');
        setAnnType('notice');
        setAnnBatchId('');
        loadAnnouncements();
      }
    } catch (err) {
      console.error('Error publishing notice:', err);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Delete this announcement permanently?')) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadAnnouncements();
      }
    } catch (err) {
      console.error('Error deleting notice:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header and Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#1d1d1f] tracking-tight font-sans">
          Administrator Console
        </h1>
        <p className="text-sm text-[#86868b] mt-1 font-medium">
          Manage courses, structure syllabus, publish notices, and view live payments records.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 pb-1">
        {(['batches', 'syllabus', 'announcements', 'payments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-semibold capitalize relative cursor-pointer outline-none transition-colors ${
              activeTab === tab ? 'text-[#0071e3]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab === 'batches' ? 'Course Batches' : tab === 'syllabus' ? 'Syllabus Builder' : tab === 'announcements' ? 'Announcements' : 'Sales & Payments'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0071e3] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------------------
          TABS: MANAGING BATCHES
          ------------------------------------------------------------- */}
      {activeTab === 'batches' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 font-sans">Course Batches</h3>
            <button
              id="admin-add-batch-btn"
              onClick={() => {
                setEditingBatch(null);
                resetBatchForm();
                setShowBatchForm(!showBatchForm);
              }}
              className="apple-btn-primary flex items-center gap-1.5 text-xs px-4 py-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New Batch
            </button>
          </div>

          {/* Create/Edit Batch Form overlay container */}
          {showBatchForm && (
            <div className="apple-card p-6 bg-white border-2 border-[#0071e3]/20 space-y-6 animate-fadeIn">
              <h4 className="text-base font-bold text-gray-900">
                {editingBatch ? 'Modify Batch' : 'Create New Educational Batch'}
              </h4>

              <form onSubmit={handleBatchFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Course Title</label>
                  <input
                    type="text"
                    required
                    value={batchForm.title}
                    onChange={(e) => setBatchForm({...batchForm, title: e.target.value})}
                    placeholder="e.g. JEE Main Advanced Physics (Alpha Batch)"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Lead Instructor</label>
                  <input
                    type="text"
                    required
                    value={batchForm.instructor}
                    onChange={(e) => setBatchForm({...batchForm, instructor: e.target.value})}
                    placeholder="e.g. Prof. Sarah Vance"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-1.5">
                  <label className="font-semibold text-gray-700">Batch Overview Description</label>
                  <textarea
                    required
                    value={batchForm.description}
                    onChange={(e) => setBatchForm({...batchForm, description: e.target.value})}
                    placeholder="Enter exhaustive summary of study materials, test schedules, targets, etc."
                    rows={3}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Price (INR)</label>
                  <input
                    type="number"
                    required={!batchForm.isFree}
                    disabled={batchForm.isFree}
                    value={batchForm.price}
                    onChange={(e) => setBatchForm({...batchForm, price: e.target.value})}
                    placeholder="e.g. 4999"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Discounted Selling Price (INR)</label>
                  <input
                    type="number"
                    required={!batchForm.isFree}
                    disabled={batchForm.isFree}
                    value={batchForm.discountPrice}
                    onChange={(e) => setBatchForm({...batchForm, discountPrice: e.target.value})}
                    placeholder="e.g. 1999"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Duration</label>
                  <input
                    type="text"
                    required
                    value={batchForm.duration}
                    onChange={(e) => setBatchForm({...batchForm, duration: e.target.value})}
                    placeholder="e.g. 6 Months"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Syllabus Medium (Languages)</label>
                  <input
                    type="text"
                    required
                    value={batchForm.language}
                    onChange={(e) => setBatchForm({...batchForm, language: e.target.value})}
                    placeholder="e.g. English, English/Hindi"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Difficulty Grade</label>
                  <select
                    value={batchForm.difficulty}
                    onChange={(e) => setBatchForm({...batchForm, difficulty: e.target.value as any})}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Course Category</label>
                  <input
                    type="text"
                    required
                    value={batchForm.category}
                    onChange={(e) => setBatchForm({...batchForm, category: e.target.value})}
                    placeholder="e.g. Competitive Exams, College Students, Skill Development"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-1.5">
                  <label className="font-semibold text-gray-700">Thumbnail Image URL (Unsplash/Web)</label>
                  <input
                    type="text"
                    value={batchForm.thumbnailUrl}
                    onChange={(e) => setBatchForm({...batchForm, thumbnailUrl: e.target.value})}
                    placeholder="e.g. https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 flex items-center gap-2 pt-2">
                  <input
                    id="isFreeCheckbox"
                    type="checkbox"
                    checked={batchForm.isFree}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBatchForm({
                        ...batchForm,
                        isFree: checked,
                        price: checked ? '0' : batchForm.price,
                        discountPrice: checked ? '0' : batchForm.discountPrice
                      });
                    }}
                    className="w-4 h-4 text-[#0071e3] border-gray-300 rounded focus:ring-[#0071e3]"
                  />
                  <label htmlFor="isFreeCheckbox" className="font-semibold text-gray-700 select-none">
                    This is a Free Batch (Anyone can self-enroll)
                  </label>
                </div>

                <div className="col-span-1 md:col-span-2 flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchForm(false);
                      setEditingBatch(null);
                    }}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="apple-btn-primary text-xs px-5 py-2 cursor-pointer"
                  >
                    {editingBatch ? 'Save Changes' : 'Publish Batch'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Batches Table List */}
          <div className="apple-card overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-extrabold uppercase">
                  <tr>
                    <th className="px-6 py-4">Batch Detail</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Instructor</th>
                    <th className="px-6 py-4">Price Structure</th>
                    <th className="px-6 py-4">Analytics</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <img 
                          src={batch.thumbnailUrl} 
                          alt="" 
                          className="w-12 aspect-video object-cover rounded-md border"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-gray-900 leading-snug">{batch.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{batch.duration} • {batch.language}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-xs text-gray-600">{batch.category}</td>
                      <td className="px-6 py-4 font-semibold text-xs text-gray-800">{batch.instructor}</td>
                      <td className="px-6 py-4">
                        {batch.isFree ? (
                          <span className="text-xs font-bold text-emerald-600">FREE</span>
                        ) : (
                          <div>
                            <span className="font-bold text-gray-900">₹{batch.discountPrice}</span>
                            <span className="text-[10px] text-gray-400 line-through pl-1.5">₹{batch.price}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-medium text-gray-600 space-y-0.5">
                          <p><span className="font-bold text-gray-800">{batch.enrollmentCount}</span> Enrolled</p>
                          <p><span className="font-bold text-gray-800">{batch.totalLectures}</span> Lectures</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditBatchClick(batch)}
                            className="p-1.5 hover:bg-gray-100 text-[#0071e3] rounded-lg transition-colors cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBatchClick(batch.id)}
                            className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* -------------------------------------------------------------
          TABS: SYLLABUS BUILDER (SUBJECTS, CHAPTERS, LECTURES)
          ------------------------------------------------------------- */}
      {activeTab === 'syllabus' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Batch Selector on left */}
          <div className="lg:col-span-1 space-y-4">
            <div className="apple-card p-5 bg-white space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-gray-500 tracking-wider">Select Batch to Modify</h4>
              <div className="space-y-1.5">
                {batches.map((batch) => (
                  <button
                    key={batch.id}
                    id={`syll-select-${batch.id}`}
                    onClick={() => setSelectedSyllabusBatch(batch)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-bold flex items-center justify-between outline-none cursor-pointer ${
                      selectedSyllabusBatch?.id === batch.id
                        ? 'border-[#0071e3] bg-[#0071e3]/5 text-[#0071e3]'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{batch.title}</span>
                    <BookOpen className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Builder Stage in middle/right */}
          <div className="lg:col-span-2">
            {!selectedSyllabusBatch ? (
              <div className="apple-card p-12 text-center text-gray-400 bg-white">
                <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold">Select an educational batch on the sidebar to construct its syllabus.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-black/5 rounded-2xl shadow-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#86868b]">Course Builder</span>
                    <h3 className="text-base font-extrabold text-gray-900 font-sans leading-tight mt-0.5">{selectedSyllabusBatch.title}</h3>
                  </div>

                  <button
                    id="admin-add-subj-btn"
                    onClick={() => {
                      setShowChapterForm(false);
                      setShowLectureForm(false);
                      setShowSubjectForm(!showSubjectForm);
                    }}
                    className="apple-btn-secondary flex items-center gap-1.5 text-xs py-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add Subject
                  </button>
                </div>

                {/* Add Subject form */}
                {showSubjectForm && (
                  <div className="apple-card p-5 bg-white border border-[#0071e3]/30 animate-fadeIn space-y-4">
                    <h4 className="text-sm font-bold text-gray-900">Add Subject within Batch</h4>
                    <form onSubmit={handleAddSubjectSubmit} className="space-y-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Subject Title</label>
                        <input
                          type="text"
                          required
                          value={subjectTitle}
                          onChange={(e) => setSubjectTitle(e.target.value)}
                          placeholder="e.g. Organic Chemistry, Classical Mechanics"
                          className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Short Description</label>
                        <input
                          type="text"
                          value={subjectDesc}
                          onChange={(e) => setSubjectDesc(e.target.value)}
                          placeholder="e.g. Fundamental theory and laboratory derivations."
                          className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSubjectForm(false)}
                          className="px-3 py-1.5 border rounded-full font-bold text-gray-500 hover:bg-gray-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold rounded-full shadow cursor-pointer"
                        >
                          Save Subject
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Chapters Builder stage form */}
                {showChapterForm && (
                  <div className="apple-card p-5 bg-white border border-[#0071e3]/30 animate-fadeIn space-y-4">
                    <h4 className="text-sm font-bold text-gray-900">Create Chapter</h4>
                    <form onSubmit={handleAddChapterSubmit} className="space-y-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Chapter Title</label>
                        <input
                          type="text"
                          required
                          value={chapterTitle}
                          onChange={(e) => setChapterTitle(e.target.value)}
                          placeholder="e.g. Newton's Laws of Motion, Limits & Continuities"
                          className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Chapter Target Synopsis</label>
                        <input
                          type="text"
                          value={chapterDesc}
                          onChange={(e) => setChapterDesc(e.target.value)}
                          placeholder="e.g. Friction analysis, pulley tension constraint formulas."
                          className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-[#0071e3]"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowChapterForm(false)}
                          className="px-3 py-1.5 border rounded-full font-bold text-gray-500 hover:bg-gray-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white font-bold rounded-full shadow cursor-pointer"
                        >
                          Create Chapter
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Video Lecture Builder form */}
                {showLectureForm && (
                  <div className="apple-card p-5 bg-white border border-[#0071e3]/30 animate-fadeIn space-y-4">
                    <h4 className="text-sm font-bold text-gray-900">Add Video Lecture / Study PDF</h4>
                    <form onSubmit={handleAddLectureSubmit} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="font-bold text-gray-600">Lecture Title</label>
                          <input
                            type="text"
                            required
                            value={lectureTitle}
                            onChange={(e) => setLectureTitle(e.target.value)}
                            placeholder="e.g. Lecture 02: Trajectory Equations"
                            className="w-full px-3.5 py-2 border rounded-xl outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-bold text-gray-600">Lecture Duration</label>
                          <input
                            type="text"
                            required
                            value={lectureDuration}
                            onChange={(e) => setLectureDuration(e.target.value)}
                            placeholder="e.g. 52:15, 1:10:00"
                            className="w-full px-3.5 py-2 border rounded-xl outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Lecture Video Embed Link (YouTube Embed)</label>
                        <input
                          type="text"
                          required
                          value={lectureVideoUrl}
                          onChange={(e) => setLectureVideoUrl(e.target.value)}
                          placeholder="e.g. https://www.youtube.com/embed/S2pSre7G6eU"
                          className="w-full px-3.5 py-2 border rounded-xl outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-bold text-gray-600">Detailed Lecture Syllabus Description</label>
                        <textarea
                          value={lectureDesc}
                          onChange={(e) => setLectureDesc(e.target.value)}
                          placeholder="Formulas covered, homework rules, textbook problems to practice..."
                          rows={2}
                          className="w-full px-3.5 py-2 border rounded-xl outline-none"
                        />
                      </div>

                      {/* PDF Notes Upload Section */}
                      <div className="space-y-2 p-4 bg-gray-50 rounded-xl border">
                        <span className="font-bold text-gray-700 block">Class PDF Study Sheet</span>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="relative">
                            <input
                              type="file"
                              id="pdf-file-picker"
                              accept=".pdf"
                              onChange={handlePdfUpload}
                              className="hidden"
                            />
                            <label
                              htmlFor="pdf-file-picker"
                              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border rounded-full font-bold text-gray-600 shadow-sm cursor-pointer"
                            >
                              <Upload className="w-4 h-4 text-[#0071e3]" />
                              {uploadingPdf ? 'Processing PDF...' : 'Upload PDF Handout'}
                            </label>
                          </div>

                          <div className="flex-grow min-w-0">
                            {lectureNotesUrl ? (
                              <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold">
                                <CheckCircle className="w-4 h-4 shrink-0" />
                                <span className="truncate">Uploaded: {lectureNotesUrl}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">No PDF notes uploaded yet (optional)</span>
                            )}
                          </div>
                        </div>

                        {lectureNotesUrl && (
                          <div className="space-y-1 pt-1">
                            <label className="font-bold text-gray-500">Note Display Label</label>
                            <input
                              type="text"
                              required
                              value={lectureNotesTitle}
                              onChange={(e) => setLectureNotesTitle(e.target.value)}
                              placeholder="e.g. Kinematics Hand-written Notes (Part 1)"
                              className="w-full px-3 py-1.5 border bg-white rounded-lg outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => setShowLectureForm(false)}
                          className="px-3 py-1.5 border rounded-full font-bold text-gray-500 hover:bg-gray-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={uploadingPdf}
                          className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white font-bold rounded-full shadow cursor-pointer"
                        >
                          Publish Lecture Video
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Core syllabus list builder */}
                <div className="space-y-4">
                  {syllabusStructure.length === 0 ? (
                    <div className="text-center py-10 bg-white border rounded-2xl text-gray-400">
                      <Layers className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm">No subjects created for this batch yet.</p>
                      <p className="text-xs text-gray-500">Click &apos;Add Subject&apos; above to begin.</p>
                    </div>
                  ) : (
                    syllabusStructure.map((subject) => (
                      <div key={subject.id} className="apple-card p-5 bg-white space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#0071e3]">Subject</span>
                            <h4 className="text-base font-bold text-gray-900">{subject.title}</h4>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedSubjectId(subject.id);
                              setShowSubjectForm(false);
                              setShowLectureForm(false);
                              setShowChapterForm(!showChapterForm);
                            }}
                            className="text-xs text-[#0071e3] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Create Chapter
                          </button>
                        </div>

                        {/* Chapters inside subject */}
                        <div className="space-y-4">
                          {subject.chapters.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No chapters defined yet in {subject.title}.</p>
                          ) : (
                            subject.chapters.map((chapter) => (
                              <div key={chapter.id} className="pl-4 border-l-2 border-gray-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Chapter</span>
                                    <h5 className="text-xs font-extrabold text-gray-800 leading-none">{chapter.title}</h5>
                                  </div>

                                  <button
                                    onClick={() => {
                                      setSelectedChapterId(chapter.id);
                                      setShowSubjectForm(false);
                                      setShowChapterForm(false);
                                      setShowLectureForm(!showLectureForm);
                                    }}
                                    className="text-[11px] text-[#0071e3] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Add Lecture
                                  </button>
                                </div>

                                {/* Lectures inside chapter */}
                                <div className="space-y-2 mt-2">
                                  {chapter.lectures && chapter.lectures.length > 0 ? (
                                    chapter.lectures.map((lec) => (
                                      <div key={lec.id} className="p-3 bg-gray-50 hover:bg-gray-100/75 rounded-xl border border-black/5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <PlaySquare className="w-4 h-4 text-[#0071e3] shrink-0" />
                                          <div className="truncate text-xs">
                                            <p className="font-bold text-gray-900 truncate">{lec.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                              {lec.duration} • {lec.notesUrl ? 'PDF Note linked' : 'No companion notes'}
                                            </p>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => handleDeleteLectureClick(lec.id)}
                                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 cursor-pointer shrink-0"
                                          title="Delete video lecture"
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[11px] text-gray-400 italic">No video lectures posted in this chapter yet.</p>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* -------------------------------------------------------------
          TABS: ANNOUNCEMENTS MANAGEMENT
          ------------------------------------------------------------- */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Announcement */}
          <div className="lg:col-span-1">
            <div className="apple-card p-5 bg-white space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-sans">Publish Announcement</h3>
              
              <form onSubmit={handleAnnouncementSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Announcement Title</label>
                  <input
                    type="text"
                    required
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="e.g. Schedule for Live Physics Doubt Class"
                    className="w-full px-3.5 py-2 border rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Announcement Content</label>
                  <textarea
                    required
                    value={annContent}
                    onChange={(e) => setAnnContent(e.target.value)}
                    placeholder="Provide exhaustive notice details, times, links, or instructions."
                    rows={4}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Category Tag</label>
                  <select
                    value={annType}
                    onChange={(e) => setAnnType(e.target.value as any)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none"
                  >
                    <option value="notice">Important Notice</option>
                    <option value="update">Batch Update</option>
                    <option value="maintenance">Maintenance alert</option>
                    <option value="course">General Platform Update</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-600">Scope Restriction (Batch target)</label>
                  <select
                    value={annBatchId}
                    onChange={(e) => setAnnBatchId(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none"
                  >
                    <option value="">Global Notice (All students see this)</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full apple-btn-primary text-xs py-2.5 flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Megaphone className="w-4 h-4" />
                  Publish Announcement
                </button>
              </form>
            </div>
          </div>

          {/* Active Announcements history */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-gray-900 font-sans">Active Notices</h3>
            {announcements.length === 0 ? (
              <div className="apple-card p-12 text-center text-gray-400 bg-white">
                <Megaphone className="w-12 h-12 text-gray-100 mx-auto mb-2" />
                <p className="text-sm">No notifications published on the boards.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="apple-card p-5 bg-white flex items-start justify-between gap-4">
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {ann.type}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(ann.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-gray-900 tracking-tight leading-snug">{ann.title}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">{ann.content}</p>
                      
                      {ann.batchId && (
                        <p className="text-[10px] text-[#0071e3] font-semibold">
                          Target Classroom: {batches.find(b => b.id === ann.batchId)?.title || ann.batchId}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0 transition-all cursor-pointer"
                      title="Delete notice"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* -------------------------------------------------------------
          TABS: PAYMENTS & FINANCIAL SALES OVERVIEW
          ------------------------------------------------------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Statistics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="apple-card p-6 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-[#86868b]">Gross Sales Revenue</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1 font-sans">
                  ₹{payments.reduce((sum, p) => sum + p.amount, 0)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="apple-card p-6 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-[#86868b]">Total Transactions</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1 font-sans">
                  {payments.length} <span className="text-xs text-gray-400 font-normal">Checkouts</span>
                </h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="apple-card p-6 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-[#86868b]">Average order value</span>
                <h3 className="text-2xl font-bold text-gray-900 mt-1 font-sans">
                  ₹{payments.length > 0 ? Math.round(payments.reduce((sum, p) => sum + p.amount, 0) / payments.length) : 0}
                </h3>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Payments transaction list table */}
          <div className="apple-card overflow-hidden bg-white">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Razorpay Transaction Ledger</h3>
              <button onClick={loadPayments} className="p-1.5 text-[#0071e3] hover:bg-gray-100 rounded-lg cursor-pointer">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <DollarSign className="w-12 h-12 text-gray-100 mx-auto mb-2" />
                <p className="text-sm">No transaction payloads found in local storage ledger.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 font-extrabold text-gray-500 uppercase">
                    <tr>
                      <th className="px-6 py-4">Transaction ID</th>
                      <th className="px-6 py-4">Student ID</th>
                      <th className="px-6 py-4">Target Batch</th>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Amount Paid</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-bold text-gray-900 font-mono">{p.razorpayPaymentId || p.id}</td>
                        <td className="px-6 py-4 font-semibold text-gray-600">{p.userId}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">
                          {batches.find(b => b.id === p.batchId)?.title || p.batchId}
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-500">{p.razorpayOrderId}</td>
                        <td className="px-6 py-4 font-bold text-gray-900">₹{p.amount}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-400">{new Date(p.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
