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

export interface PrescriptionRequest {
  patientName: string;
  dateOfBirth: string;
  allergies: string;
  medications: string;
  renewalRequest: string;
  pharmacy: string;
}

export enum AppState {
  WELCOME = 'WELCOME',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  REVIEW = 'REVIEW',
  PAYMENT = 'PAYMENT',
  SEND = 'SEND',
  ERROR = 'ERROR'
}

export interface LiveSessionConfig {
  voiceName: string;
}
