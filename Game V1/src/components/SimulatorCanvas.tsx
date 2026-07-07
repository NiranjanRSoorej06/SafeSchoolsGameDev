/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Character, Hazard, SchoolLayout, Room, Door, Furniture, DisasterType, Objective, ActionLog } from '../types';
import { Shield, Eye, Flame, Droplet, Skull, AlertOctagon, HelpCircle, Wind, Navigation, ChevronDown, ChevronUp, Map, X } from 'lucide-react';

interface SimulatorCanvasProps {
  layout: SchoolLayout;
  onLayoutChange?: React.Dispatch<React.SetStateAction<SchoolLayout>>;
  character: Character;
  setCharacter: React.Dispatch<React.SetStateAction<Character>>;
  hazards: Hazard[];
  setHazards: React.Dispatch<React.SetStateAction<Hazard[]>>;
  drillActive: boolean;
  disasterType: DisasterType | null;
  onAction: (desc: string, type: 'info' | 'success' | 'warning' | 'danger', penalty?: number) => void;
  objectives: Objective[];
  completeObjective: (id: string) => void;
  currentTime: number;
  actionLogs: ActionLog[];
}

export const SimulatorCanvas: React.FC<SimulatorCanvasProps> = ({
  layout,
  onLayoutChange,
  character,
  setCharacter,
  hazards,
  setHazards,
  drillActive,
  disasterType,
  onAction,
  objectives,
  completeObjective,
  currentTime,
  actionLogs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Camera state - set starting zoom higher for a closer gameplay feel
  const [camera, setCamera] = useState({ x: 50, y: 50, zoom: 4.5, targetZoom: 4.5 });
  const [keyboard, setKeyboard] = useState<Record<string, boolean>>({});
  const [joystickActive, setJoystickActive] = useState<string | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);
  const [mapViewFloor, setMapViewFloor] = useState(character.floor);

  useEffect(() => {
    if (showFullMap) {
      setMapViewFloor(character.floor);
    }
  }, [showFullMap, character.floor]);
  
  // Synchronization refs for perfect high-frequency physics and input handling
  const characterRef = useRef(character);
  const hazardsRef = useRef(hazards);
  const drillActiveRef = useRef(drillActive);
  const disasterTypeRef = useRef(disasterType);
  const cameraRef = useRef(camera);
  const keyboardRef = useRef<Record<string, boolean>>({});
  const joystickActiveRef = useRef<string | null>(null);
  const layoutRef = useRef(layout);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => { characterRef.current = character; }, [character]);
  useEffect(() => { hazardsRef.current = hazards; }, [hazards]);
  useEffect(() => { drillActiveRef.current = drillActive; }, [drillActive]);
  useEffect(() => { disasterTypeRef.current = disasterType; }, [disasterType]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { keyboardRef.current = keyboard; }, [keyboard]);
  useEffect(() => { joystickActiveRef.current = joystickActive; }, [joystickActive]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  
  // Animation frames & particles
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number; size: number; floor: number }>>([]);
  const lastTimeRef = useRef<number>(0);
  const movementAngleRef = useRef<number>(0);
  const isWalkingRef = useRef<boolean>(false);
  const walkCycleRef = useRef<number>(0);
  const cameraShakeRef = useRef({ x: 0, y: 0 });

  // Update canvas sizing dynamically
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = Math.max(container.clientHeight, 420);
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Initialize character position when school layout changes (only when a new map/layout is loaded)
  useEffect(() => {
    // Find the first classroom in layout to spawn player safely
    const initialClassroom = layout.rooms.find(r => r.type === 'classroom') || layout.rooms[0];
    if (initialClassroom) {
      setCharacter(prev => ({
        ...prev,
        x: initialClassroom.x + initialClassroom.width / 2,
        y: initialClassroom.y + initialClassroom.height / 2,
        floor: initialClassroom.floor,
        health: 100,
        lungSafety: 100,
        isCrouching: false,
        isCoveringMouth: false,
        hasExtinguisher: false,
      }));
      setCamera(prev => ({
        ...prev,
        x: initialClassroom.x + initialClassroom.width / 2,
        y: initialClassroom.y + initialClassroom.height / 2,
      }));
    }
  }, [layout.schoolName, setCharacter]);

  // Handle door opening/closing manually
  const handleDoorToggle = () => {
    const char = characterRef.current;
    const currentLayout = layoutRef.current;
    let closestDoor: { door: any, room: any } | null = null;
    let minDistance = Infinity;

    currentLayout.rooms.forEach(room => {
      if (room.floor === char.floor) {
        room.doors.forEach(door => {
          const distToPlayer = Math.sqrt(Math.pow(door.x - char.x, 2) + Math.pow(door.y - char.y, 2));
          if (distToPlayer < 18 && distToPlayer < minDistance) {
            minDistance = distToPlayer;
            closestDoor = { door, room };
          }
        });
      }
    });

    if (closestDoor) {
      const { door, room } = closestDoor;
      const nextIsOpen = !door.isOpen;
      
      if (onLayoutChange) {
        onLayoutChange(prev => {
          const updatedRooms = prev.rooms.map(r => {
            if (r.id === room.id) {
              return {
                ...r,
                doors: r.doors.map(d => {
                  if (d.id === door.id) {
                    return { ...d, isOpen: nextIsOpen };
                  }
                  return d;
                })
              };
            }
            return r;
          });
          return { ...prev, rooms: updatedRooms };
        });
      } else {
        door.isOpen = nextIsOpen;
      }

      onAction(`${nextIsOpen ? "Opened" : "Closed"} door: ${room.name}`, nextIsOpen ? "success" : "info");
      if (nextIsOpen) completeObjective("exit_classroom");
    } else {
      onAction("No door nearby to open/close! Get closer to a doorway first.", "warning");
    }
  };

  // Handle Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key) || e.key === ' ') {
        // Prevent browser scrolling
        e.preventDefault();
      }
      keyboardRef.current[key] = true;
      setKeyboard(prev => ({ ...prev, [key]: true }));

      // Handle hotkeys
      if ((e.ctrlKey || e.metaKey) && key === 'm') {
        e.preventDefault();
        setShowFullMap(prev => !prev);
        return;
      }

      if (key === 'c') {
        setCharacter(prev => {
          const nextCrouch = !prev.isCrouching;
          onAction(nextCrouch ? "Crouched down (staying low to avoid smoke and debris)" : "Stood up", "info");
          return { ...prev, isCrouching: nextCrouch };
        });
      }
      if (key === 'm') {
        setCharacter(prev => {
          const nextCover = !prev.isCoveringMouth;
          onAction(nextCover ? "Covered nose & mouth to filter dangerous gases" : "Uncovered nose & mouth", "info");
          return { ...prev, isCoveringMouth: nextCover };
        });
      }
      if (key === 'e') {
        // Extinguish action
        handleExtinguish();
      }
      if (key === 'f') {
        // Open/Close closest door
        handleDoorToggle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keyboardRef.current[key] = false;
      setKeyboard(prev => ({ ...prev, [key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onAction, setCharacter, onLayoutChange, completeObjective]);

  // Trigger extinguish action in front of character
  const handleExtinguish = () => {
    const char = characterRef.current;
    if (!char.hasExtinguisher) {
      onAction("You don't have an extinguisher! Search administrative offices or corridors for one.", "warning");
      return;
    }
    if (char.extinguisherCharges <= 0) {
      onAction("Your extinguisher is empty!", "warning");
      return;
    }

    setCharacter(prev => ({ ...prev, extinguisherCharges: prev.extinguisherCharges - 1 }));
    onAction("Discharged extinguisher on nearby hazards!", "success");

    // Clear fires within a radius
    setHazards(prev => {
      const beforeCount = prev.length;
      const after = prev.filter(h => {
        if (h.floor !== char.floor || h.type !== 'fire') return true;
        const dx = h.x - char.x;
        const dy = h.y - char.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist > 15; // Extinguisher radius
      });
      const cleared = beforeCount - after.length;
      if (cleared > 0) {
        onAction(`Successfully put out ${cleared} fires!`, "success");
        completeObjective("extinguish_fire");
      }
      return after;
    });

    // Spawn visual fire-extinguishing white cloud particles
    for (let i = 0; i < 20; i++) {
      const ang = movementAngleRef.current + (Math.random() - 0.5) * 1.2;
      const spd = 2 + Math.random() * 4;
      particlesRef.current.push({
        x: char.x,
        y: char.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: 'rgba(235, 250, 255, 0.8)',
        life: 0,
        maxLife: 20 + Math.random() * 15,
        size: 4 + Math.random() * 6,
        floor: char.floor,
      });
    }
  };

  // Check collision against walls, furniture, and room boundaries
  const validateMovement = (currX: number, currY: number, nextX: number, nextY: number, floor: number): { x: number; y: number } => {
    // 100x100 grid bounds
    if (nextX < 2) nextX = 2;
    if (nextX > 98) nextX = 98;
    if (nextY < 2) nextY = 2;
    if (nextY > 98) nextY = 98;

    const currentRooms = layout.rooms.filter(r => r.floor === floor);

    const isInsideRoom = (px: number, py: number, r: Room): boolean => {
      return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
    };

    // Helper to find any door on the current floor near target coordinates
    const findDoorNear = (tx: number, ty: number, maxDist: number = 5.0) => {
      for (const room of currentRooms) {
        for (const d of room.doors) {
          const dist = Math.sqrt(Math.pow(tx - d.x, 2) + Math.pow(ty - d.y, 2));
          if (dist < maxDist) {
            return d;
          }
        }
      }
      return null;
    };

    // Find current room
    const currentRoom = currentRooms.find(r => isInsideRoom(currX, currY, r));
    // Find destination room
    const destRoom = currentRooms.find(r => isInsideRoom(nextX, nextY, r));

    // Case 1: Moving within the exact same room
    if (currentRoom && destRoom && currentRoom.id === destRoom.id) {
      return checkFurnitureCollision(nextX, nextY, currentRoom);
    }

    // Case 2: Leaving a room
    if (currentRoom) {
      const isStillInsideCurrent = isInsideRoom(nextX, nextY, currentRoom);
      const doorNear = findDoorNear(nextX, nextY, 5.0);

      if (!isStillInsideCurrent) {
        // Must cross an open, unblocked door in currentRoom, or any open door near target
        const doorCrossed = currentRoom.doors.find(door => {
          const distToDoor = Math.sqrt(Math.pow(nextX - door.x, 2) + Math.pow(nextY - door.y, 2));
          return distToDoor < 5.0 && door.isOpen && !door.isBlocked;
        }) || (doorNear && doorNear.isOpen && !doorNear.isBlocked);

        if (!doorCrossed) {
          // Collide back into current room boundaries
          const boundX = Math.max(currentRoom.x + 1.2, Math.min(currentRoom.x + currentRoom.width - 1.2, nextX));
          const boundY = Math.max(currentRoom.y + 1.2, Math.min(currentRoom.y + currentRoom.height - 1.2, nextY));
          return checkFurnitureCollision(boundX, boundY, currentRoom);
        }
      }

      // If we crossed the exit door, verify entry if destRoom is defined and has doors
      if (destRoom && destRoom.id !== currentRoom.id) {
        if (destRoom.doors.length > 0) {
          const enterDoor = destRoom.doors.find(door => {
            const distToDoor = Math.sqrt(Math.pow(nextX - door.x, 2) + Math.pow(nextY - door.y, 2));
            return distToDoor < 5.0 && door.isOpen && !door.isBlocked;
          }) || (doorNear && doorNear.isOpen && !doorNear.isBlocked);

          if (!enterDoor) {
            // Block entry, stay in previous room position or gap near door
            return { x: currX, y: currY };
          }
        }
        completeObjective("exit_classroom");
        return checkFurnitureCollision(nextX, nextY, destRoom);
      }

      if (!isStillInsideCurrent) {
        completeObjective("exit_classroom");
      }
      return { x: nextX, y: nextY };
    }

    // Case 3: Entering a room from outside
    if (!currentRoom && destRoom) {
      const doorNear = findDoorNear(nextX, nextY, 5.0);

      if (destRoom.doors.length > 0) {
        const doorCrossed = destRoom.doors.find(door => {
          const distToDoor = Math.sqrt(Math.pow(nextX - door.x, 2) + Math.pow(nextY - door.y, 2));
          return distToDoor < 5.0 && door.isOpen && !door.isBlocked;
        }) || (doorNear && doorNear.isOpen && !doorNear.isBlocked);

        if (!doorCrossed) {
          return { x: currX, y: currY }; // Block entry
        }
      }

      completeObjective("exit_classroom");
      return checkFurnitureCollision(nextX, nextY, destRoom);
    }

    // Case 4: Outside to Outside
    return { x: nextX, y: nextY };
  };

  // Helper for furniture collision checking with sliding
  const checkFurnitureCollision = (px: number, py: number, room: Room): { x: number; y: number } => {
    for (const item of room.furniture) {
      if (item.canShelterUnder && characterRef.current.isCrouching) {
        continue;
      }

      const buffer = 1.2;
      if (
        px >= item.x - buffer && px <= item.x + item.width + buffer &&
        py >= item.y - buffer && py <= item.y + item.height + buffer
      ) {
        // Slide along edges
        const dx = px - (item.x + item.width / 2);
        const dy = py - (item.y + item.height / 2);
        if (Math.abs(dx) > Math.abs(dy)) {
          return { x: dx > 0 ? item.x + item.width + buffer : item.x - buffer, y: py };
        } else {
          return { x: px, y: dy > 0 ? item.y + item.height + buffer : item.y - buffer };
        }
      }
    }
    return { x: px, y: py };
  };

  // Click-To-Move pathing or direct steering on canvas clicks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Correctly scale coordinates to canvas's internal size regardless of CSS styling dimensions
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Convert pixel coordinates back to 0-100 floor layout percentage coordinates
    const viewWidth = canvas.width;
    const viewHeight = canvas.height;
    
    const char = characterRef.current;
    const cam = cameraRef.current;

    // Reverse camera zoom translation
    const worldX = ((clickX - viewWidth / 2 - cameraShakeRef.current.x) / cam.zoom) + cam.x;
    const worldY = ((clickY - viewHeight / 2 - cameraShakeRef.current.y) / cam.zoom) + cam.y;

    // Direct interact checks: door toggles or picking items
    let interacted = false;

    // 1. Check if user clicked a closed door to open it!
    layout.rooms.forEach(room => {
      if (room.floor === char.floor) {
        room.doors.forEach(door => {
          const dx = door.x - worldX;
          const dy = door.y - worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // More forgiving hit-box tolerance (6.0 units instead of 4.0)
          if (dist < 6) {
            // Check proximity
            const distToPlayer = Math.sqrt(Math.pow(door.x - char.x, 2) + Math.pow(door.y - char.y, 2));
            if (distToPlayer > 18) {
              onAction("Get closer to interact with this door!", "warning");
            } else {
              const nextIsOpen = !door.isOpen;
              
              // Handle immutable React state update in parent if available, or direct mutation
              if (onLayoutChange) {
                onLayoutChange(prev => {
                  const updatedRooms = prev.rooms.map(r => {
                    if (r.id === room.id) {
                      return {
                        ...r,
                        doors: r.doors.map(d => {
                          if (d.id === door.id) {
                            return { ...d, isOpen: nextIsOpen };
                          }
                          return d;
                        })
                      };
                    }
                    return r;
                  });
                  return { ...prev, rooms: updatedRooms };
                });
              } else {
                door.isOpen = nextIsOpen;
              }

              onAction(`${nextIsOpen ? "Opened" : "Closed"} door: ${room.name}`, nextIsOpen ? "success" : "info");
              if (nextIsOpen) completeObjective("exit_classroom");
            }
            interacted = true;
          }
        });
      }
    });

    // 2. Check if user clicked an extinguisher item to grab it!
    if (!interacted && !char.hasExtinguisher) {
      // Spot extinguisher nearby
      layout.rooms.forEach(room => {
        if (room.floor === char.floor) {
          room.furniture.forEach(item => {
            if (item.name.toLowerCase().includes('cabinet') || item.name.toLowerCase().includes('locker') || item.type === 'equipment') {
              const dx = item.x + item.width / 2 - worldX;
              const dy = item.y + item.height / 2 - worldY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 5) {
                const pDist = Math.sqrt(Math.pow(item.x - char.x, 2) + Math.pow(item.y - char.y, 2));
                if (pDist < 15) {
                  setCharacter(prev => ({ ...prev, hasExtinguisher: true, extinguisherCharges: 5 }));
                  onAction("Found safety Extinguisher inside cabinet! Press 'E' to discharge on fire.", "success");
                  completeObjective("extinguish_fire");
                } else {
                  onAction("Move closer to examine this safety cabinet!", "warning");
                }
                interacted = true;
              }
            }
          });
        }
      });
    }

    if (!interacted) {
      // Just set direct keyboard steering direction towards the click
      const dx = worldX - char.x;
      const dy = worldY - char.y;
      movementAngleRef.current = Math.atan2(dy, dx);
      
      // Smooth step towards target
      const stepDist = Math.min(10, Math.sqrt(dx * dx + dy * dy));
      const nextX = char.x + Math.cos(movementAngleRef.current) * stepDist;
      const nextY = char.y + Math.sin(movementAngleRef.current) * stepDist;
      
      const validated = validateMovement(char.x, char.y, nextX, nextY, char.floor);
      setCharacter(prev => ({ ...prev, x: validated.x, y: validated.y }));
    }
  };

  // Main game loop (Animation, Physics, Hazard Damage, Screen Shake, Camera Interpolation)
  useEffect(() => {
    let animId: number;

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const kb = keyboardRef.current;
      const joy = joystickActiveRef.current;
      const char = characterRef.current;
      const drillAct = drillActiveRef.current;
      const disType = disasterTypeRef.current;
      const cam = cameraRef.current;

      // 1. Calculate movement vectors from keys
      let dx = 0;
      let dy = 0;

      if (kb['w'] || kb['arrowup']) dy -= 1;
      if (kb['s'] || kb['arrowdown']) dy += 1;
      if (kb['a'] || kb['arrowleft']) dx -= 1;
      if (kb['d'] || kb['arrowright']) dx += 1;

      // Handle virtual touch controls
      if (joy === 'up') dy -= 1;
      if (joy === 'down') dy += 1;
      if (joy === 'left') dx -= 1;
      if (joy === 'right') dx += 1;

      const isWalking = dx !== 0 || dy !== 0;
      isWalkingRef.current = isWalking;

      if (isWalking) {
        movementAngleRef.current = Math.atan2(dy, dx);
        walkCycleRef.current += dt * 10;

        // Crouch speed penality or nose-cover speed penality
        let speedMult = 1.0;
        if (char.isCrouching) speedMult *= 0.5;
        if (char.isCoveringMouth) speedMult *= 0.8;

        const moveSpeed = char.speed * speedMult * dt;
        const nextX = char.x + Math.cos(movementAngleRef.current) * moveSpeed;
        const nextY = char.y + Math.sin(movementAngleRef.current) * moveSpeed;

        const validated = validateMovement(char.x, char.y, nextX, nextY, char.floor);
        
        setCharacter(prev => {
          // Inside safe assembly area?
          const dxToAssembly = validated.x - layout.assemblyArea.x;
          const dyToAssembly = validated.y - layout.assemblyArea.y;
          const distToAssembly = Math.sqrt(dxToAssembly * dxToAssembly + dyToAssembly * dyToAssembly);
          if (distToAssembly <= layout.assemblyArea.radius && prev.floor === 1) {
            completeObjective("reach_assembly");
          }

          // Inside a sturdy table while earthquake is active?
          const activeRoom = layout.rooms.find(r =>
            r.floor === prev.floor &&
            validated.x >= r.x && validated.x <= r.x + r.width &&
            validated.y >= r.y && validated.y <= r.y + r.height
          );

          if (activeRoom && prev.isCrouching) {
            const underFurniture = activeRoom.furniture.find(f => {
              if (!f.canShelterUnder) return false;
              const buffer = 1.0;
              return (
                validated.x >= f.x - buffer && validated.x <= f.x + f.width + buffer &&
                validated.y >= f.y - buffer && validated.y <= f.y + f.height + buffer
              );
            });
            if (underFurniture) {
              completeObjective("crouch_table");
            }
          }

          return {
            ...prev,
            x: validated.x,
            y: validated.y,
          };
        });
      }

      // 2. Handle Camera Smooth Follow (Lerping)
      setCamera(prev => {
        const lerpFactor = 0.08;
        const targetX = characterRef.current.x;
        const targetY = characterRef.current.y;
        
        // Zoom in when entering small rooms, zoom out when outdoors/corridors
        const activeRoom = layout.rooms.find(r =>
          r.floor === characterRef.current.floor &&
          characterRef.current.x >= r.x && characterRef.current.x <= r.x + r.width &&
          characterRef.current.y >= r.y && characterRef.current.y <= r.y + r.height
        );
        
        const canvas = canvasRef.current;
        const width = canvas ? canvas.width : 800;
        const height = canvas ? canvas.height : 500;
        const scaleFactor = canvas ? Math.max(1.3, canvas.width / 520) : 1.3;

        // Significantly increased zoom levels to make rooms and actions enlarged and crystal clear
        let idealZoom = 9.5 * scaleFactor; // very close, immersive player follow zoom
        if (!activeRoom) idealZoom = 6.2 * scaleFactor; // zoomed wider perspective outside (assembly area)
        else if (activeRoom.type === 'corridor') idealZoom = 7.8 * scaleFactor; // nice balance in hallways

        const nextZoom = prev.zoom + (idealZoom - prev.zoom) * lerpFactor;

        // Calculate half of the screen in world coordinates at the current zoom
        const halfWorldWidth = (width / nextZoom) / 2;
        const halfWorldHeight = (height / nextZoom) / 2;

        // Clamping to map bounds (x: 0 to 100, y: 0 to 105) to eliminate the surrounding dark slate border space
        const minCamX = Math.max(halfWorldWidth, 10);
        const maxCamX = Math.min(100 - halfWorldWidth, 90);
        const minCamY = Math.max(halfWorldHeight, 10);
        const maxCamY = Math.min(105 - halfWorldHeight, 95);

        let clampedX = targetX;
        let clampedY = targetY;

        // If viewport is smaller than the map, clamp the camera. Otherwise, center the map.
        if (100 > 2 * halfWorldWidth) {
          clampedX = Math.max(minCamX, Math.min(maxCamX, targetX));
        } else {
          clampedX = 50;
        }

        if (105 > 2 * halfWorldHeight) {
          clampedY = Math.max(minCamY, Math.min(maxCamY, targetY));
        } else {
          clampedY = 52.5;
        }

        return {
          ...prev,
          x: prev.x + (clampedX - prev.x) * lerpFactor,
          y: prev.y + (clampedY - prev.y) * lerpFactor,
          zoom: nextZoom,
        };
      });

      // 3. Process Earthquake Camera Shake
      if (drillAct && disType === 'earthquake') {
        const t = timestamp / 1000;
        // Periodic rumble spikes
        const intensity = 3.0 * (Math.sin(t * 4.5) * 0.5 + 0.5);
        cameraShakeRef.current = {
          x: (Math.random() - 0.5) * intensity * cam.zoom,
          y: (Math.random() - 0.5) * intensity * cam.zoom,
        };
        // Shaking objective
        if (characterRef.current.isCrouching) {
          completeObjective("crouch_table");
        }
      } else {
        cameraShakeRef.current = { x: 0, y: 0 };
      }

      // 4. Update and Draw Particles
      updateParticles(dt);

      // 5. Draw Canvas Frame
      drawFrame();

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [layout, onAction, completeObjective, setCharacter]);

  // Update dynamic particles
  const updateParticles = (dt: number) => {
    const p = particlesRef.current;
    const drillAct = drillActiveRef.current;
    const disType = disasterTypeRef.current;
    const haz = hazardsRef.current;
    const char = characterRef.current;
    
    // Spawn ambient hazard particles
    if (drillAct && disType) {
      haz.forEach(h => {
        if (h.floor !== char.floor) return;
        
        // Spawn based on type
        if (h.type === 'fire' && Math.random() < 0.25) {
          p.push({
            x: h.x + (Math.random() - 0.5) * h.radius,
            y: h.y + (Math.random() - 0.5) * h.radius,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5 - Math.random() * 2,
            color: Math.random() < 0.6 ? '#f97316' : '#ef4444', // Orange or red
            life: 0,
            maxLife: 30 + Math.random() * 20,
            size: 3 + Math.random() * 5,
            floor: h.floor,
          });
        }
        if (h.type === 'smoke' && Math.random() < 0.15) {
          p.push({
            x: h.x + (Math.random() - 0.5) * h.radius,
            y: h.y + (Math.random() - 0.5) * h.radius,
            vx: (Math.random() - 0.5) * 1.0,
            vy: -0.5 - Math.random() * 1.0,
            color: 'rgba(75, 85, 99, 0.4)', // transparent gray
            life: 0,
            maxLife: 40 + Math.random() * 30,
            size: 6 + Math.random() * 10,
            floor: h.floor,
          });
        }
        if (h.type === 'gas' && Math.random() < 0.15) {
          p.push({
            x: h.x + (Math.random() - 0.5) * h.radius,
            y: h.y + (Math.random() - 0.5) * h.radius,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            color: 'rgba(163, 230, 53, 0.3)', // chartreuse green toxic cloud
            life: 0,
            maxLife: 50 + Math.random() * 25,
            size: 5 + Math.random() * 8,
            floor: h.floor,
          });
        }
      });
    }

    // Move existing particles
    for (let i = p.length - 1; i >= 0; i--) {
      const part = p[i];
      part.x += part.vx * dt * 5;
      part.y += part.vy * dt * 5;
      part.life++;
      if (part.life >= part.maxLife) {
        p.splice(i, 1);
      }
    }
  };

  // Main rendering routine onto HTML5 Canvas
  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const char = characterRef.current;
    const cam = cameraRef.current;
    const haz = hazardsRef.current;
    const drillAct = drillActiveRef.current;
    const disType = disasterTypeRef.current;
    const lay = layoutRef.current;
    const currTime = currentTimeRef.current;

    const width = canvas.width;
    const height = canvas.height;

    interface LabelToDraw {
      text: string;
      x: number;
      y: number;
      fontSize: number;
      font: string;
      color: string;
      align: CanvasTextAlign;
      width: number;
      height: number;
    }

    const labelsToDraw: LabelToDraw[] = [];

    const resolveLabelOverlaps = (labels: LabelToDraw[]) => {
      // Sort labels primarily by y coordinate so we resolve bottom-up/top-down
      labels.sort((a, b) => a.y - b.y);

      // Perform iterative passes of Y-displacement to resolve any overlapping label boxes
      for (let pass = 0; pass < 8; pass++) {
        let adjusted = false;
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const la = labels[i];
            const lb = labels[j];

            const paddingX = 1.0;
            const paddingY = 0.8;

            const halfW_a = la.width / 2;
            const halfW_b = lb.width / 2;
            const halfH_a = la.height / 2;
            const halfH_b = lb.height / 2;

            const overlapX = Math.abs(la.x - lb.x) < (halfW_a + halfW_b + paddingX);
            const overlapY = Math.abs(la.y - lb.y) < (halfH_a + halfH_b + paddingY);

            if (overlapX && overlapY) {
              const diffY = (halfH_a + halfH_b + paddingY) - Math.abs(la.y - lb.y);
              // Displace labels vertically to resolve collision
              la.y -= diffY / 2;
              lb.y += diffY / 2;
              adjusted = true;
            }
          }
        }
        if (!adjusted) break;
      }
    };

    // Clear with premium dark background
    ctx.fillStyle = '#0f172a'; // Slate-900
    ctx.fillRect(0, 0, width, height);

    // Grid details for tactical aesthetic
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Save context for camera operations
    ctx.save();
    
    // Camera translations: Center camera on viewport and apply screen shake
    ctx.translate(width / 2 + cameraShakeRef.current.x, height / 2 + cameraShakeRef.current.y);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Draw floor grid layout
    ctx.fillStyle = '#1e293b'; // Slate-800
    ctx.fillRect(0, 0, 100, 100);

    // Draw outer boundary lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, 100, 100);

    // ---------------------------------------------------------
    // 1. RENDER ROOMS & CORRIDORS
    // ---------------------------------------------------------
    lay.rooms.forEach(room => {
      if (room.floor !== char.floor) return;

      // Draw floor colors
      ctx.fillStyle = room.color;
      ctx.fillRect(room.x, room.y, room.width, room.height);

      // Subtle floor borders
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.lineWidth = 0.25;
      ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Floor tiles effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 0.05;
      const tileSize = 4;
      for (let tx = room.x; tx < room.x + room.width; tx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(tx, room.y);
        ctx.lineTo(tx, room.y + room.height);
        ctx.stroke();
      }
      for (let ty = room.y; ty < room.y + room.height; ty += tileSize) {
        ctx.beginPath();
        ctx.moveTo(room.x, ty);
        ctx.lineTo(room.x + room.width, ty);
        ctx.stroke();
      }

      // Draw Extruded 3D Wall heights
      // Draw back wall heights (gives 2.5D architectural depth!)
      const wallHeight = 4; // Height of the wall
      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)'; // Dark shadows for side faces
      
      // Back wall (top edge)
      ctx.beginPath();
      ctx.moveTo(room.x, room.y);
      ctx.lineTo(room.x + room.width, room.y);
      ctx.lineTo(room.x + room.width, room.y - wallHeight);
      ctx.lineTo(room.x, room.y - wallHeight);
      ctx.closePath();
      ctx.fill();

      // Top ridge of the back wall
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(room.x, room.y - wallHeight, room.width, 0.1);

      // Add room labels to the queue to resolve overlaps
      labelsToDraw.push({
        text: room.name,
        x: room.x + room.width / 2,
        y: room.y + 4,
        fontSize: 2.0,
        font: 'bold 2px "Space Grotesk", Inter, sans-serif',
        color: '#0f172a',
        align: 'center',
        width: room.name.length * 1.1,
        height: 2.0
      });

      labelsToDraw.push({
        text: room.type.toUpperCase(),
        x: room.x + room.width / 2,
        y: room.y + 6,
        fontSize: 1.5,
        font: 'italic 1.5px Inter, sans-serif',
        color: '#64748b',
        align: 'center',
        width: room.type.length * 0.8,
        height: 1.5
      });
    });

    // ---------------------------------------------------------
    // 2. RENDER ASSEMBLY ZONE BEACON (OUTSIDE)
    // ---------------------------------------------------------
    if (char.floor === 1) {
      const assembly = lay.assemblyArea;
      
      // Safe area circles
      const radiusOsc = assembly.radius + Math.sin(currTime * 3) * 0.8;
      const gradient = ctx.createRadialGradient(assembly.x, assembly.y, 1, assembly.x, assembly.y, radiusOsc);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(assembly.x, assembly.y, radiusOsc, 0, Math.PI * 2);
      ctx.fill();

      // Green revolving pulse outline
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 1]);
      ctx.beginPath();
      ctx.arc(assembly.x, assembly.y, radiusOsc, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Star beacon center
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(assembly.x, assembly.y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Laser rotation sweeps
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(assembly.x, assembly.y);
      ctx.lineTo(assembly.x + Math.cos(currTime * 1.5) * radiusOsc, assembly.y + Math.sin(currTime * 1.5) * radiusOsc);
      ctx.stroke();

      // Add evacuation zone labels to queue to resolve overlaps
      labelsToDraw.push({
        text: "SAFE EVACUATION ZONE",
        x: assembly.x,
        y: assembly.y - 3,
        fontSize: 2.0,
        font: 'bold 2px "Space Grotesk", sans-serif',
        color: '#10b981',
        align: 'center',
        width: 20 * 1.1,
        height: 2.0
      });

      labelsToDraw.push({
        text: assembly.name,
        x: assembly.x,
        y: assembly.y + 3,
        fontSize: 1.3,
        font: '1.3px Inter, sans-serif',
        color: '#34d399',
        align: 'center',
        width: assembly.name.length * 0.7,
        height: 1.3
      });
    }

    // ---------------------------------------------------------
    // 3. RENDER FURNITURE (3D BOX MODELS)
    // ---------------------------------------------------------
    lay.rooms.forEach(room => {
      if (room.floor !== char.floor) return;

      room.furniture.forEach(item => {
        // Draw 3D Extruded Box
        const extHeight = item.type === 'shelf' || item.type === 'cabinet' ? 3 : 1.5;

        // Shadow under furniture
        ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.fillRect(item.x + 0.3, item.y + 0.3, item.width, item.height);

        // Side faces (shading)
        ctx.fillStyle = 'rgba(100, 116, 139, 0.8)'; // mid slate
        ctx.beginPath();
        ctx.moveTo(item.x, item.y + item.height);
        ctx.lineTo(item.x + item.width, item.y + item.height);
        ctx.lineTo(item.x + item.width, item.y + item.height - extHeight);
        ctx.lineTo(item.x, item.y + item.height - extHeight);
        ctx.closePath();
        ctx.fill();

        // Top surface (lighter)
        ctx.fillStyle = item.canShelterUnder ? '#f59e0b' : '#94a3b8'; // amber for shelter tables, slate for storage
        if (item.canShelterUnder && char.isCrouching) {
          // Glow green if sheltering under
          const buffer = 1.0;
          const isPlayerUnder = char.x >= item.x - buffer && char.x <= item.x + item.width + buffer &&
                               char.y >= item.y - buffer && char.y <= item.y + item.height + buffer;
          if (isPlayerUnder) {
            ctx.fillStyle = '#10b981'; // Green sheltering alert
          }
        }
        ctx.fillRect(item.x, item.y - extHeight, item.width, item.height);

        // Outlines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.15;
        ctx.strokeRect(item.x, item.y - extHeight, item.width, item.height);

        // Add furniture name labels to queue to resolve overlaps
        labelsToDraw.push({
          text: item.name,
          x: item.x + item.width / 2,
          y: item.y - extHeight + item.height / 2 + 0.5,
          fontSize: 1.1,
          font: 'bold 1.1px Inter, sans-serif',
          color: '#1e293b',
          align: 'center',
          width: item.name.length * 0.6,
          height: 1.1
        });
      });
    });

    // ---------------------------------------------------------
    // 4. RENDER DOORS (INDICATING NAVIGATION PATHS)
    // ---------------------------------------------------------
    lay.rooms.forEach(room => {
      if (room.floor !== char.floor) return;

      room.doors.forEach(door => {
        // Draw Door panel
        ctx.save();
        ctx.translate(door.x, door.y);

        if (door.isOpen) {
          // Open door swing angle
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'; // green path
          ctx.lineWidth = 0.2;
          ctx.setLineDash([1, 1]);
          ctx.beginPath();
          ctx.arc(0, 0, door.width || 3, 0, Math.PI / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#10b981';
          ctx.fillRect(-0.2, -0.2, 0.5, door.width || 3);
        } else {
          // Closed door block
          ctx.fillStyle = '#ef4444'; // Red locked or shut indicator
          ctx.fillRect(-(door.width || 3) / 2, -0.5, door.width || 3, 1);
          
          // Little handles
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(-0.4, -0.8, 0.8, 0.3);
        }

        ctx.restore();
      });
    });

    // ---------------------------------------------------------
    // 5. RENDER ACTIVE DRILL HAZARD EFFECTS
    // ---------------------------------------------------------
    if (drillAct && disType) {
      haz.forEach(h => {
        if (h.floor !== char.floor) return;

        ctx.save();
        // Core glowing hazard rings
        const glowRad = h.radius + Math.sin(currTime * 5 + h.x) * 1.5;
        const hazGrad = ctx.createRadialGradient(h.x, h.y, 1, h.x, h.y, glowRad);
        
        let colOuter = 'rgba(239, 68, 68, 0.01)';
        let colInner = 'rgba(239, 68, 68, 0.35)';
        if (h.type === 'water') {
          colInner = 'rgba(59, 130, 246, 0.4)';
          colOuter = 'rgba(59, 130, 246, 0.02)';
        } else if (h.type === 'gas' || h.type === 'chemical') {
          colInner = 'rgba(132, 204, 22, 0.4)'; // Lime green gas/chemicals
          colOuter = 'rgba(132, 204, 22, 0.02)';
        }

        hazGrad.addColorStop(0, colInner);
        hazGrad.addColorStop(1, colOuter);

        ctx.fillStyle = hazGrad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, glowRad, 0, Math.PI * 2);
        ctx.fill();

        // Alert icons on hazards
        ctx.fillStyle = h.type === 'water' ? '#3b82f6' : h.type === 'fire' ? '#f97316' : '#a3e635';
        ctx.beginPath();
        ctx.arc(h.x, h.y, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    // ---------------------------------------------------------
    // 6. RENDER ACTIVE PARTICLES
    // ---------------------------------------------------------
    particlesRef.current.forEach(part => {
      if (part.floor !== char.floor) return;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size / cam.zoom, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---------------------------------------------------------
    // 7. RENDER PLAYABLE STUDENT CHARACTER (3RD PERSON HUMAN)
    // ---------------------------------------------------------
    ctx.save();
    ctx.translate(char.x, char.y);

    // Subtle footprint tracks or shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Direction rotation
    ctx.rotate(movementAngleRef.current);

    // Walking leg cycle swing
    const legSwing = isWalkingRef.current ? Math.sin(walkCycleRef.current) * 0.8 : 0;

    // Draw alternate shoes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-0.4 + legSwing * 0.3, -0.9, 0.6, 0.4);
    ctx.fillRect(-0.4 - legSwing * 0.3, 0.5, 0.6, 0.4);

    // Main student backpack
    ctx.fillStyle = '#2563eb'; // blue bagpack
    ctx.fillRect(-1.2, -0.6, 0.6, 1.2);

    // Character body / protective clothing
    ctx.fillStyle = char.isCrouching ? '#d97706' : '#475569'; // Amber helmet if hiding, grey jacket otherwise
    ctx.beginPath();
    ctx.arc(-0.1, 0, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Safety Helmet or hair
    ctx.fillStyle = '#f59e0b'; // Amber hard helmet
    ctx.beginPath();
    ctx.arc(0.1, 0, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Protective wet mask indicator (white shield)
    if (char.isCoveringMouth) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0.4, -0.4, 0.4, 0.8);
    }

    // Face / Eyes direction
    ctx.fillStyle = '#fee2e2';
    ctx.beginPath();
    ctx.arc(0.5, 0, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0.6, -0.2, 0.15, 0.15);
    ctx.fillRect(0.6, 0.1, 0.15, 0.15);

    // If holding an extinguisher, draw a red cylinders in hands
    if (char.hasExtinguisher) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0.3, -0.8, 0.4, 0.4); // Red extinguisher nozzle
    }

    ctx.restore();

    // Overhead student status indicators
    const statusText = char.isCrouching ? "DUCKED & PROTECTED" : "STUDENT";
    labelsToDraw.push({
      text: statusText,
      x: char.x,
      y: char.y - 4,
      fontSize: char.isCrouching ? 1.5 : 1.6,
      font: char.isCrouching ? 'bold 1.5px Inter, sans-serif' : 'bold 1.6px "Space Grotesk", sans-serif',
      color: char.isCrouching ? '#f59e0b' : '#38bdf8',
      align: 'center',
      width: statusText.length * 0.95,
      height: 1.6
    });

    // Proximity indicator for stairs if on Stairwell room
    const currentRoom = lay.rooms.find(r =>
      r.floor === char.floor &&
      char.x >= r.x && char.x <= r.x + r.width &&
      char.y >= r.y && char.y <= r.y + r.height
    );

    if (currentRoom && currentRoom.type === 'staircase') {
      const targetFloor = char.floor === 1 ? 2 : 1;
      const stairsMsg = `Press stairs to enter Floor ${targetFloor}`;
      labelsToDraw.push({
        text: stairsMsg,
        x: char.x,
        y: char.y + 4,
        fontSize: 1.4,
        font: 'bold 1.4px Inter, sans-serif',
        color: '#fbbf24',
        align: 'center',
        width: stairsMsg.length * 0.8,
        height: 1.4
      });
    }

    // Resolve any overlapping labels using dynamic Y-shifting collision avoidance
    resolveLabelOverlaps(labelsToDraw);

    // Draw all adjusted labels cleanly on the canvas
    labelsToDraw.forEach(label => {
      ctx.fillStyle = label.color;
      ctx.font = label.font;
      ctx.textAlign = label.align;
      ctx.fillText(label.text, label.x, label.y);
    });

    ctx.restore(); // Restore camera translation context
  };

  const handleJoystickMove = (direction: string | null) => {
    setJoystickActive(direction);
  };

  // Toggle stairs to switch floor levels safely
  const triggerStairs = () => {
    const char = characterRef.current;
    const lay = layoutRef.current;
    const currentRoom = lay.rooms.find(r =>
      r.floor === char.floor &&
      char.x >= r.x && char.x <= r.x + r.width &&
      char.y >= r.y && char.y <= r.y + r.height
    );

    if (currentRoom && currentRoom.type === 'staircase') {
      const nextFloor = char.floor === 1 ? 2 : 1;
      // Find matching staircase on the destination floor
      const stairsDest = lay.rooms.find(r => r.floor === nextFloor && r.type === 'staircase');
      if (stairsDest) {
        setCharacter(prev => ({
          ...prev,
          floor: nextFloor,
          x: stairsDest.x + stairsDest.width / 2,
          y: stairsDest.y + stairsDest.height / 2
        }));
        onAction(`Successfully negotiated stairwell. Climbed to Floor ${nextFloor}!`, "success");
        completeObjective("climb_stairs");
      }
    } else {
      onAction("You must stand inside a designated stairwell to change floors!", "warning");
    }
  };

  const latestLog = actionLogs && actionLogs.length > 0 ? actionLogs[actionLogs.length - 1] : null;

  return (
    <div className="flex flex-col h-full bg-white border-4 border-amber-100 rounded-3xl overflow-hidden shadow-lg relative">
      {/* Simulation Header HUD */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-amber-50/80 border-b-2 border-amber-100 text-xs text-slate-800 relative z-30">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
          </span>
          <div>
            <h4 className="font-black text-slate-800 tracking-wide font-display text-xs uppercase">{layout.schoolName}</h4>
            <p className="text-[10px] text-sky-700 font-bold font-mono">🌟 HERO LIVE VIEW</p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-sans">
          <div className="text-right hidden md:block mr-2">
            <span className="text-[10px] text-slate-500 block font-black uppercase tracking-wider">CURRENT POSITION</span>
            <span className="font-black text-slate-800 text-xs">FLOOR {character.floor} / {layout.floorsCount}</span>
          </div>
          
          {layout.floorsCount > 1 && (
            <button
              onClick={triggerStairs}
              className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 border-2 border-amber-500 text-slate-900 rounded-xl font-black transition cursor-pointer text-[10px] flex items-center gap-1 shadow-sm"
              title="Climb stairs to change floors"
            >
              <Navigation className="w-3 h-3 rotate-45" /> CHANGE FLOOR 🪜
            </button>
          )}

          <button
            onClick={() => setShowFullMap(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border-2 border-slate-900 text-white rounded-xl font-black transition cursor-pointer text-[10px] flex items-center gap-1 shadow-sm"
            title="View Full Map Blueprint (Shortcut: Ctrl + M)"
          >
            <Map className="w-3 h-3 text-slate-200" /> MAP [Ctrl+M] 🗺️
          </button>

          <button
            onClick={() => setActionsExpanded(!actionsExpanded)}
            className={`px-2.5 py-1.5 border-2 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm ${
              actionsExpanded 
                ? 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title={actionsExpanded ? "Hide Action Panel" : "Show Action Controls"}
          >
            <span>⚡ ACTIONS</span>
            {actionsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Floating Dropdown Action panel positioned relative to the outer wrapper container */}
      {actionsExpanded && (
        <div className="absolute top-[58px] right-4 bg-white/95 border-2 border-slate-200 p-3 rounded-2xl shadow-xl w-60 z-30 animate-fade-in flex flex-col gap-2">
          <div className="text-[9px] text-slate-400 font-black text-center uppercase tracking-wider font-display border-b border-slate-100 pb-1.5">
            🎮 HERO CONTROLS
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCharacter(prev => ({ ...prev, isCrouching: !prev.isCrouching }))}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-black border-2 flex items-center justify-center gap-1 transition cursor-pointer ${
                character.isCrouching
                  ? 'bg-amber-400 hover:bg-amber-300 border-amber-500 text-slate-900 shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Duck down under tables or stay low to the floor under smoke (Key: C)"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" /> 🐢 CROUCH [C]
            </button>

            <button
              onClick={() => setCharacter(prev => ({ ...prev, isCoveringMouth: !prev.isCoveringMouth }))}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-black border-2 flex items-center justify-center gap-1 transition cursor-pointer ${
                character.isCoveringMouth
                  ? 'bg-sky-400 hover:bg-sky-300 border-sky-500 text-white shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Cover nose and mouth to filter toxic gases and smoke inhalation (Key: M)"
            >
              <Shield className="w-3.5 h-3.5 shrink-0" /> 😷 MASK [M]
            </button>

            <button
              onClick={handleDoorToggle}
              className="px-2 py-1.5 rounded-xl text-[11px] font-black border-2 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
              title="Open or close a nearby door (Key: F)"
            >
              🚪 DOOR [F]
            </button>

            <button
              onClick={triggerStairs}
              className="px-2 py-1.5 rounded-xl text-[11px] font-black border-2 bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 flex items-center justify-center gap-1 transition cursor-pointer"
              title="Climb up or down the staircase if you are standing in a stairwell room"
            >
              ↕ STAIRS
            </button>
          </div>

          <button
            onClick={handleExtinguish}
            disabled={!character.hasExtinguisher}
            className={`w-full py-2 px-3 rounded-xl text-[11px] font-black border-2 flex items-center justify-center gap-1.5 transition ${
              character.hasExtinguisher
                ? 'bg-rose-500 hover:bg-rose-400 border-rose-600 text-white cursor-pointer shadow-md animate-pulse'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title="Discharge fire extinguisher on fire hazards in front of you (Key: E)"
          >
            <Flame className="w-3.5 h-3.5 shrink-0" /> 🧯 SPRAY FIRE [E] ({character.extinguisherCharges})
          </button>
        </div>
      )}

      {/* Main Canvas Container */}
      <div ref={containerRef} className="flex-1 relative bg-slate-900 min-h-[360px]">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="absolute inset-0 block w-full h-full cursor-crosshair"
          title="Click to interact with doors, safety lockers, or move"
        />

        {/* Dynamic Warning overlay when drill is active */}
        {drillActive && (
          <div className="absolute top-4 left-4 pointer-events-none animate-pulse bg-rose-50 border-2 border-rose-300 px-3.5 py-2.5 rounded-2xl flex items-center gap-2 shadow-md z-10">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="text-xs font-sans text-rose-900">
              <span className="font-black uppercase tracking-widest block text-[10px]">{disasterType?.replace('_', ' ')} QUEST ACTIVE!</span>
              <span className="block font-bold">Follow safety instructions and escape! 🏃✨</span>
            </div>
          </div>
        )}

        {/* TOP RIGHT CONSOLE: ACTIVE QUESTS */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2.5 z-10 max-w-[280px]">
          {/* FLOATING ACTIVE QUESTS POPUP - Simple, non-cluttered */}
          {drillActive && (
            <div className="w-full bg-white/95 border-2 border-amber-300 p-3 rounded-2xl shadow-md animate-bounce-slow">
              <h5 className="text-[9px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1 font-display">
                🎯 ACTIVE QUESTS
              </h5>
              <div className="flex flex-col gap-1 mt-1.5 text-[11px] text-slate-700 font-bold leading-tight font-sans">
                {objectives.filter(o => !o.isCompleted).map(obj => (
                  <div key={obj.id} className="flex items-start gap-1">
                    <span className="text-amber-500 text-xs shrink-0">⭐</span>
                    <span>{obj.text}</span>
                  </div>
                ))}
                {objectives.filter(o => !o.isCompleted).length === 0 && (
                  <div className="text-emerald-600 font-black flex items-center gap-1">
                    <span>✨</span>
                    <span>All Quests Met! Run to soccer field outdoors!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Realtime Player Vitality Stats HUD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 bg-slate-50 border-t-2 border-slate-100 font-sans">
        {/* HEALTH BAR */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-rose-600 flex items-center gap-1 uppercase tracking-wider">
              ❤️ MY LIFE ENERGY
            </span>
            <span className="text-slate-800 font-mono font-bold">{character.health.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-300 rounded-full"
              style={{ width: `${character.health}%` }}
            />
          </div>
        </div>

        {/* LUNG TOXICITY BAR */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-emerald-600 flex items-center gap-1 uppercase tracking-wider">
              💨 MY BREATH METER
            </span>
            <span className="text-slate-800 font-mono font-bold">{character.lungSafety.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${character.lungSafety}%` }}
            />
          </div>
        </div>

        {/* INVENTORY / ALERTS */}
        <div className="flex items-center justify-start sm:justify-end gap-2.5 text-xs font-bold">
          {character.hasExtinguisher ? (
            <span className="px-3.5 py-1.5 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-xl font-black flex items-center gap-1.5 shadow-sm animate-pulse">
              🎒 Extinguisher Found ({character.extinguisherCharges}) 🧯
            </span>
          ) : (
            <span className="text-slate-400 italic font-bold">🎒 My Backpack is Empty (Search Lockers!)</span>
          )}
        </div>
      </div>

      {/* FULL MAP OVERLAY MODAL */}
      {showFullMap && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setShowFullMap(false)}
        >
          <div 
            className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-2xl max-w-4xl w-full relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-display flex items-center gap-1.5">
                  🏫 {layout.schoolName} - BLUEPRINT
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Use the tabs to toggle floors. Close with ESC, click outside, or press <span className="bg-slate-800 px-1 py-0.5 rounded text-amber-400 font-mono font-bold">Ctrl + M</span>
                </p>
              </div>
              <button 
                onClick={() => setShowFullMap(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1.5 bg-slate-800 rounded-xl hover:bg-slate-700 flex items-center justify-center"
                title="Close Blueprint"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Floor Switcher */}
            {layout.floorsCount > 1 && (
              <div className="flex justify-center gap-2 mb-4 bg-slate-950/50 p-1 rounded-xl border border-slate-800/80">
                {Array.from({ length: layout.floorsCount }).map((_, i) => {
                  const fNum = i + 1;
                  return (
                    <button
                      key={fNum}
                      onClick={() => setMapViewFloor(fNum)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer ${
                        mapViewFloor === fNum
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      Floor {fNum} {character.floor === fNum && "📍 (You)"}
                    </button>
                  );
                })}
              </div>
            )}

            {/* SVG Map Container */}
            <div className="flex-1 overflow-auto bg-slate-950 border border-slate-800 rounded-2xl relative p-2 flex items-center justify-center min-h-[300px]">
              <svg 
                viewBox="0 0 100 105" 
                className="w-full h-auto max-h-[50vh] transition-all"
              >
                {/* Grid Pattern */}
                <defs>
                  <pattern id="modal-blueprint-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="0.15" />
                  </pattern>
                </defs>
                <rect width="100" height="105" fill="url(#modal-blueprint-grid)" />

                {/* Rooms */}
                {layout.rooms.filter(r => r.floor === mapViewFloor).map(room => {
                  const isPlayerInside = character.floor === mapViewFloor && 
                    character.x >= room.x && character.x <= room.x + room.width &&
                    character.y >= room.y && character.y <= room.y + room.height;

                  const isStairs = room.type === 'staircase';
                  const isExit = room.type === 'emergency_exit';
                  const colors = isExit ? { fill: 'rgba(16, 185, 129, 0.08)', stroke: '#10b981' } :
                                 isStairs ? { fill: 'rgba(245, 158, 11, 0.08)', stroke: '#f59e0b' } :
                                 isPlayerInside ? { fill: 'rgba(56, 189, 248, 0.08)', stroke: '#38bdf8' } :
                                 { fill: 'rgba(30, 41, 59, 0.25)', stroke: '#475569' };

                  return (
                    <g key={room.id}>
                      {/* Room boundary */}
                      <rect
                        x={room.x}
                        y={room.y}
                        width={room.width}
                        height={room.height}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth="0.4"
                        className="transition-colors duration-150"
                        strokeDasharray={isStairs ? "1,0.5" : undefined}
                      />

                      {/* Furniture */}
                      {room.furniture.map(item => (
                        <rect
                          key={item.id}
                          x={item.x}
                          y={item.y}
                          width={item.width}
                          height={item.height}
                          fill="rgba(71, 85, 105, 0.2)"
                          stroke="rgba(148, 163, 184, 0.3)"
                          strokeWidth="0.15"
                          rx="0.1"
                        />
                      ))}

                      {/* Doors */}
                      {room.doors.map(door => {
                        const isHorizontal = door.width >= door.height;
                        const halfW = (door.width || 4) / 2;
                        const halfH = (door.height || 4) / 2;
                        return (
                          <rect
                            key={door.id}
                            x={door.x - halfW}
                            y={door.y - halfH}
                            width={door.width || 4}
                            height={door.height || 4}
                            fill={door.isBlocked ? 'rgba(239, 68, 68, 0.9)' : door.isOpen ? 'rgba(16, 185, 129, 0.8)' : 'rgba(245, 158, 11, 0.8)'}
                            stroke={door.isBlocked ? '#991b1b' : door.isOpen ? '#065f46' : '#92400e'}
                            strokeWidth="0.1"
                            rx="0.2"
                          />
                        );
                      })}

                      {/* Labels */}
                      <text
                        x={room.x + room.width / 2}
                        y={room.y + room.height / 2 - 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isExit ? '#34d399' : isStairs ? '#fbbf24' : isPlayerInside ? '#38bdf8' : '#e2e8f0'}
                        fontSize="1.6"
                        fontWeight="black"
                        className="select-none pointer-events-none tracking-wide"
                      >
                        {room.name}
                      </text>
                      <text
                        x={room.x + room.width / 2}
                        y={room.y + room.height / 2 + 1.2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#64748b"
                        fontSize="1.1"
                        fontWeight="bold"
                        className="select-none pointer-events-none italic"
                      >
                        {room.type.replace('_', ' ').toUpperCase()}
                      </text>
                    </g>
                  );
                })}

                {/* Safe Evacuation Zone (Floor 1 Only) */}
                {mapViewFloor === 1 && layout.assemblyArea && (
                  <g>
                    <circle
                      cx={layout.assemblyArea.x}
                      cy={layout.assemblyArea.y}
                      r={layout.assemblyArea.radius || 12}
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="#10b981"
                      strokeWidth="0.5"
                      strokeDasharray="1,1"
                      className="animate-pulse"
                    />
                    <text
                      x={layout.assemblyArea.x}
                      y={layout.assemblyArea.y - 2}
                      textAnchor="middle"
                      fill="#10b981"
                      fontSize="1.6"
                      fontWeight="black"
                      className="select-none pointer-events-none tracking-widest"
                    >
                      🟢 EVACUATION AREA
                    </text>
                    <text
                      x={layout.assemblyArea.x}
                      y={layout.assemblyArea.y + 1}
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize="1.2"
                      fontWeight="bold"
                      className="select-none pointer-events-none italic"
                    >
                      {layout.assemblyArea.name}
                    </text>
                  </g>
                )}

                {/* Hazards */}
                {hazards.filter(h => h.floor === mapViewFloor).map(hazard => (
                  <g key={hazard.id}>
                    <circle
                      cx={hazard.x}
                      cy={hazard.y}
                      r={hazard.radius || 4}
                      fill={hazard.type === 'fire' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'}
                      stroke={hazard.type === 'fire' ? '#ef4444' : '#38bdf8'}
                      strokeWidth="0.3"
                      className="animate-pulse"
                    />
                    <text
                      x={hazard.x}
                      y={hazard.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="2.5"
                      className="select-none pointer-events-none"
                    >
                      {hazard.type === 'fire' ? '🔥' : hazard.type === 'smoke' ? '💨' : '⚠️'}
                    </text>
                  </g>
                ))}

                {/* Player Tracker (if on currently viewed floor) */}
                {character.floor === mapViewFloor && (
                  <g>
                    <circle
                      cx={character.x}
                      cy={character.y}
                      r="4.5"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="0.4"
                      className="animate-ping"
                    />
                    <circle
                      cx={character.x}
                      cy={character.y}
                      r="1.8"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="0.4"
                    />
                    <text
                      x={character.x}
                      y={character.y - 3}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="1.6"
                      fontWeight="black"
                      className="select-none pointer-events-none"
                    >
                      📍 YOU ARE HERE
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Legend / Footer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-600 block"></span>
                <span>Standard Classroom</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/10 border border-amber-500 block"></span>
                <span>Staircase / Stairs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500/10 border border-emerald-500 block"></span>
                <span>Emergency Exit Route</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-emerald-500 block rounded-full"></span>
                <span>Open Door (Clear Pathway)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-amber-500 block rounded-full"></span>
                <span>Closed Door (Can open with [F])</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 bg-rose-600 block rounded-full"></span>
                <span>Blocked Door (Find detour!)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🔥 / 💨 / ⚠️</span>
                <span>Active Environmental Hazards</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 border border-white block animate-pulse"></span>
                <span>Your Current Coordinates</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
