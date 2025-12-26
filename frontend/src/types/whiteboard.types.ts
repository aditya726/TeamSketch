/**
 * TypeScript type definitions for whiteboard frontend
 */

/**
 * Represents a serialized Fabric.js drawing object
 */
export interface DrawingPayload {
  type: string;
  path?: Array<Array<string | number>>;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  [key: string]: unknown;
}

/**
 * Room state containing all canvas objects
 */
export interface RoomState {
  objects: DrawingPayload[];
}

/**
 * Socket event names (client -> server)
 */
export enum ClientEvents {
  JOIN_ROOM = 'join-room',
  LEAVE_ROOM = 'leave-room',
  DRAW = 'draw',
  CLEAR_CANVAS = 'clear-canvas',
}

/**
 * Socket event names (server -> client)
 */
export enum ServerEvents {
  ROOM_STATE = 'room-state',
  DRAW = 'draw',
  CLEAR_CANVAS = 'clear-canvas',
  ERROR = 'error',
}

/**
 * Whiteboard mode
 */
export type WhiteboardMode = 'solo' | 'room';

/**
 * Whiteboard tool
 */
export type WhiteboardTool = 'pen' | 'pan';

/**
 * Command for undo/redo functionality
 */
export interface Command {
  type: 'add' | 'clear';
  object?: DrawingPayload;
}
