import { motion } from 'motion/react';
import { ArrowRight, Play, BookOpen, Award, Users, Video } from 'lucide-react';

interface AppleHeroProps {
  onExploreFree: () => void;
  onExplorePaid: () => void;
  isAuthenticated: boolean;
  onGetStarted: () => void;
  heroTitle?: string;
  heroSubtitle?: string;
}

export default function AppleHero({ onExploreFree, onExplorePaid, isAuthenticated, onGetStarted, heroTitle, heroSubtitle }: AppleHeroProps) {
  return (
    <div id="hero-section" className="relative overflow-hidden bg-gradient-to-b from-[#f8f7ff] to-white pt-24 pb-20 sm:pt-32 sm:pb-28">
      {/* Decorative background grid and circles */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#eef0ff_1px,transparent_1px),linear-gradient(to_bottom,#eef0ff_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-70" />
      
      <div className="absolute top-1/4 left-10 -z-10 w-72 h-72 bg-[#6D5DF6]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 -z-10 w-96 h-96 bg-[#7C4DFF]/5 rounded-full blur-3xl" />
 
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Context, Badge, Headlines */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
            
            {/* Pill Badge */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-[#6D5DF6] bg-[#6D5DF6]/10 rounded-full shadow-sm shadow-[#6D5DF6]/5"
            >
              <Award className="w-3.5 h-3.5" />
              Trusted by 10,000+ MPPSC Aspirants
            </motion.div>

            {/* Main Headline */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl font-extrabold tracking-tight text-[#1d1d1f] sm:text-5xl md:text-6xl font-sans"
            >
              {heroTitle || "Design your future with C50 Academy"}
            </motion.h1>

            {/* Sub-headline */}
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base text-[#86868b] sm:text-lg font-medium leading-relaxed font-sans"
            >
              {heroSubtitle || "Access premium lectures, complete syllabus tracking, and study notes in a clean, visual education space."}
            </motion.p>

            {/* Call to Actions */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4 items-center w-full"
            >
              <button 
                onClick={isAuthenticated ? onExplorePaid : onGetStarted}
                className="inline-flex items-center justify-center gap-2 bg-[#6D5DF6] hover:bg-[#5b4ee4] active:bg-[#4d3fd1] text-white px-7 py-3.5 font-bold rounded-2xl text-sm shadow-lg shadow-[#6D5DF6]/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {isAuthenticated ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button 
                onClick={onExploreFree}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 text-gray-800 px-7 py-3.5 font-bold rounded-2xl text-sm transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play className="w-4 h-4 text-[#6D5DF6]" />
                Explore Free Lectures
              </button>
            </motion.div>

          </div>

          {/* Right Column: Hero Graphic + Floating Cards */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            
            {/* Main Student Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-[400px] lg:max-w-none aspect-[4/5] overflow-visible rounded-3xl"
            >
              {/* Soft purple aura behind student image */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#6D5DF6]/10 to-[#7C4DFF]/5 rounded-3xl -rotate-3 scale-[1.02] shadow-xl" />
              
              <img 
                src="/student_hero.jpg" 
                alt="MPPSC Aspirant Student" 
                className="relative z-10 w-full h-full object-cover rounded-3xl border border-gray-100/50 shadow-md"
                referrerPolicy="no-referrer"
              />

              {/* Floating Stat Card 1: Courses */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                whileHover={{ scale: 1.05, translateY: -2 }}
                className="absolute top-[8%] -left-[12%] z-20 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 p-4 shadow-lg flex items-center gap-3 cursor-default"
              >
                <div className="p-2.5 bg-[#6D5DF6]/10 text-[#6D5DF6] rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 font-sans leading-none">100+</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider font-sans">Premium Courses</p>
                </div>
              </motion.div>

              {/* Floating Stat Card 2: Success Rate */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: -10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                whileHover={{ scale: 1.05, translateY: -2 }}
                className="absolute top-[35%] -right-[8%] z-20 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 p-4 shadow-lg flex items-center gap-3 cursor-default"
              >
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 font-sans leading-none font-sans">95%</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider font-sans">Success Rate</p>
                </div>
              </motion.div>

              {/* Floating Stat Card 3: Active Students */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: 30 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                whileHover={{ scale: 1.05, translateY: -2 }}
                className="absolute bottom-[20%] -left-[8%] z-20 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 p-4 shadow-lg flex items-center gap-3 cursor-default"
              >
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 font-sans leading-none">10,000+</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider font-sans">Aspirants</p>
                </div>
              </motion.div>

              {/* Floating Stat Card 4: Lectures */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: 30 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                whileHover={{ scale: 1.05, translateY: -2 }}
                className="absolute bottom-[5%] -right-[5%] z-20 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 p-4 shadow-lg flex items-center gap-3 cursor-default"
              >
                <div className="p-2.5 bg-[#7C4DFF]/10 text-[#7C4DFF] rounded-xl">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900 font-sans leading-none">500+</p>
                  <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider font-sans">Video Lectures</p>
                </div>
              </motion.div>

            </motion.div>

          </div>

        </div>
      </div>
    </div>
  );
}
