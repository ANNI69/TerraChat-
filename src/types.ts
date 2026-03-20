/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from './firebase';

export interface UserSettings {
  darkMode: boolean;
  themeAccent: string;
  aiLanguage: string;
  speechSpeed: number;
  autoPlayResponses: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'user' | 'admin';
  settings: UserSettings;
  createdAt: Timestamp;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  thinking?: string;
  createdAt: Timestamp;
}

export type AppScreen = 'login' | 'register' | 'chat' | 'voice' | 'settings';
