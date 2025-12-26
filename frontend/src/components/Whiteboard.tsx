/**
 * Collaborative Whiteboard Component
 * Uses Fabric.js for drawing and Socket.IO for real-time collaboration
 */

import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { io, Socket } from 'socket.io-client';
import {
  WhiteboardMode,
  WhiteboardTool,
  DrawingPayload,
  RoomState,
  Command,
  ClientEvents,
  ServerEvents,
} from '../types/whiteboard.types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

const Whiteboard: React.FC = () => {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isDrawingRef = useRef<boolean>(false);

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

    if (tool === 'pen') {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = color;
      brush.width = brushSize;
      canvas.freeDrawingBrush = brush;
    } else if (tool === 'pan') {
      canvas.isDrawingMode = false;
      enablePanMode(canvas);
    }
  }, [tool, color, brushSize]);

  /**
   * Enable pan mode for canvas navigation
   */
  const enablePanMode = (canvas: fabric.Canvas) => {
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      if (tool === 'pan') {
        isPanning = true;
        canvas.selection = false;
        lastPosX = evt.clientX;
        lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning && tool === 'pan') {
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
    });

    canvas.on('mouse:up', () => {
      if (tool === 'pan') {
        isPanning = false;
        canvas.selection = true;
      }
    });
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
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* Sidebar */}
      <div
        style={{
          width: '280px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRight: '1px solid #ddd',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0 }}>🎨 Whiteboard</h2>

        {/* Mode Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Mode</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setMode('solo')}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: mode === 'solo' ? '#4CAF50' : '#fff',
                color: mode === 'solo' ? '#fff' : '#000',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Solo
            </button>
            <button
              onClick={() => setMode('room')}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: mode === 'room' ? '#2196F3' : '#fff',
                color: mode === 'room' ? '#fff' : '#000',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Room
            </button>
          </div>
        </div>

        {/* Room Controls */}
        {mode === 'room' && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Room</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: isConnected ? 'green' : 'red' }}>
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={!!currentRoomId}
                style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
              {!currentRoomId ? (
                <button
                  onClick={handleJoinRoom}
                  disabled={!isConnected}
                  style={{
                    padding: '10px',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isConnected ? 'pointer' : 'not-allowed',
                  }}
                >
                  Join Room
                </button>
              ) : (
                <>
                  <div style={{ fontSize: '12px', color: 'green' }}>
                    📍 In room: {currentRoomId}
                  </div>
                  <button
                    onClick={handleLeaveRoom}
                    style={{
                      padding: '10px',
                      backgroundColor: '#f44336',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Leave Room
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tool Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Tool</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setTool('pen')}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: tool === 'pen' ? '#FF9800' : '#fff',
                color: tool === 'pen' ? '#fff' : '#000',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✏️ Pen
            </button>
            <button
              onClick={() => setTool('pan')}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: tool === 'pan' ? '#9C27B0' : '#fff',
                color: tool === 'pan' ? '#fff' : '#000',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✋ Pan
            </button>
          </div>
        </div>

        {/* Color Picker */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Color</h3>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Brush Size */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Brush Size: {brushSize}px</h3>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Actions */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleUndo}
              disabled={commandIndex < 0}
              style={{
                padding: '10px',
                backgroundColor: commandIndex >= 0 ? '#607D8B' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: commandIndex >= 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ↶ Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={commandIndex >= commandStack.length - 1}
              style={{
                padding: '10px',
                backgroundColor: commandIndex < commandStack.length - 1 ? '#607D8B' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: commandIndex < commandStack.length - 1 ? 'pointer' : 'not-allowed',
              }}
            >
              ↷ Redo
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '10px',
                backgroundColor: '#f44336',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Zoom</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleZoomIn}
              style={{
                padding: '10px',
                backgroundColor: '#00BCD4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🔍+ Zoom In
            </button>
            <button
              onClick={handleZoomOut}
              style={{
                padding: '10px',
                backgroundColor: '#00BCD4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🔍- Zoom Out
            </button>
            <button
              onClick={handleResetZoom}
              style={{
                padding: '10px',
                backgroundColor: '#00BCD4',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🔄 Reset Zoom
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, padding: '20px', overflow: 'hidden' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default Whiteboard;
