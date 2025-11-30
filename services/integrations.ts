import { EMAILJS_CONFIG, TWILIO_CONFIG } from '../constants';
import { PrescriptionRequest } from '../types';

export const sendEmailNotification = async (data: PrescriptionRequest): Promise<boolean> => {
  const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';

  const templateParams = {
    to_name: "Dr. Miller",
    from_name: "Oakley Voice Assistant",
    patient_name: data.patientName,
    date_of_birth: data.dateOfBirth,
    allergies: data.allergies,
    medications: data.medications,
    renewal_request: data.renewalRequest,
    whatsapp: TWILIO_CONFIG.toNumber,
    pharmacy: data.pharmacy,
    message: `Prescription Renewal Request for ${data.patientName}`
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_CONFIG.serviceId,
        template_id: EMAILJS_CONFIG.templateId,
        user_id: EMAILJS_CONFIG.publicKey,
        template_params: templateParams,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("EmailJS Error:", error);
    return false;
  }
};

export const sendWhatsAppNotification = async (data: PrescriptionRequest): Promise<{ success: boolean; message: string }> => {
  // Disabled - requires backend proxy for security
  return { success: false, message: 'WhatsApp requires backend setup' };
};
