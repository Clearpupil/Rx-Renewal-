
export interface PrescriptionRequest {
  fullName: string;
  dateOfBirth: string;
  allergies: string;
  currentMedications: string;
  renewalRequest: string;
  whatsappNumber: string;
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
