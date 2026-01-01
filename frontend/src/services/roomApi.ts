/**
 * Room API Service
 * Handles room creation and validation
 */

import api from './api';

export interface CreateRoomResponse {
  success: boolean;
  roomId: string;
  message: string;
  createdBy: string;
}

export interface ValidateRoomResponse {
  success: boolean;
  isValid: boolean;
  roomId: string;
}

/**
 * Create a new room (requires authentication)
 */
export const createRoom = async (): Promise<CreateRoomResponse> => {
  const response = await api.post('/rooms/create');
  return response.data;
};

/**
 * Validate a room ID format
 */
export const validateRoom = async (roomId: string): Promise<ValidateRoomResponse> => {
  const response = await api.get(`/rooms/validate/${roomId}`);
  return response.data;
};
