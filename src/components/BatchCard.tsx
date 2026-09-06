import React from 'react';
import { Batch } from '../types';
import { BookOpen, FileText, Globe, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface BatchCardProps {
  key?: string;
  batch: Batch;
  isEnrolled: boolean;
  onEnrollFree: (batchId: string) => void;
  onPurchaseClick: (batch: Batch) => void;
  onViewLectures: (batchId: string) => void;
}

export default function BatchCard({ batch, isEnrolled, onEnrollFree, onPurchaseClick, onViewLectures }: BatchCardProps) {
  const percentDiscount = batch.price > 0 
    ? Math.round(((batch.price - batch.discountPrice) / batch.price) * 100) 
    : 0;

  // Render color for custom tags
  const getTagStyle = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'bestseller':
        return 'bg-[#7C4DFF] text-white';
      case 'popular':
        return 'bg-emerald-500 text-white';
      case 'new':
        return 'bg-blue-500 text-white';
      case 'free':
        return 'bg-indigo-500 text-white';
      default:
        return 'bg-[#6D5DF6] text-white';
    }
  };

  return (
    <motion.div 
      layout
      className="apple-card overflow-hidden flex flex-col h-full bg-white group border border-gray-100"
    >
      {/* Banner / Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-50">
        <img 
          src={batch.thumbnailUrl} 
          alt={batch.title} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Badges on Thumbnail overlay */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-1.5 z-10">
          {batch.customTag ? (
            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${getTagStyle(batch.customTag)}`}>
              {batch.customTag}
            </span>
          ) : (
            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${batch.isFree ? 'bg-indigo-500 text-white' : 'bg-[#6D5DF6] text-white'}`}>
              {batch.isFree ? 'Free' : 'Premium'}
            </span>
          )}

          {batch.difficulty && (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white shadow-sm">
              {batch.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 flex flex-col flex-grow text-left">
        {/* Category & Rating Row */}
        <div className="flex items-center justify-between text-xs text-[#86868b] mb-2 font-medium">
          <span className="font-semibold text-[#6D5DF6] uppercase tracking-wider text-[10px]">{batch.category}</span>
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            {batch.language}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-extrabold text-[#1d1d1f] tracking-tight line-clamp-1 mb-1 font-sans group-hover:text-[#6D5DF6] transition-colors duration-300">
          {batch.title}
        </h3>
        
        {/* Instructor */}
        <p className="text-xs text-[#86868b] mb-3">
          By Educator <span className="font-semibold text-gray-700">{batch.instructor}</span>
        </p>

        {/* Rating detail row */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="flex items-center text-amber-500">
            <Star className="w-3.5 h-3.5 fill-current" />
          </div>
          <span className="text-xs font-bold text-gray-800">{batch.rating || 4.7}</span>
          <span className="text-xs text-[#86868b] font-medium">({batch.ratingCount ? `${(batch.ratingCount / 1000).toFixed(1)}k` : '1.2k'} reviews)</span>
        </div>

        {/* Description */}
        <p className="text-xs text-[#86868b] line-clamp-2 leading-relaxed mb-5">
          {batch.description}
        </p>

        {/* Lecture & Note Info */}
        <div className="grid grid-cols-2 gap-4 py-3 px-4 bg-gray-50 rounded-2xl mb-6 text-xs text-gray-600 font-semibold">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#6D5DF6]" />
            <span>{batch.totalLectures} Lectures</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>{batch.notesCount} PDF Notes</span>
          </div>
        </div>

        {/* Price & CTA Spacer */}
        <div className="mt-auto pt-5 border-t border-gray-100 flex items-center justify-between">
          <div>
            {batch.isFree ? (
              <span className="text-lg font-extrabold text-emerald-600">FREE</span>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold text-[#1d1d1f]">₹{batch.discountPrice}</span>
                  <span className="text-xs text-gray-400 line-through">₹{batch.price}</span>
                </div>
                {percentDiscount > 0 && (
                  <span className="text-[9px] font-bold text-emerald-600 mt-0.5">
                    Save {percentDiscount}%
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            {isEnrolled ? (
              <button
                id={`learn-btn-${batch.id}`}
                onClick={() => onViewLectures(batch.id)}
                className="bg-[#6D5DF6] hover:bg-[#7C4DFF] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-md shadow-[#6D5DF6]/10 transition-all duration-300 hover:scale-102 cursor-pointer"
              >
                Start Learning
              </button>
            ) : batch.isFree ? (
              <button
                id={`enroll-btn-${batch.id}`}
                onClick={() => onEnrollFree(batch.id)}
                className="border-2 border-[#6D5DF6] text-[#6D5DF6] hover:bg-[#6D5DF6]/5 text-xs font-bold px-4 py-2 rounded-full transition-all duration-300 hover:scale-102 cursor-pointer"
              >
                Enroll Free
              </button>
            ) : (
              <button
                id={`buy-btn-${batch.id}`}
                disabled={!batch.paymentEnabled}
                onClick={() => onPurchaseClick(batch)}
                className="bg-[#6D5DF6] hover:bg-[#7C4DFF] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-md shadow-[#6D5DF6]/10 transition-all duration-300 hover:scale-102 cursor-pointer"
              >
                {batch.paymentEnabled ? 'Buy Now' : 'Coming Soon'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
