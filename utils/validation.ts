import { PrescriptionRequest } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePrescriptionData(data: PrescriptionRequest): ValidationResult {
  const errors: string[] = [];

  // Validate full name
  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters');
  }

  // Validate date of birth (basic format check)
  if (!data.dateOfBirth || data.dateOfBirth.trim().length === 0) {
    errors.push('Date of birth is required');
  }

  // Validate WhatsApp number (basic check for numbers)
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!data.whatsappNumber || !phoneRegex.test(data.whatsappNumber)) {
    errors.push('Please provide a valid WhatsApp number');
  }

  // Validate pharmacy
  if (!data.pharmacy || data.pharmacy.trim().length < 2) {
    errors.push('Pharmacy name is required');
  }

  // Validate allergies (can be "None")
  if (!data.allergies || data.allergies.trim().length === 0) {
    errors.push('Allergies information is required (use "None" if no allergies)');
  }

  // Validate current medications
  if (!data.currentMedications || data.currentMedications.trim().length < 2) {
    errors.push('Current medications are required');
  }

  // Validate renewal request
  if (!data.renewalRequest || data.renewalRequest.trim().length < 2) {
    errors.push('Renewal request must specify which medication(s) need renewal');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizeData(data: PrescriptionRequest): PrescriptionRequest {
  return {
    fullName: data.fullName?.trim() || '',
    dateOfBirth: data.dateOfBirth?.trim() || '',
    allergies: data.allergies?.trim() || 'None',
    currentMedications: data.currentMedications?.trim() || '',
    renewalRequest: data.renewalRequest?.trim() || '',
    whatsappNumber: data.whatsappNumber?.trim() || '',
    pharmacy: data.pharmacy?.trim() || ''
  };
}
