export interface PrescriptionRequest {
  patientName: string;
  dateOfBirth: string;
  allergies: string;
  medications: string;
  renewalRequest: string;
  pharmacy: string;
}

export interface EmailJSConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: Date;
  source: 'system' | 'user' | 'ai' | 'tool';
  message: string;
  type?: 'info' | 'success' | 'error';
}