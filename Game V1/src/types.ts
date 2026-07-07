/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DisasterType = 'earthquake' | 'fire' | 'flood' | 'gas_leak' | 'cyclone' | 'chemical_leak';

export interface Furniture {
  id: string;
  name: string;
  type: 'desk' | 'table' | 'shelf' | 'cabinet' | 'equipment';
  x: number; // percentage 0-100 of floor
  y: number; // percentage 0-100 of floor
  width: number;
  height: number;
  canShelterUnder: boolean;
}

export interface Door {
  id: string;
  x: number; // percentage 0-100 of floor
  y: number; // percentage 0-100 of floor
  width: number;
  height: number;
  isOpen: boolean;
  isBlocked?: boolean;
  leadsTo?: string; // room id
}

export interface Window {
  id: string;
  x: number;
  y: number;
  width: number;
}

export interface Room {
  id: string;
  name: string;
  type: 'classroom' | 'laboratory' | 'library' | 'office' | 'corridor' | 'staircase' | 'emergency_exit' | 'assembly_area' | 'playground' | 'restroom' | 'utility';
  x: number; // percentage 0-100 of floor
  y: number; // percentage 0-100 of floor
  width: number;
  height: number;
  floor: number;
  color: string;
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
}

export interface AssemblyArea {
  x: number;
  y: number;
  radius: number;
  name: string;
}

export interface SchoolLayout {
  schoolName: string;
  floorsCount: number;
  rooms: Room[];
  assemblyArea: AssemblyArea;
}

export interface Character {
  x: number; // 0 to 100 on the floor
  y: number; // 0 to 100 on the floor
  floor: number;
  health: number; // 0 - 100
  lungSafety: number; // 0 - 100 (suffocation from smoke/gas)
  isCrouching: boolean; // crawls under smoke, hides under desks
  isCoveringMouth: boolean; // filters toxins, reduces speed
  hasExtinguisher: boolean; // can put out nearby fire blocks
  extinguisherCharges: number;
  speed: number;
}

export interface Hazard {
  id: string;
  type: 'fire' | 'smoke' | 'water' | 'gas' | 'chemical' | 'debris';
  x: number; // 0-100 grid
  y: number; // 0-100 grid
  floor: number;
  radius: number;
  damagePerSec: number;
}

export interface ActionLog {
  time: number; // seconds elapsed
  description: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

export interface Objective {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface DrillResult {
  studentName: string;
  disasterType: DisasterType;
  timeTaken: number;
  healthRemaining: number;
  score: number;
  maxScore: number;
  isSuccessful: boolean;
  actions: { timestamp: number; action: string; penaltyScore: number }[];
}

export interface EvaluationData {
  summary: string;
  correctActions: string[];
  criticalMistakes: string[];
  tips: string[];
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
}
