/**
 * Collaborative Whiteboard Component
 * Uses Fabric.js for drawing and Socket.IO for real-time collaboration
 */

import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { io, Socket } from 'socket.io-client';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { createRoom } from '../services/roomApi';
import { motion } from 'framer-motion';
import { 
  PencilLine, Hand, ZoomIn, ZoomOut, RotateCcw, Trash2, 
  Undo, Redo, Copy, Check, Users, Home 
} from 'lucide-react';
import {
  WhiteboardMode,
  WhiteboardTool,
  DrawingPayload,
  RoomState,
  Command,
  ClientEvents,
  ServerEvents,
} from '../types/whiteboard.types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

const Whiteboard: React.FC = () => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const panHandlersRef = useRef<{
    mouseDown: ((opt: any) => void) | null;
    mouseMove: ((opt: any) => void) | null;
    mouseUp: (() => void) | null;
  }>({ mouseDown: null, mouseMove: null, mouseUp: null });

  // Hooks
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // State
  const [mode, setMode] = useState<WhiteboardMode>('solo');
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [roomId, setRoomId] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [color, setColor] = useState<string>('#000000');
  const [brushSize, setBrushSize] = useState<number>(2);
  const [commandStack, setCommandStack] = useState<Command[]>([]);
  const [commandIndex, setCommandIndex] = useState<number>(-1);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  /**
   * Initialize Fabric.js canvas
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: false,
      width: window.innerWidth - 300,
      height: window.innerHeight - 100,
      backgroundColor: '#ffffff',
    });

    fabricCanvasRef.current = canvas;

    // Handle window resize
    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 300);
      canvas.setHeight(window.innerHeight - 100);
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  /**
   * Update drawing tool settings
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Clean up previous pan handlers
    if (panHandlersRef.current.mouseDown) {
      canvas.off('mouse:down', panHandlersRef.current.mouseDown);
    }
    if (panHandlersRef.current.mouseMove) {
      canvas.off('mouse:move', panHandlersRef.current.mouseMove);
    }
    if (panHandlersRef.current.mouseUp) {
      canvas.off('mouse:up', panHandlersRef.current.mouseUp);
    }

    if (tool === 'pen') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = color;
      brush.width = brushSize;
      canvas.freeDrawingBrush = brush;
    } else if (tool === 'pan') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      enablePanMode(canvas);
    }

    return () => {
      // Cleanup on unmount or tool change
      if (panHandlersRef.current.mouseDown) {
        canvas.off('mouse:down', panHandlersRef.current.mouseDown);
      }
      if (panHandlersRef.current.mouseMove) {
        canvas.off('mouse:move', panHandlersRef.current.mouseMove);
      }
      if (panHandlersRef.current.mouseUp) {
        canvas.off('mouse:up', panHandlersRef.current.mouseUp);
      }
    };
  }, [tool, color, brushSize]);

  /**
   * Enable pan mode for canvas navigation
   */
  const enablePanMode = (canvas: fabric.Canvas) => {
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    const mouseDownHandler = (opt: any) => {
      const evt = opt.e;
      isPanning = true;
      canvas.selection = false;
      lastPosX = evt.clientX;
      lastPosY = evt.clientY;
    };

    const mouseMoveHandler = (opt: any) => {
      if (isPanning) {
        const evt = opt.e;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += evt.clientX - lastPosX;
          vpt[5] += evt.clientY - lastPosY;
          canvas.requestRenderAll();
          lastPosX = evt.clientX;
          lastPosY = evt.clientY;
        }
      }
    };

    const mouseUpHandler = () => {
      isPanning = false;
    };

    canvas.on('mouse:down', mouseDownHandler);
    canvas.on('mouse:move', mouseMoveHandler);
    canvas.on('mouse:up', mouseUpHandler);

    // Store handlers for cleanup
    panHandlersRef.current = {
      mouseDown: mouseDownHandler,
      mouseMove: mouseMoveHandler,
      mouseUp: mouseUpHandler,
    };
  };

  /**
   * Handle path creation (drawing complete)
   */
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: any) => {
      const path = e.path as fabric.Path | undefined;
      if (!path) return;

      isDrawingRef.current = true;

      // Serialize the path
      const serialized = path.toObject() as DrawingPayload;

      // Add to command stack for undo/redo
      const newCommand: Command = {
        type: 'add',
        object: serialized,
      };
      addToCommandStack(newCommand);

      // Emit to server if in room mode
      if (mode === 'room' && currentRoomId && socketRef.current) {
        socketRef.current.emit(ClientEvents.DRAW, {
          roomId: currentRoomId,
          object: serialized,
        });
      }

      // Reset flag after a short delay to prevent echo
      setTimeout(() => {
        isDrawingRef.current = false;
      }, 100);
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created', handlePathCreated);
    };
  }, [mode, currentRoomId, commandIndex]);

  /**
   * Add command to stack for undo/redo
   */
  const addToCommandStack = (command: Command) => {
    setCommandStack((prev) => {
      const newStack = prev.slice(0, commandIndex + 1);
      newStack.push(command);
      return newStack;
    });
    setCommandIndex((prev) => prev + 1);
  };

  /**
   * Initialize Socket.IO connection in room mode
   */
  useEffect(() => {
    if (mode !== 'room') {
      // Disconnect socket if switching to solo mode
      if (socketRef.current) {
        if (currentRoomId) {
          socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setCurrentRoomId('');
      }
      return;
    }

    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Handle connection events
    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
      // Rejoin room if we were in one
      if (currentRoomId) {
        socket.emit(ClientEvents.JOIN_ROOM, { roomId: currentRoomId });
      }
    });

    // Handle incoming drawing events
    socket.on(ServerEvents.DRAW, (payload: { object: DrawingPayload }) => {
      // Prevent echo - don't draw if we just created this path
      if (isDrawingRef.current) return;

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Deserialize and add to canvas
      fabric.util.enlivenObjects([payload.object], (objects: fabric.Object[]) => {
        objects.forEach((obj) => {
          canvas.add(obj);
        });
        canvas.renderAll();
      }, 'fabric');
    });

    // Handle room state (when joining)
    socket.on(ServerEvents.ROOM_STATE, (state: RoomState) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      console.log(`[Socket] Received room state with ${state.objects.length} objects`);

      // Clear current canvas
      canvas.clear();
      canvas.backgroundColor = '#ffffff';

      // Load all objects
      if (state.objects.length > 0) {
        fabric.util.enlivenObjects(state.objects, (objects: fabric.Object[]) => {
          objects.forEach((obj) => {
            canvas.add(obj);
          });
          canvas.renderAll();
        }, 'fabric');
      }
    });

    // Handle clear canvas events
    socket.on(ServerEvents.CLEAR_CANVAS, () => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
    });

    // Handle errors
    socket.on(ServerEvents.ERROR, (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
      alert(`Socket error: ${error.message}`);
    });

    return () => {
      if (currentRoomId) {
        socket.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
      }
      socket.disconnect();
    };
  }, [mode]);

  /**
   * Create a new room (requires authentication)
   */
  const handleCreateRoom = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      alert('Please login to create a room');
      navigate('/login');
      return;
    }

    setIsCreatingRoom(true);

    try {
      // Call API to generate room ID
      const response = await createRoom();
      
      if (response.success) {
        const generatedRoomId = response.roomId;
        setRoomId(generatedRoomId);
        
        // Automatically join the created room
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit(ClientEvents.JOIN_ROOM, { roomId: generatedRoomId });
          setCurrentRoomId(generatedRoomId);
          console.log(`[App] Created and joined room: ${generatedRoomId}`);
        }
      } else {
        alert('Failed to create room');
      }
    } catch (error: any) {
      console.error('Error creating room:', error);
      if (error.response?.status === 401) {
        alert('Please login to create a room');
        navigate('/login');
      } else {
        alert('Failed to create room. Please try again.');
      }
    } finally {
      setIsCreatingRoom(false);
    }
  };

  /**
   * Copy room ID to clipboard
   */
  const handleCopyRoomId = async () => {
    if (!currentRoomId) return;

    try {
      await navigator.clipboard.writeText(currentRoomId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy room ID:', error);
      alert('Failed to copy room ID');
    }
  };

  /**
   * Join a room
   */
  const handleJoinRoom = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    if (!socketRef.current || !socketRef.current.connected) {
      alert('Socket not connected. Please wait...');
      return;
    }

    // Leave current room if in one
    if (currentRoomId) {
      socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
    }

    // Join new room
    socketRef.current.emit(ClientEvents.JOIN_ROOM, { roomId: roomId.trim() });
    setCurrentRoomId(roomId.trim());
    console.log(`[App] Joined room: ${roomId.trim()}`);
  };

  /**
   * Leave current room
   */
  const handleLeaveRoom = () => {
    if (!currentRoomId || !socketRef.current) return;

    socketRef.current.emit(ClientEvents.LEAVE_ROOM, { roomId: currentRoomId });
    setCurrentRoomId('');
    console.log('[App] Left room');
  };

  /**
   * Clear canvas
   */
  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();

    // Add clear command to stack
    const clearCommand: Command = { type: 'clear' };
    addToCommandStack(clearCommand);

    // Emit clear event if in room mode
    if (mode === 'room' && currentRoomId && socketRef.current) {
      socketRef.current.emit(ClientEvents.CLEAR_CANVAS, { roomId: currentRoomId });
    }
  };

  /**
   * Undo last action
   */
  const handleUndo = () => {
    if (commandIndex < 0) return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Rebuild canvas from command stack
    canvas.clear();
    canvas.backgroundColor = '#ffffff';

    const newIndex = commandIndex - 1;

    for (let i = 0; i <= newIndex; i++) {
      const cmd = commandStack[i];
      if (cmd.type === 'add' && cmd.object) {
        fabric.util.enlivenObjects([cmd.object], (objects: fabric.Object[]) => {
          objects.forEach((obj) => canvas.add(obj));
          canvas.renderAll();
        }, 'fabric');
      } else if (cmd.type === 'clear') {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
      }
    }

    setCommandIndex(newIndex);
    canvas.renderAll();
  };

  /**
   * Redo last undone action
   */
  const handleRedo = () => {
    if (commandIndex >= commandStack.length - 1) return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const newIndex = commandIndex + 1;
    const cmd = commandStack[newIndex];

    if (cmd.type === 'add' && cmd.object) {
      fabric.util.enlivenObjects([cmd.object], (objects: fabric.Object[]) => {
        objects.forEach((obj) => canvas.add(obj));
        canvas.renderAll();
      }, 'fabric');
    } else if (cmd.type === 'clear') {
      canvas.clear();
      canvas.backgroundColor = '#ffffff';
      canvas.renderAll();
    }

    setCommandIndex(newIndex);
  };

  /**
   * Zoom in
   */
  const handleZoomIn = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const zoom = canvas.getZoom();
    canvas.setZoom(zoom * 1.1);
    canvas.renderAll();
  };

  /**
   * Zoom out
   */
  const handleZoomOut = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const zoom = canvas.getZoom();
    canvas.setZoom(zoom / 1.1);
    canvas.renderAll();
  };

  /**
   * Reset zoom
   */
  const handleResetZoom = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.setZoom(1);
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
  };

  return (
    <div className="flex h-screen bg-white font-architects">
      {/* Sidebar */}
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-80 bg-zinc-50 border-r-4 border-zinc-900 overflow-y-auto shadow-lg"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center -rotate-3 shadow-lg">
                <PencilLine className="text-white" size={20} />
              </div>
              <h2 className="text-2xl font-gloria font-bold text-indigo-600">TeamSketch</h2>
            </div>
            <Link 
              to="/" 
              className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
              title="Back to Home"
            >
              <Home size={20} className="text-zinc-600" />
            </Link>
          </div>

          {/* Mode Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Mode</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('solo')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
                  mode === 'solo'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-zinc-700 border-2 border-zinc-200 hover:border-indigo-300'
                }`}
              >
                Solo
              </button>
              <button
                onClick={() => setMode('room')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1 ${
                  mode === 'room'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-zinc-700 border-2 border-zinc-200 hover:border-indigo-300'
                }`}
              >
                <Users size={16} />
                Room
              </button>
            </div>
          </div>

          {/* Room Controls */}
          {mode === 'room' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Room</h3>
              <div className="space-y-3">
                <div className={`text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center gap-1 ${
                  isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                
                {!currentRoomId ? (
                  <>
                    <button
                      onClick={handleCreateRoom}
                      disabled={!isConnected || isCreatingRoom}
                      className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingRoom ? '⏳ Creating...' : '➕ Create New Room'}
                    </button>
                    
                    <div className="text-center text-xs text-zinc-400 font-bold">
                      OR
                    </div>
                    
                    <input
                      type="text"
                      placeholder="Enter Room ID"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      className="w-full py-3 px-4 border-2 border-zinc-200 rounded-xl focus:border-indigo-500 focus:outline-none uppercase font-mono text-sm"
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={!isConnected || !roomId.trim()}
                      className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      🚪 Join Room
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-green-50 border-2 border-green-500 rounded-xl">
                      <div className="text-xs text-zinc-600 mb-1">Room ID:</div>
                      <div className="text-xl font-bold text-green-700 font-mono tracking-wider">
                        {currentRoomId}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCopyRoomId}
                      className={`w-full py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                        copySuccess 
                          ? 'bg-green-600 text-white' 
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      {copySuccess ? (
                        <>
                          <Check size={18} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={18} />
                          Copy Room ID
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleLeaveRoom}
                      className="w-full py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      🚪 Leave Room
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* Tool Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Tool</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setTool('pen')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                  tool === 'pen'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-white text-zinc-700 border-2 border-zinc-200 hover:border-orange-300'
                }`}
              >
                <PencilLine size={18} />
                Pen
              </button>
              <button
                onClick={() => setTool('pan')}
                className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                  tool === 'pan'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-white text-zinc-700 border-2 border-zinc-200 hover:border-purple-300'
                }`}
              >
                <Hand size={18} />
                Pan
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Color</h3>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-12 border-2 border-zinc-200 rounded-xl cursor-pointer"
            />
          </div>

          {/* Brush Size */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">
              Brush Size: <span className="text-indigo-600">{brushSize}px</span>
            </h3>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handleUndo}
                disabled={commandIndex < 0}
                className="w-full py-3 px-4 bg-zinc-600 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Undo size={18} />
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={commandIndex >= commandStack.length - 1}
                className="w-full py-3 px-4 bg-zinc-600 text-white rounded-xl font-bold hover:bg-zinc-700 transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Redo size={18} />
                Redo
              </button>
              <button
                onClick={handleClear}
                className="w-full py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Clear
              </button>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wide mb-3">Zoom</h3>
            <div className="space-y-2">
              <button
                onClick={handleZoomIn}
                className="w-full py-3 px-4 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <ZoomIn size={18} />
                Zoom In
              </button>
              <button
                onClick={handleZoomOut}
                className="w-full py-3 px-4 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <ZoomOut size={18} />
                Zoom Out
              </button>
              <button
                onClick={handleResetZoom}
                className="w-full py-3 px-4 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Reset Zoom
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Canvas */}
      <div className="flex-1 p-6 overflow-hidden bg-zinc-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full rounded-2xl border-2 border-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden bg-white"
        >
          <canvas ref={canvasRef} />
        </motion.div>
      </div>
    </div>
  );
};

export default Whiteboard;
