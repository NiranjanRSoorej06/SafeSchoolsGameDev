/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { DisasterType, SchoolLayout, Objective, ActionLog, EvaluationData, DrillResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Droplet,
  Wind,
  Skull,
  ShieldAlert,
  Activity,
  Play,
  RotateCcw,
  Clock,
  Sparkles,
  FileUp,
  CheckCircle2,
  Circle,
  TrendingUp,
  AlertTriangle,
  Award,
  ChevronRight,
  School,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from './AudioEngine';

interface DrillDashboardProps {
  currentLayout: SchoolLayout;
  onLayoutChange: (layout: SchoolLayout) => void;
  drillActive: boolean;
  onStartDrill: (type: DisasterType) => void;
  onResetDrill: () => void;
  disasterType: DisasterType | null;
  objectives: Objective[];
  actionLogs: ActionLog[];
  currentTime: number;
  evaluation: EvaluationData | null;
  isEvaluating: boolean;
  score: number;
  maxScore: number;
  studentName: string;
  setStudentName: (name: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const DrillDashboard: React.FC<DrillDashboardProps> = ({
  currentLayout,
  onLayoutChange,
  drillActive,
  onStartDrill,
  onResetDrill,
  disasterType,
  objectives,
  actionLogs,
  currentTime,
  evaluation,
  isEvaluating,
  score,
  maxScore,
  studentName,
  setStudentName,
  soundEnabled,
  setSoundEnabled,
}) => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Kid-friendly Disaster configuration
  const disasters: { type: DisasterType; label: string; icon: any; emoji: string; color: string; hoverColor: string; desc: string }[] = [
    {
      type: 'earthquake',
      label: 'Earthquake Shake!',
      emoji: '🌋',
      icon: ShieldAlert,
      color: 'bg-amber-100 border-amber-300 text-amber-800',
      hoverColor: 'hover:bg-amber-200 hover:border-amber-400',
      desc: 'Ground shake rumbles! Duck under a sturdy desk and cover your head!'
    },
    {
      type: 'fire',
      label: 'Fire Fighter Escape!',
      emoji: '🔥',
      icon: Flame,
      color: 'bg-rose-100 border-rose-300 text-rose-800',
      hoverColor: 'hover:bg-rose-200 hover:border-rose-400',
      desc: 'Flames and smoke are spreading. Crouch low to crawl, and find the exit!'
    },
    {
      type: 'flood',
      label: 'Rising Flood escape!',
      emoji: '🌊',
      icon: Droplet,
      color: 'bg-sky-100 border-sky-300 text-sky-800',
      hoverColor: 'hover:bg-sky-200 hover:border-sky-400',
      desc: 'Water is rising! Climb the staircases immediately to reach higher floors!'
    },
    {
      type: 'cyclone',
      label: 'Storm Windstorm!',
      emoji: '🌀',
      icon: Wind,
      color: 'bg-teal-100 border-teal-300 text-teal-800',
      hoverColor: 'hover:bg-teal-200 hover:border-teal-400',
      desc: 'Strong winds can break windows. Hide in hallways away from glass!'
    },
    {
      type: 'gas_leak',
      label: 'Toxic Gas escape!',
      emoji: '💨',
      icon: Skull,
      color: 'bg-emerald-100 border-emerald-300 text-emerald-800',
      hoverColor: 'hover:bg-emerald-200 hover:border-emerald-400',
      desc: 'Inhalation alert! Cover your nose/mouth immediately with your face mask!'
    },
    {
      type: 'chemical_leak',
      label: 'Chemical Spill bypass!',
      emoji: '🧪',
      icon: Skull,
      color: 'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
      hoverColor: 'hover:bg-fuchsia-200 hover:border-fuchsia-400',
      desc: 'Acidic puddles are on the floor. Bypass them carefully to reach safety!'
    }
  ];

  // Preset loading trigger
  const handleLoadPreset = async (presetId: string) => {
    try {
      setUploading(true);
      setErrorMsg(null);
      const res = await fetch('/api/convert-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId })
      });
      const data = await res.json();
      if (data.success && data.data) {
        onLayoutChange(data.data);
      } else {
        throw new Error(data.message || 'Blueprint translation failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Drag and Drop files or custom uploads
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setErrorMsg(null);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        
        const response = await fetch('/api/convert-blueprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64String, fileName: file.name })
        });
        
        const data = await response.json();
        if (data.success && data.data) {
          onLayoutChange(data.data);
        } else {
          throw new Error(data.message || 'Error converting layout image.');
        }
        setUploading(false);
      };
      reader.onerror = (error) => {
        throw error;
      };
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error converting image blueprint.');
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    audioEngine.setMute(soundEnabled);
  };

  return (
    <div className="flex flex-col gap-6 h-full bg-white border-4 border-sky-100 p-6 rounded-3xl shadow-lg overflow-y-auto max-h-[85vh] scrollbar-thin">
      
      {/* Platform Title */}
      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
        <div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 font-sans text-xs rounded-full font-black uppercase tracking-wider">
            🏫 HERO HQ
          </span>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight font-display mt-1">
            Safety Mission Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Practice and learn life-saving drills!</p>
        </div>
        
        <button
          onClick={toggleSound}
          className={`p-3 rounded-2xl border-2 transition cursor-pointer shadow-sm ${
            soundEnabled 
              ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' 
              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
          }`}
          title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {/* STEP 1: Student Information & Blueprint Upload */}
      {!drillActive && (
        <div className="flex flex-col gap-6">
          {/* Hero Name Input */}
          <div className="bg-amber-50/50 p-4 border-2 border-amber-100 rounded-2xl">
            <label className="text-xs font-black text-amber-800 uppercase tracking-wider block mb-2 font-display">
              🦸 1. ENTER YOUR HERO NAME
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Super Explorer (Grade 5)"
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 text-slate-800 text-sm rounded-xl focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition font-bold shadow-sm"
            />
          </div>

          {/* School Layout Selector */}
          <div className="bg-sky-50/50 p-4 border-2 border-sky-100 rounded-2xl">
            <label className="text-xs font-black text-sky-800 uppercase tracking-wider block mb-2.5 font-display">
              🏫 2. CHOOSE YOUR SCHOOL MAP
            </label>
            
            {/* Presets Selection */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => handleLoadPreset('preset_1')}
                className={`py-3 px-3 border-2 rounded-2xl text-left transition cursor-pointer text-xs flex flex-col justify-between h-24 shadow-sm ${
                  currentLayout.schoolName.includes('Oakwood')
                    ? 'bg-sky-100 border-sky-400 text-sky-900'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">📚</span>
                <div>
                  <span className="font-black block text-xs tracking-tight font-display">Oakwood High</span>
                  <span className="text-[10px] opacity-75 font-medium">2 Floors, Lab</span>
                </div>
              </button>

              <button
                onClick={() => handleLoadPreset('preset_2')}
                className={`py-3 px-3 border-2 rounded-2xl text-left transition cursor-pointer text-xs flex flex-col justify-between h-24 shadow-sm ${
                  currentLayout.schoolName.includes('Marie')
                    ? 'bg-sky-100 border-sky-400 text-sky-900'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">🧪</span>
                <div>
                  <span className="font-black block text-xs tracking-tight font-display">Curie Science</span>
                  <span className="text-[10px] opacity-75 font-medium">1 Floor, Lab</span>
                </div>
              </button>

              <button
                onClick={() => handleLoadPreset('preset_3')}
                className={`py-3 px-3 border-2 rounded-2xl text-left transition cursor-pointer text-xs flex flex-col justify-between h-24 shadow-sm ${
                  currentLayout.schoolName.includes('Sunny')
                    ? 'bg-sky-100 border-sky-400 text-sky-900'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">🌳</span>
                <div>
                  <span className="font-black block text-xs tracking-tight font-display">Sunny Days</span>
                  <span className="text-[10px] opacity-75 font-medium">1 Floor, Park</span>
                </div>
              </button>
            </div>

            {/* Custom File Uploader with Gemini Image analysis (Hidable/Unclumped) */}
            <div className="border-t-2 border-sky-100/60 pt-3">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer transition"
              >
                {showAdvanced ? '🔽 Hide Map Scanner' : '🗺️ Advanced: Scan Custom Map Image'}
              </button>
              
              {showAdvanced && (
                <div
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 border-2 border-dashed border-sky-200 hover:border-sky-400 bg-white p-4 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 shadow-inner"
                >
                  <FileUp className="w-6 h-6 text-sky-500 animate-bounce" />
                  <div className="text-xs text-slate-700 font-bold font-display uppercase tracking-wider">Drag & Drop School Blueprint</div>
                  <div className="text-[10px] text-slate-400 font-sans">Gemini AI will convert the drawing to interactive rooms!</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2.5 mt-3 p-3 bg-sky-50 border-2 border-sky-100 rounded-xl text-sky-700 text-xs shadow-sm">
                <Sparkles className="w-5 h-5 text-sky-500 animate-spin" />
                <span className="font-bold">Gemini AI is generating your safety maze...</span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-50 border-2 border-rose-100 text-rose-600 rounded-xl text-xs font-bold">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {/* STEP 2: Drill Launcher */}
          <div>
            <label className="text-xs font-black text-rose-800 uppercase tracking-wider block mb-3 font-display">
              🚀 3. START A SAFETY QUEST
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {disasters.map((dis) => {
                const Icon = dis.icon;
                return (
                  <button
                    key={dis.type}
                    onClick={() => onStartDrill(dis.type)}
                    className={`flex flex-col gap-2 p-4 border-2 rounded-2xl text-left transition cursor-pointer shadow-sm ${dis.color} ${dis.hoverColor}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-2xl">{dis.emoji}</span>
                      <div className="p-1.5 bg-white/60 rounded-xl shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <span className="font-black block font-display tracking-wide text-xs">{dis.label}</span>
                      <span className="text-[11px] opacity-90 mt-1 block leading-relaxed font-sans font-medium line-clamp-3">
                        {dis.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Active Drill Dashboard HUD */}
      {drillActive && (
        <div className="flex flex-col gap-6">
          {/* Active status card */}
          <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
              </span>
              <div>
                <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block font-sans">
                  MISSION STARTED 🚨
                </span>
                <span className="text-base font-black text-rose-900 capitalize font-display">
                  {disasterType?.replace('_', ' ')} Escape!
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Clock Timer */}
              <div className="flex items-center gap-1.5 font-mono text-sm font-black text-rose-800 bg-white px-3 py-1.5 border-2 border-rose-200 rounded-xl shadow-sm">
                <Clock className="w-4 h-4 text-rose-500 animate-spin-slow" />
                <span>{currentTime}s</span>
              </div>

              {/* Reset button */}
              <button
                onClick={onResetDrill}
                className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border-2 border-slate-200 transition cursor-pointer shadow-sm"
                title="Cancel Drill"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drill Objectives checklist */}
          <div className="p-5 bg-amber-50/50 border-2 border-amber-100 rounded-2xl flex flex-col gap-4">
            <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5 font-display">
              🎯 MY SAFETY QUESTS
            </h4>
            <div className="flex flex-col gap-3">
              {objectives.map(obj => (
                <div key={obj.id} className="flex items-start gap-3 text-sm">
                  {obj.isCompleted ? (
                    <div className="p-0.5 bg-emerald-100 border border-emerald-300 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                  ) : (
                    <Circle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className={`font-sans font-bold leading-relaxed ${obj.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {obj.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Incident Chronological Logs Feed */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest font-display">
              📖 MY SAFETY ADVENTURE DIARY
            </h4>
            <div className="bg-[#fefcf0] border-2 border-amber-100 p-4 rounded-2xl h-44 overflow-y-auto flex flex-col gap-2 font-mono text-xs text-slate-600 shadow-inner">
              {actionLogs.slice().reverse().map((log, index) => {
                let color = 'text-slate-600';
                let icon = '✏️';
                if (log.type === 'success') { color = 'text-emerald-700 font-bold'; icon = '⭐'; }
                if (log.type === 'warning') { color = 'text-amber-700 font-bold'; icon = '⚠️'; }
                if (log.type === 'danger') { color = 'text-rose-700 font-black'; icon = '🚨'; }
                
                return (
                  <div key={index} className="flex items-start gap-1.5 leading-relaxed">
                    <span className="text-slate-400 shrink-0">[{log.time}s]</span>
                    <span className="shrink-0">{icon}</span>
                    <span className={color}>{log.description}</span>
                  </div>
                );
              })}
              {actionLogs.length === 0 && (
                <div className="text-slate-400 italic text-center py-12 font-sans font-bold">
                  Quest is active! Walk around the map to begin your adventure...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI DRILL EVALUATION CARD POPUP */}
      <AnimatePresence>
        {(isEvaluating || evaluation) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border-4 border-amber-200 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 scrollbar-thin text-slate-800"
            >
              {isEvaluating ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Sparkles className="w-12 h-12 text-amber-500 animate-spin" />
                  <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800 font-display">AI Safety Guide</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto font-medium">Looking at your safety actions and creating your Report Card...</p>
                  </div>
                </div>
              ) : (
                evaluation && (
                  <div className="flex flex-col gap-6">
                    {/* Evaluation Header */}
                    <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
                      <div>
                        <span className="px-3 py-1 bg-amber-100 border-2 border-amber-200 text-amber-800 text-[11px] rounded-full font-black tracking-wide">
                          🏆 MISSION REPORT CARD
                        </span>
                        <h3 className="text-2xl font-black text-slate-800 mt-2 font-display">
                          {studentName || 'Explorer'}'s Safety Report
                        </h3>
                        <p className="text-xs text-slate-500 font-bold capitalize mt-0.5">
                          Scenario: {disasterType?.replace('_', ' ')} Drill inside {currentLayout.schoolName}
                        </p>
                      </div>

                      {/* Performance Grade Badge */}
                      <div className="flex flex-col items-center justify-center bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-3.5 shadow-sm min-w-24">
                        <span className="text-[10px] text-amber-800 font-black block font-sans">GRADE</span>
                        <span className="text-4xl font-black text-amber-600 font-display">{evaluation.grade}</span>
                      </div>
                    </div>

                    {/* Safety Point Score Meter */}
                    <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-black text-sky-800 font-display">
                        <span>🌟 SAFETY SCORE POINTS</span>
                        <span>{score} / 100</span>
                      </div>
                      <div className="h-4 w-full bg-white rounded-full border-2 border-sky-200 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-sky-400 to-sky-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
                        />
                      </div>
                    </div>

                    {/* Performance Summary Text */}
                    <div className="p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-start gap-3 shadow-inner">
                      <Award className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-600 leading-relaxed font-sans font-bold">
                        <strong className="text-slate-800 block mb-1 font-display uppercase text-xs">GUIDE EVALUATION:</strong>
                        {evaluation.summary}
                      </div>
                    </div>

                    {/* Correct Protocols vs Hazards/Violations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex flex-col gap-2">
                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 font-display">
                          ⭐ AWESOME SAFETY MOVES!
                        </h4>
                        <ul className="flex flex-col gap-1.5 text-xs text-slate-600 list-inside leading-relaxed font-sans font-bold">
                          {evaluation.correctActions.map((act, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span>🌟</span> <span>{act}</span>
                            </li>
                          ))}
                          {evaluation.correctActions.length === 0 && (
                            <span className="text-slate-400 italic font-medium">No actions recorded.</span>
                          )}
                        </ul>
                      </div>

                      <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex flex-col gap-2">
                        <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5 font-display">
                          ⚠️ THINGS TO WATCH OUT NEXT TIME!
                        </h4>
                        <ul className="flex flex-col gap-1.5 text-xs text-slate-600 list-inside leading-relaxed font-sans font-bold">
                          {evaluation.criticalMistakes.map((mis, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span>⚠️</span> <span>{mis}</span>
                            </li>
                          ))}
                          {evaluation.criticalMistakes.length === 0 && (
                            <span className="text-emerald-600 italic font-bold">Perfect safety protocol! Zero mistakes! 🎉</span>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Safety Tips */}
                    <div className="p-4 bg-sky-50/50 border-2 border-sky-100 rounded-2xl flex flex-col gap-2.5">
                      <h4 className="text-xs font-black text-sky-800 uppercase tracking-widest flex items-center gap-1.5 font-display">
                        💡 ADVICE FOR NEXT ADVENTURE
                      </h4>
                      <div className="flex flex-col gap-2">
                        {evaluation.tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed font-sans font-bold">
                            <span className="text-sky-500 shrink-0">💡</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer Close/Restart */}
                    <div className="flex justify-end gap-3 border-t-2 border-slate-100 pt-4">
                      <button
                        onClick={onResetDrill}
                        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                      >
                        PLAY AGAIN! <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
