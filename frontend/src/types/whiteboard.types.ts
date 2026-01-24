/**
 * TypeScript type definitions for whiteboard frontend
 */

/**
 * Represents a serialized Fabric.js drawing object
 */
export interface DrawingPayload {
  id?: string;
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
 * User in a room
 */
export interface RoomUser {
  id: string;
  name: string;
  socketId: string;
}

/**
 * Room state containing all canvas objects
 */
export interface RoomState {
  objects: DrawingPayload[];
  users: RoomUser[];
}

/**
 * Socket event names (client -> server)
 */
export enum ClientEvents {
  JOIN_ROOM = 'join-room',
  LEAVE_ROOM = 'leave-room',
  DRAW = 'draw',
  MODIFY = 'modify',
  DELETE = 'delete',
  CLEAR_CANVAS = 'clear-canvas',
}

/**
 * Socket event names (server -> client)
 */
export enum ServerEvents {
  ROOM_STATE = 'room-state',
  DRAW = 'draw',
  MODIFY = 'modify',
  DELETE = 'delete',
  CLEAR_CANVAS = 'clear-canvas',
  ERROR = 'error',
  USERS_UPDATE = 'users-update',
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
