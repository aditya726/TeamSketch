
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fabric } from 'fabric';
import { io, Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { createRoom } from '../services/roomApi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  // Toolbar Icons
  MousePointer2, Hand, Square, Circle as CircleIcon,
  Diamond, ArrowRight, Minus, Pencil, Type, Image as ImageIcon,
  Eraser,
  // UI Icons
  ZoomIn, ZoomOut, Undo, Redo,
  Users, Home, Copy, Check, LogOut, Trash2
} from 'lucide-react';


import {
  WhiteboardMode,
  DrawingPayload,
  RoomState,
  RoomUser,
  ClientEvents,
  ServerEvents,
  CursorData,
} from '../types/whiteboard.types';

import RoomChat from './RoomChat';
import RoomVoiceChat from './RoomVoiceChat';

// --- Types ---
export type WhiteboardTool =
  | 'selection' | 'pan' | 'rectangle' | 'diamond' | 'circle'
  | 'arrow' | 'line' | 'pen' | 'text' | 'image' | 'eraser';

const STYLABLE_TOOLS = ['rectangle', 'diamond', 'circle', 'arrow', 'line', 'pen', 'text'];
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;
const BLACK_CROSSHAIR = `url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222%22%3E%3Cline%20x1%3D%2212%22%20y1%3D%222%22%20x2%3D%2212%22%20y2%3D%2222%22%3E%3C%2Fline%3E%3Cline%20x1%3D%222%22%20y1%3D%2212%22%20x2%3D%2222%22%20y2%3D%2212%22%3E%3C%2Fline%3E%3C%2Fsvg%3E') 12 12, crosshair`;

const generateId = () => Math.random().toString(36).substr(2, 9);

const Whiteboard: React.FC = () => {
  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // State refs
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeObjectRef = useRef<fabric.Object | null>(null);
  const remoteObjectsRef = useRef<Record<string, fabric.Object>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pen Tool tracking
  const currentPathIdRef = useRef<string | null>(null);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  // History Locking (prevents loops during undo/redo)
  const isHistoryProcessing = useRef<boolean>(false);
  // Keep a ref of historyStep to avoid stale closures in saveHistory
  const historyStepRef = useRef<number>(-1);

  // --- State ---
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // Modes & Connectivity
  const [mode, setMode] = useState<WhiteboardMode>('solo');
  const modeRef = useRef<WhiteboardMode>('solo');
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const [roomId, setRoomId] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [showRoomModal, setShowRoomModal] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});

  // Tools & Properties
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [showProperties, setShowProperties] = useState(false);

  // History & Zoom
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const historyRef = useRef<string[]>([]);
  const MAX_HISTORY = 50;


  useEffect(() => { historyStepRef.current = historyStep; }, [historyStep]);
  useEffect(() => { historyRef.current = history; }, [history]);

  // --- 1. History (Undo/Redo) Management ---

  // Save current canvas state to history
  const saveHistory = useCallback(() => {
    if (!fabricCanvasRef.current || isHistoryProcessing.current) return;

    const json = JSON.stringify(fabricCanvasRef.current.toJSON());
    const MAX_HISTORY = 50;

    if (modeRef.current === 'solo') {
      localStorage.setItem('teamsketch-solo-drawing', json);
    }

    // Mutate refs synchronously to prevent React Strict Mode double-invocation bugs
    const curStep = Math.max(0, historyStepRef.current);
    const newHistory = historyRef.current.slice(0, curStep + 1);
    newHistory.push(json);

    if (newHistory.length > MAX_HISTORY) {
      const removed = newHistory.length - MAX_HISTORY;
      newHistory.splice(0, removed);
      historyStepRef.current = curStep + 1 - removed;
    } else {
      historyStepRef.current = curStep + 1;
    }

    historyRef.current = newHistory;

    // Sync UI state
    setHistoryStep(historyStepRef.current);
    setHistory([...newHistory]);
  }, []);

  // Execute Undo
  const handleUndo = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyStepRef.current <= 0) return;

    isHistoryProcessing.current = true;
    const previousIndex = historyStepRef.current - 1;
    const previousState = historyRef.current[previousIndex];

    canvas.loadFromJSON(previousState, () => {
      canvas.renderAll();
      setHistoryStep(previousIndex);
      isHistoryProcessing.current = false;

      if (mode === 'room' && currentRoomId && socketRef.current) {
        socketRef.current.emit(ClientEvents.UNDO, {
          roomId: currentRoomId,
          state: JSON.parse(previousState)
        });
      }
    });
  }, [mode, currentRoomId]);

  // Execute Redo
  const handleRedo = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || historyStepRef.current >= historyRef.current.length - 1) return;

    isHistoryProcessing.current = true;
    const nextIndex = historyStepRef.current + 1;
    const nextState = historyRef.current[nextIndex];

    canvas.loadFromJSON(nextState, () => {
      canvas.renderAll();
      setHistoryStep(nextIndex);
      isHistoryProcessing.current = false;

      if (mode === 'room' && currentRoomId && socketRef.current) {
        socketRef.current.emit(ClientEvents.REDO, {
          roomId: currentRoomId,
          state: JSON.parse(nextState)
        });
      }
    });
  }, [mode, currentRoomId]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an HTML input
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      const canvas = fabricCanvasRef.current;
      const activeObj = canvas?.getActiveObject();
      const isEditingText = activeObj && activeObj.type === 'i-text' && (activeObj as fabric.IText).isEditing;

      if (isInput || isEditingText) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (canvas) {
          canvas.discardActiveObject();
          const objs = canvas.getObjects().filter(obj => obj.evented !== false && obj.selectable !== false);
          if (objs.length > 0) {
            const sel = new fabric.ActiveSelection(objs, { canvas });
            canvas.setActiveObject(sel);
            canvas.requestRenderAll();
          }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvas) {
          const activeObjects = canvas.getActiveObjects();
          if (activeObjects.length > 0) {
            e.preventDefault();
            isHistoryProcessing.current = true;
            let dirty = false;
            activeObjects.forEach(obj => {
              canvas.remove(obj);
              dirty = true;
              if (mode === 'room' && currentRoomId && socketRef.current) {
                socketRef.current.emit(ClientEvents.DELETE, { roomId: currentRoomId, objectId: (obj as any).id });
              }
            });
            if (dirty) {
              canvas.discardActiveObject();
              canvas.requestRenderAll();
              saveHistory();
            }
            isHistoryProcessing.current = false;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, mode, currentRoomId, saveHistory]);

  // --- 2. Zoom Management ---

  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let zoom = canvas.getZoom();

    if (type === 'in') zoom *= 1.1;
    if (type === 'out') zoom /= 1.1;
    if (type === 'reset') zoom = 1;

    // Cap zoom limits
    if (zoom > 20) zoom = 20;
    if (zoom < 0.1) zoom = 0.1;

    // Zoom to center of the current viewport (safe fallback if getCenter() is undefined)
    const cCenter = typeof canvas.getCenter === 'function' ? canvas.getCenter() : null;
    const cx = cCenter?.left ?? (canvas.getWidth ? canvas.getWidth() / 2 : 0);
    const cy = cCenter?.top ?? (canvas.getHeight ? canvas.getHeight() / 2 : 0);
    canvas.zoomToPoint(new fabric.Point(cx, cy), zoom);

    setZoomLevel(Math.round(zoom * 100));
    canvas.renderAll();
  };

  // --- 3. Socket / Object Completion Helper ---

  // This handles sending data to Socket AND triggering history save
  const handleObjectComplete = useCallback((object: fabric.Object) => {
    if (!object) return;

    // Ensure the object has a unique ID for syncing deletions
    // if (!(object as any).id) {
    //   (object as any).id = generateId();
    // } 
    // 1. Save History locally
    saveHistory();

    // 2. Emit to Socket
    if (mode === 'room' && currentRoomId && socketRef.current) {
      const serialized = object.toObject(['id']) as DrawingPayload;
      socketRef.current.emit(ClientEvents.DRAW, {
        roomId: currentRoomId,
        object: serialized,
      });
    }
  }, [mode, currentRoomId, saveHistory]);

  // --- Effect: Initialize Canvas ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      selection: false,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    const savedMode = localStorage.getItem('teamsketch-mode');
    const savedSoloDrawing = localStorage.getItem('teamsketch-solo-drawing');

    if (savedMode !== 'room' && savedSoloDrawing) {
      canvas.loadFromJSON(savedSoloDrawing, () => {
        canvas.renderAll();
        // Initialize blank history state after load
        const initialJson = JSON.stringify(canvas.toJSON());
        setHistory([initialJson]);
        setHistoryStep(0);
      });
    } else {
      // Initialize blank history state
      const initialJson = JSON.stringify(canvas.toJSON());
      setHistory([initialJson]);
      setHistoryStep(0);
    }

    // Handle Window Resize
    const handleResize = () => {
      canvas.setWidth(window.innerWidth);
      canvas.setHeight(window.innerHeight);
      canvas.renderAll();
    };
    window.addEventListener('resize', handleResize);

    // Mouse Wheel Zoom
    canvas.on('mouse:wheel', (opt) => {
      if (opt.e.ctrlKey) {
        opt.e.preventDefault();
        opt.e.stopPropagation();
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 20) zoom = 20;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        setZoomLevel(Math.round(zoom * 100));
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  // Separate effect for canvas event listeners that depend on current state
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: any) => {
      if (e.path) {
        (e.path as any).id = currentPathIdRef.current || generateId();
        handleObjectComplete(e.path);
        currentPathIdRef.current = null;
        currentPointsRef.current = [];
      }
    };

    const handleObjectModified = (e: any) => {
      saveHistory();

      const target = e.target;
      if (!target) return;

      if (mode === 'room' && currentRoomId && socketRef.current) {
        // Emit modify event
        socketRef.current.emit(ClientEvents.MODIFY, {
          roomId: currentRoomId,
          object: target.toObject(['id']) as DrawingPayload
        });
      }
    };

    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('text:editing:exited', handleObjectModified);

    return () => {
      canvas.off('path:created', handlePathCreated);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('text:editing:exited', handleObjectModified);
    };
  }, [mode, currentRoomId, handleObjectComplete, saveHistory]);

  // --- Effect: Tool & Property Switching ---
  useEffect(() => {
    setShowProperties(STYLABLE_TOOLS.includes(tool));
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Reset Defaults
    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // Apply Tool Settings
    if (tool === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.defaultCursor = BLACK_CROSSHAIR;
    } else if (tool === 'selection') {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
    } else if (tool === 'pan') {
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
    } else if (tool === 'eraser') {
      canvas.defaultCursor = 'not-allowed';
    } else {
      canvas.defaultCursor = BLACK_CROSSHAIR;
    }

    // Update active object styles
    const activeObj = canvas.getActiveObject();
    if (activeObj && tool === 'selection') {
      activeObj.set({ stroke: color, strokeWidth: strokeWidth, fill: fillColor });
      canvas.requestRenderAll();
      // If we change properties of an existing object, save history
      saveHistory();
    }

  }, [tool, color, strokeWidth, fillColor]);

  // --- Effect: Load room from localStorage on mount ---
  useEffect(() => {
    const savedRoomId = localStorage.getItem('teamsketch-room-id');
    const savedMode = localStorage.getItem('teamsketch-mode');

    if (savedRoomId && savedMode === 'room') {
      setRoomId(savedRoomId);
      setMode('room');
    }
  }, []);

  // --- Effect: Socket.IO Logic ---
  useEffect(() => {
    if (mode !== 'room') {
      if (socketRef.current) {
        if (currentRoomId) {
          socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
          localStorage.removeItem('teamsketch-room-id');
          localStorage.removeItem('teamsketch-mode');
        }
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setCurrentRoomId('');
        setRoomUsers([]);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // Rejoin room if we were in one (after reconnect or page refresh)
      const savedRoomId = localStorage.getItem('teamsketch-room-id');
      if (savedRoomId) {
        const socketId = socket.id || `guest-${Math.random().toString(36).substr(2, 9)}`;
        socket.emit(ClientEvents.JOIN_ROOM, {
          roomId: savedRoomId,
          userId: user?.id || socketId,
          userName: user?.username || user?.email?.split('@')[0] || `User-${socketId.substring(0, 4)}`
        });
        setCurrentRoomId(savedRoomId);
        setRoomId(savedRoomId);
      }
    });
    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receive Drawing
    socket.on(ServerEvents.DRAW, (payload: { object: DrawingPayload }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      isHistoryProcessing.current = true;

      // Clean up temporary real-time object if it exists
      if (payload.object.id && remoteObjectsRef.current[payload.object.id]) {
        canvas.remove(remoteObjectsRef.current[payload.object.id]);
        delete remoteObjectsRef.current[payload.object.id];
      }

      fabric.util.enlivenObjects([payload.object], (objects: fabric.Object[]) => {
        objects.forEach((obj) => {
          canvas.add(obj);
        });
        canvas.renderAll();

        // After adding remote object, update the history stack silently
        // We push the new state but don't increment the 'user action' count if we want strict local undo,
        // BUT for simplicity in this demo, we just sync history so everything is consistent.
        const json = JSON.stringify(canvas.toJSON());
        setHistory(prev => {
          const curStep = Math.max(0, historyStepRef.current);
          const newHistory = prev.slice(0, curStep + 1);
          newHistory.push(json);
          if (newHistory.length > MAX_HISTORY) {
            const removed = newHistory.length - MAX_HISTORY;
            newHistory.splice(0, removed);
            const newStep = curStep + 1 - removed;
            setHistoryStep(newStep);
            historyStepRef.current = newStep;
          } else {
            const newStep = curStep + 1;
            setHistoryStep(newStep);
            historyStepRef.current = newStep;
          }
          return newHistory;
        });

        isHistoryProcessing.current = false;
      }, 'fabric');
    });

    // Receive Draw Update (Real-time)
    socket.on(ServerEvents.DRAW_UPDATE, (payload: { object: DrawingPayload }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !payload.object || !payload.object.id) return;

      const objId = payload.object.id;

      // If we already have a temporary object for this ID, update it
      if (remoteObjectsRef.current[objId]) {
        if (payload.object.type === 'polyline') {
          const poly = remoteObjectsRef.current[objId] as any;
          poly.set({ points: payload.object.points });
          if (typeof poly._calcDimensions === 'function') {
            poly._calcDimensions();
          }
          poly.setCoords();
          canvas.renderAll();
        } else {
          remoteObjectsRef.current[objId].set(payload.object);
          canvas.renderAll();
        }
      } else {
        // Otherwise create a temporary object
        fabric.util.enlivenObjects([payload.object], (objects: fabric.Object[]) => {
          if (objects.length > 0) {
            const newObj = objects[0];
            // Disable interactions for remote real-time shapes
            newObj.set({ selectable: false, evented: false });
            remoteObjectsRef.current[objId] = newObj;
            canvas.add(newObj);
            canvas.renderAll();
          }
        }, 'fabric');
      }
    });

    // Receive Room State
    socket.on(ServerEvents.ROOM_STATE, (state: RoomState) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      isHistoryProcessing.current = true;
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      if (state.objects.length > 0) {
        fabric.util.enlivenObjects(state.objects, (objects: fabric.Object[]) => {
          objects.forEach((obj) => canvas.add(obj));
          canvas.renderAll();

          // Reset history to this room state
          const json = JSON.stringify(canvas.toJSON());
          setHistory([json]);
          setHistoryStep(0);

          isHistoryProcessing.current = false;
        }, 'fabric');
      } else {
        isHistoryProcessing.current = false;
      }
    });

    // Clear Canvas
    socket.on(ServerEvents.CLEAR_CANVAS, () => {
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
        saveHistory(); // Save the cleared state
      }
    });



    // Users Update
    socket.on(ServerEvents.USERS_UPDATE, (payload: { users: RoomUser[] }) => {
      console.log('Users in room:', payload.users);
      setRoomUsers(payload.users);

      // Clean up cursors of users who left
      setCursors(prev => {
        const activeIds = new Set(payload.users.map(u => u.id));
        const newCursors = { ...prev };
        Object.keys(newCursors).forEach(id => {
          if (!activeIds.has(id)) delete newCursors[id];
        });
        return newCursors;
      });
    });

    // Receive Cursor Move
    socket.on(ServerEvents.CURSOR_MOVE, (payload: { cursor: CursorData }) => {
      if (!payload.cursor || !payload.cursor.userId) return;
      setCursors(prev => ({
        ...prev,
        [payload.cursor.userId]: payload.cursor
      }));
    });

    // Modify Event
    socket.on(ServerEvents.MODIFY, (payload: { object: DrawingPayload }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const { object } = payload;
      if (!object.id) return;

      const targetObj = canvas.getObjects().find((obj: any) => obj.id === object.id);

      if (targetObj) {
        isHistoryProcessing.current = true;
        // set function handles most properties, but for specific ones like left/top/scale we pass the whole object
        targetObj.set(object);
        targetObj.setCoords();
        canvas.renderAll();
        saveHistory();
        isHistoryProcessing.current = false;
      }
    });

    // Delete Event
    socket.on(ServerEvents.DELETE, (payload: { objectId: string }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const { objectId } = payload;
      if (!objectId) return;

      const targetObj = canvas.getObjects().find((obj: any) => obj.id === objectId);

      if (targetObj) {
        isHistoryProcessing.current = true;
        canvas.remove(targetObj);
        canvas.renderAll();
        saveHistory();
        isHistoryProcessing.current = false;
      }
    });

    // Undo Event
    socket.on(ServerEvents.UNDO, (payload: { state: any }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !payload.state) return;

      isHistoryProcessing.current = true;
      canvas.loadFromJSON(payload.state, () => {
        canvas.renderAll();
        const json = JSON.stringify(canvas.toJSON());
        setHistory([json]);
        setHistoryStep(0);
        isHistoryProcessing.current = false;
      });
    });

    // Redo Event
    socket.on(ServerEvents.REDO, (payload: { state: any }) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas || !payload.state) return;

      isHistoryProcessing.current = true;
      canvas.loadFromJSON(payload.state, () => {
        canvas.renderAll();
        const json = JSON.stringify(canvas.toJSON());
        setHistory([json]);
        setHistoryStep(0);
        isHistoryProcessing.current = false;
      });
    });

    return () => {
      if (currentRoomId) socket.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
      socket.disconnect();
    };
  }, [mode, user]);

  // --- Handlers: Mouse Events ---
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
    };
  }, [tool, color, strokeWidth, fillColor, handleObjectComplete]);

  const handleMouseDown = (opt: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const { e } = opt;
    const pointer = canvas.getPointer(e);

    startPointRef.current = { x: pointer.x, y: pointer.y };

    // If user clicked an existing object, activate it and do not start creating a new shape.
    if (opt.target) {
      // For eraser we still want to remove on click (handled below), for pen/pan/selection let Fabric handle it.
      if (tool === 'eraser') {
        isDrawingRef.current = false;
        const targetId = (opt.target as any).id;
        canvas.remove(opt.target);
        canvas.requestRenderAll();
        saveHistory();

        if (mode === 'room' && currentRoomId && socketRef.current && targetId) {
          socketRef.current.emit(ClientEvents.DELETE, {
            roomId: currentRoomId,
            objectId: targetId
          });
        }
        return;
      }

      // For shape tools, selecting an existing object should not begin a new draw operation.
      if (tool !== 'pen' && tool !== 'pan' && tool !== 'text') {
        isDrawingRef.current = false;
        canvas.setActiveObject(opt.target);
        return;
      }
    }

    // Only mark drawing for tools that create shapes or pan.
    if (tool === 'pan') {
      isDrawingRef.current = true;
      canvas.setCursor('grabbing');
      canvas.selection = false;
      return;
    }

    // Selection relies on Fabric's built-in behaviors; don't set drawing flag.
    if (tool === 'selection') {
      isDrawingRef.current = false;
      return;
    }

    if (tool === 'pen') {
      isDrawingRef.current = true;
      currentPathIdRef.current = generateId();
      currentPointsRef.current = [{ x: pointer.x, y: pointer.y }];
      return;
    }

    // Eraser acts immediately on mouse down if an object is targeted.
    if (tool === 'eraser') {
      isDrawingRef.current = false;
      if (opt.target) {
        const targetId = (opt.target as any).id;
        canvas.remove(opt.target);
        canvas.requestRenderAll();
        saveHistory();

        if (mode === 'room' && currentRoomId && socketRef.current && targetId) {
          socketRef.current.emit(ClientEvents.DELETE, {
            roomId: currentRoomId,
            objectId: targetId
          });
        }
      }
      return;
    }

    // From here on we are creating a new shape -> mark drawing active
    isDrawingRef.current = true;

    // Shape Creation
    let newObj: fabric.Object | null = null;
    const commonProps = {
      id: generateId(),
      left: pointer.x,
      top: pointer.y,
      stroke: color,
      strokeWidth: strokeWidth,
      fill: fillColor,
      transparentCorners: false,
      originX: 'left',
      originY: 'top'
    };

    if (tool === 'rectangle') {
      newObj = new fabric.Rect({ ...commonProps, width: 0, height: 0 });
    } else if (tool === 'circle') {
      newObj = new fabric.Circle({ ...commonProps, radius: 0 });
    } else if (tool === 'diamond') {
      newObj = new fabric.Rect({
        ...commonProps, width: 0, height: 0, angle: 45, originX: 'center', originY: 'center', left: pointer.x, top: pointer.y
      });
    } else if (tool === 'line') {
      newObj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: color, strokeWidth: strokeWidth,
      });
    } else if (tool === 'arrow') {
      newObj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: color, strokeWidth: strokeWidth
      });
    } else if (tool === 'text') {
      const text = new fabric.IText('Type here', {
        id: generateId(), // Explicitly add ID for text
        left: pointer.x, top: pointer.y,
        fontFamily: 'Architects Daughter', fill: color, fontSize: 24
      } as any);
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      handleObjectComplete(text);
      setTool('selection');
      isDrawingRef.current = false;
      return;
    }

    if (newObj) {
      canvas.add(newObj);
      activeObjectRef.current = newObj;
      canvas.renderAll();
    }
  };

  const handleMouseMove = (opt: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const { e } = opt;
    const pointer = canvas.getPointer(e);

    // Emit Cursor Move
    if (mode === 'room' && currentRoomId && socketRef.current) {
      const socketId = socketRef.current.id || `guest-${Math.random().toString(36).substr(2, 9)}`;
      socketRef.current.emit(ClientEvents.CURSOR_MOVE, {
        roomId: currentRoomId,
        cursor: {
          x: pointer.x,
          y: pointer.y,
          userId: user?.id || socketId,
          userName: user?.username || user?.email?.split('@')[0] || `User-${socketId.substring(0, 4)}`
        }
      });
    }

    if (!isDrawingRef.current) return;

    if (tool === 'pen') {
      currentPointsRef.current.push({ x: pointer.x, y: pointer.y });
      if (mode === 'room' && currentRoomId && socketRef.current && currentPathIdRef.current) {
        socketRef.current.emit(ClientEvents.DRAW_UPDATE, {
          roomId: currentRoomId,
          object: {
            id: currentPathIdRef.current,
            type: 'polyline',
            points: [...currentPointsRef.current],
            fill: 'transparent',
            stroke: color,
            strokeWidth: strokeWidth,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          } as unknown as DrawingPayload
        });
      }
      return;
    }

    if (tool === 'pan') {
      const vpt = canvas.viewportTransform!;
      vpt[4] += e.movementX;
      vpt[5] += e.movementY;
      canvas.requestRenderAll();
      return;
    }

    const startX = startPointRef.current.x;
    const startY = startPointRef.current.y;
    const activeObj = activeObjectRef.current;

    if (!activeObj) return;

    if (tool === 'rectangle') {
      const width = pointer.x - startX;
      const height = pointer.y - startY;
      activeObj.set({ width: Math.abs(width), height: Math.abs(height) });
      activeObj.set({ left: width > 0 ? startX : pointer.x, top: height > 0 ? startY : pointer.y });
    } else if (tool === 'diamond') {
      const width = Math.abs(pointer.x - startX) * 2;
      const height = Math.abs(pointer.y - startY) * 2;
      activeObj.set({ width: width, height: height });
    } else if (tool === 'circle') {
      const radius = Math.sqrt(Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2));
      (activeObj as fabric.Circle).set({ radius: radius });
    } else if (tool === 'line' || tool === 'arrow') {
      (activeObj as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
    }

    canvas.renderAll();

    // Emit Draw Update mapping active object
    if (mode === 'room' && currentRoomId && socketRef.current && activeObjectRef.current) {
      socketRef.current.emit(ClientEvents.DRAW_UPDATE, {
        roomId: currentRoomId,
        object: activeObjectRef.current.toObject(['id']) as DrawingPayload
      });
    }
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (tool === 'pan') canvas.setCursor('grab');

    if (activeObjectRef.current) {
      activeObjectRef.current.setCoords();
      handleObjectComplete(activeObjectRef.current);
    }
    activeObjectRef.current = null;
  };

  // --- Handlers: Room Actions ---
  const handleCreateRoom = async () => {
    if (!isAuthenticated) {
      alert('Please login or register to create a room');
      navigate('/login');
      return;
    }
    setIsCreatingRoom(true);
    try {
      const response = await createRoom();
      if (response.success) {
        setRoomId(response.roomId);
        if (socketRef.current) {
          const socketId = socketRef.current.id || `guest-${Math.random().toString(36).substr(2, 9)}`;
          socketRef.current.emit(ClientEvents.JOIN_ROOM, {
            roomId: response.roomId,
            userId: user?.id || socketId,
            userName: user?.username || user?.email?.split('@')[0] || `User-${socketId.substring(0, 4)}`
          });
          setCurrentRoomId(response.roomId);
          // Save to localStorage
          localStorage.setItem('teamsketch-room-id', response.roomId);
          localStorage.setItem('teamsketch-mode', 'room');
        }
        setShowRoomModal(false);
      }
    } catch (err: any) {
      console.error('Failed to create room:', err);
      if (err.response?.status === 401) {
        alert('Please login to create a room');
        navigate('/login');
      } else {
        alert('Failed to create room. Please try again.');
      }
    }
    finally { setIsCreatingRoom(false); }
  };

  const handleJoinRoom = async () => {
    if (!isAuthenticated) {
      alert('Please login or register to join a room');
      navigate('/login');
      return;
    }

    if (!roomId) {
      alert('Please enter a room ID');
      return;
    }

    if (!socketRef.current) return;

    try {
      // Validate room on backend before joining
      const { joinRoom } = await import('../services/roomApi');
      const response = await joinRoom(roomId);

      if (response.success) {
        // Leave current room if already in one
        if (currentRoomId) {
          socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
        }

        // Join the new room
        const socketId = socketRef.current.id || `guest-${Math.random().toString(36).substr(2, 9)}`;
        socketRef.current.emit(ClientEvents.JOIN_ROOM, {
          roomId: roomId,
          userId: user?.id || socketId,
          userName: user?.username || user?.email?.split('@')[0] || `User-${socketId.substring(0, 4)}`
        });
        setCurrentRoomId(roomId);
        // Save to localStorage
        localStorage.setItem('teamsketch-room-id', roomId);
        localStorage.setItem('teamsketch-mode', 'room');
        setShowRoomModal(false);
      }
    } catch (err: any) {
      console.error('Failed to join room:', err);
      if (err.response?.status === 401) {
        alert('Please login to join a room');
        navigate('/login');
      } else if (err.response?.status === 400) {
        alert('Invalid room ID. Please check and try again.');
      } else if (err.response?.status === 404) {
        alert('Room not found or has expired. Please check the room ID.');
      } else {
        alert('Failed to join room. Please check the room ID and try again.');
      }
    }
  };

  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    saveHistory(); // Save blank state

    if (mode === 'room' && currentRoomId && socketRef.current) {
      socketRef.current.emit(ClientEvents.CLEAR_CANVAS, { roomId: currentRoomId });
    } else if (mode === 'solo') {
      localStorage.removeItem('teamsketch-solo-drawing');
    }
  };

  const handleLeaveRoom = () => {
    if (mode === 'room' && currentRoomId && socketRef.current) {
      // Emit leave room event
      socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });

      // Clear room state
      setCurrentRoomId('');
      setRoomId('');
      setRoomUsers([]);

      // Clear localStorage
      localStorage.removeItem('teamsketch-room-id');
      localStorage.removeItem('teamsketch-mode');

      // Switch to solo mode
      setMode('solo');

      console.log('[Whiteboard] Left room and switched to solo mode');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvasRef.current) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      fabric.Image.fromURL(f.target?.result as string, (img) => {
        (img as any).id = generateId();
        img.scaleToWidth(200);
        fabricCanvasRef.current?.add(img);
        fabricCanvasRef.current?.centerObject(img);
        fabricCanvasRef.current?.setActiveObject(img);
        handleObjectComplete(img);
      });
    };
    reader.readAsDataURL(file);
    setTool('selection');
  };

  // --- Render Helpers ---
  const ToolBtn = ({ active, onClick, icon: Icon, label }: any) => (
    <button
      onClick={onClick}
      className={`group relative p-2.5 rounded-xl transition-all ${active
        ? 'bg-indigo-600 text-white shadow-md scale-105'
        : 'text-zinc-500 hover:bg-zinc-100'
        }`}
      title={label}
    >
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-sans">
        {label}
      </span>
    </button>
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f8f9fa] font-architects">

      {/* --- 1. CENTERED FLOATING TOOLBAR --- */}
      <div className="absolute top-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pointer-events-auto bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-zinc-200 p-1.5 flex items-center gap-1"
        >
          <ToolBtn active={tool === 'pan'} onClick={() => setTool('pan')} icon={Hand} label="Pan" />
          <ToolBtn active={tool === 'selection'} onClick={() => setTool('selection')} icon={MousePointer2} label="Selection" />
          <div className="w-px h-6 bg-zinc-200 mx-1" />

          <ToolBtn active={tool === 'rectangle'} onClick={() => setTool('rectangle')} icon={Square} label="Rectangle" />
          <ToolBtn active={tool === 'diamond'} onClick={() => setTool('diamond')} icon={Diamond} label="Diamond" />
          <ToolBtn active={tool === 'circle'} onClick={() => setTool('circle')} icon={CircleIcon} label="Circle" />
          <ToolBtn active={tool === 'arrow'} onClick={() => setTool('arrow')} icon={ArrowRight} label="Arrow" />
          <ToolBtn active={tool === 'line'} onClick={() => setTool('line')} icon={Minus} label="Line" />
          <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')} icon={Pencil} label="Draw" />
          <div className="w-px h-6 bg-zinc-200 mx-1" />

          <ToolBtn active={tool === 'text'} onClick={() => setTool('text')} icon={Type} label="Text" />
          <ToolBtn active={tool === 'image'} onClick={() => fileInputRef.current?.click()} icon={ImageIcon} label="Image" />
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} hidden accept="image/*" />

          <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={Eraser} label="Eraser" />
          <button onClick={handleClear} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Clear Canvas">
            <Trash2 size={20} />
          </button>
        </motion.div>
      </div>

      {/* --- 2. LEFT SIDEBAR: ROOM & PROPERTIES --- */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-40">

        {/* Persistent Mode Controls */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white p-2 rounded-xl shadow-lg border border-zinc-200 flex flex-col gap-2"
        >
          <Link to="/" className="p-2.5 text-zinc-500 hover:bg-zinc-100 rounded-lg block text-center" title="Back to Home">
            <Home size={20} />
          </Link>
          <div className="h-px bg-zinc-100" />
          <button
            onClick={() => {
              if (mode === 'room') {
                setMode('solo');
              } else {
                setMode('room');
                setShowRoomModal(true);
              }
            }}
            className={`p-2.5 rounded-lg transition-colors ${mode === 'room' ? 'bg-indigo-100 text-indigo-600' : 'text-zinc-500 hover:bg-zinc-100'}`}
            title="Room Mode"
          >
            <Users size={20} />
          </button>
        </motion.div>

        {/* Room Info Bubble */}
        {mode === 'room' && isConnected && currentRoomId && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-green-50 p-3 rounded-xl border border-green-200 shadow-sm max-w-[200px]"
          >
            <div className="text-[10px] font-bold text-green-600 mb-1 uppercase tracking-wider">Active Room</div>
            <div className="flex items-center gap-2 mb-2">
              <code className="text-sm font-bold text-zinc-700">{currentRoomId}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(currentRoomId); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }}
                className="text-green-600 hover:bg-green-100 p-1 rounded"
              >
                {copySuccess ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="text-[10px] font-bold text-green-600 mb-1 uppercase tracking-wider">Users ({roomUsers.length})</div>
            <div className="space-y-1 mb-3">
              {roomUsers.map((roomUser) => (
                <div key={roomUser.socketId} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-zinc-700 truncate">{roomUser.name}</span>
                </div>
              ))}
            </div>

            {/* Leave Room Button */}
            <button
              onClick={handleLeaveRoom}
              className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut size={14} />
              Leave Room
            </button>
          </motion.div>
        )}

        {/* PROPERTIES PANEL */}
        <AnimatePresence>
          {showProperties && (
            <motion.div
              initial={{ x: -50, opacity: 0, height: 0 }}
              animate={{ x: 0, opacity: 1, height: 'auto' }}
              exit={{ x: -50, opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white p-4 rounded-xl shadow-lg border border-zinc-200 overflow-hidden origin-top-left"
            >
              <div className="flex flex-col gap-4 min-w-[120px]">
                {/* Stroke Color */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Stroke</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['#000000', '#e03131', '#2f9e44', '#1971c2'].map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-md transition-transform active:scale-95 ${color === c ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Fill Color */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Fill</label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setFillColor('transparent')}
                      className={`w-6 h-6 rounded-md border border-zinc-200 flex items-center justify-center transition-transform active:scale-95 ${fillColor === 'transparent' ? 'ring-2 ring-offset-2 ring-zinc-900' : ''}`}
                    >
                      <div className="w-full h-px bg-red-400 rotate-45" />
                    </button>
                    {['#ffec99', '#b2f2bb', '#a5d8ff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setFillColor(c)}
                        className={`w-6 h-6 rounded-md transition-transform active:scale-95 ${fillColor === c ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Width */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 block">Thickness</label>
                  <div className="flex gap-2 bg-zinc-100 p-1 rounded-lg">
                    {[2, 4, 6, 8].map(s => (
                      <button
                        key={s}
                        onClick={() => setStrokeWidth(s)}
                        className={`flex-1 h-8 rounded flex items-center justify-center transition-all ${strokeWidth === s ? 'bg-white shadow-sm' : 'hover:bg-zinc-200'}`}
                      >
                        <div className="bg-zinc-800 rounded-full" style={{ width: s, height: s }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- CANVAS CONTAINER --- */}
      <canvas ref={canvasRef} />

      {/* --- CURSORS OVERLAY --- */}
      {mode === 'room' && Object.values(cursors).map(cursor => {
        // Find our own socket ID to omit showing our own cursor via socket
        const socketId = socketRef.current?.id || '';
        const isSelf = cursor.userId === user?.id || cursor.userId === socketId;
        if (isSelf) return null;

        // Map cursor canvas coordinates to screen coordinates.
        // We must account for:
        //   1. The Fabric viewport transform (zoom + pan)
        //   2. The canvas HTML element's own page offset (getBoundingClientRect)
        let left = cursor.x;
        let top = cursor.y;
        if (fabricCanvasRef.current) {
          const vpt = fabricCanvasRef.current.viewportTransform;
          if (vpt) {
            left = cursor.x * vpt[0] + vpt[4];
            top = cursor.y * vpt[3] + vpt[5];
          }
          // Add the canvas element's screen offset so the overlay (anchored at 0,0
          // of the root div) maps correctly to the canvas drawing surface.
          const canvasEl = fabricCanvasRef.current.getElement();
          if (canvasEl) {
            const rect = canvasEl.getBoundingClientRect();
            left += rect.left;
            top += rect.top;
          }
        }

        return (
          <motion.div
            key={cursor.userId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: left, y: top }}
            transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }}
            className="absolute z-50 pointer-events-none"
            style={{ left: 0, top: 0 }}
          >
            {/* Icon tip is at exactly (left, top) — no centering offset */}
            <MousePointer2 size={16} className="text-indigo-500 fill-indigo-500 block" />
            <div className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-md mt-0.5 ml-3 whitespace-nowrap shadow-sm inline-block">
              {cursor.userName}
            </div>
          </motion.div>
        );
      })}

      {/* --- BOTTOM: ZOOM & UTILS --- */}
      <div className="absolute bottom-4 left-4 flex gap-3 z-40">
        <div className="bg-white p-1 rounded-lg shadow-sm border border-zinc-200 flex text-zinc-600">
          <button className="p-2 hover:bg-zinc-50 rounded" onClick={() => handleZoom('out')}><ZoomOut size={16} /></button>
          <button
            onClick={() => handleZoom('reset')}
            className="px-2 text-xs font-bold min-w-[3rem] hover:bg-zinc-50"
          >
            {zoomLevel}%
          </button>
          <button className="p-2 hover:bg-zinc-50 rounded" onClick={() => handleZoom('in')}><ZoomIn size={16} /></button>
        </div>

        <div className="bg-white p-1 rounded-lg shadow-sm border border-zinc-200 flex text-zinc-600">
          <button
            className="p-2 hover:bg-zinc-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={handleUndo}
            disabled={historyStep <= 0}
          >
            <Undo size={16} />
          </button>
          <button
            className="p-2 hover:bg-zinc-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      {/* --- ROOM MODAL --- */}
      <AnimatePresence>
        {showRoomModal && (
          <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-2xl shadow-xl w-96 border border-zinc-200"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-zinc-800">Collaboration</h2>
                <button onClick={() => { setShowRoomModal(false); if (!currentRoomId) setMode('solo'); }} className="p-1 hover:bg-zinc-100 rounded-full"><LogOut size={16} /></button>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreatingRoom}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isCreatingRoom ? 'Creating Room...' : 'Start New Room'}
                </button>

                <div className="relative text-center my-2">
                  <span className="bg-white px-2 text-xs text-zinc-400 font-bold relative z-10">OR JOIN</span>
                  <div className="absolute top-1/2 w-full h-px bg-zinc-100 left-0 -z-0"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border-2 border-zinc-100 rounded-xl font-mono uppercase focus:border-indigo-500 outline-none"
                  />
                  <button onClick={handleJoinRoom} className="px-4 bg-zinc-100 hover:bg-zinc-200 rounded-xl font-bold text-zinc-700">Join</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CHAT AND VOICE CHAT --- */}
      {mode === 'room' && currentRoomId && socketRef.current && (
        <>
          <RoomVoiceChat
            socket={socketRef.current}
            roomId={currentRoomId}
            user={user}
            roomUsers={roomUsers}
          />
          <RoomChat
            socket={socketRef.current}
            roomId={currentRoomId}
            user={user}
          />
        </>
      )}

    </div>
  );
};

export default Whiteboard;