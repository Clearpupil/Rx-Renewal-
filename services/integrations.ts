import { EMAILJS_CONFIG, TWILIO_CONFIG } from '../constants';
import { PrescriptionRequest } from '../types';

/**
 * Sends an email using EmailJS REST API
 */
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_CONFIG.serviceId,
        template_id: EMAILJS_CONFIG.templateId,
        user_id: EMAILJS_CONFIG.publicKey,
        template_params: templateParams,
      }),
    });

    if (response.ok) {
      return true;
    } else {
      console.error("EmailJS Error:", await response.text());
      return false;
    }
  } catch (error) {
    console.error("EmailJS Network Error:", error);
    return false;
  }
};

/**
 * Sends a WhatsApp message using Twilio API
 * NOTE: Calling Twilio directly from the browser usually triggers CORS errors.
 * In a real production app, this fetch must happen on a backend server.
 * We implement it here per request, but handle the likely fetch error gracefully.
 */
export const sendWhatsAppNotification = async (data: PrescriptionRequest): Promise<{ success: boolean; message: string }> => {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`;
  
  const messageBody = `
*New Prescription Renewal Request*
Patient: ${data.patientName}
DOB: ${data.dateOfBirth}
Renewal: ${data.renewalRequest}
Allergies: ${data.allergies}
Pharmacy: ${data.pharmacy}
  `.trim();

  // URL Encode the body for x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append('To', `whatsapp:${TWILIO_CONFIG.toNumber}`);
  params.append('From', `whatsapp:${TWILIO_CONFIG.fromNumber}`);
  params.append('Body', messageBody);

  const auth = btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (response.ok) {
      return { success: true, message: 'WhatsApp sent successfully' };
    } else {
      const errText = await response.text();
      console.error("Twilio API Error:", errText);
      // Fallback message for UI if CORS blocks it (which is standard browser security)
      if (errText.includes("Access-Control-Allow-Origin") || response.type === 'opaque') {
        return { success: false, message: 'CORS blocked Twilio call (Browser restriction). Logic is correct for Backend.' };
      }
      return { success: false, message: `Twilio failed: ${response.statusText}` };
    }
  } catch (error) {
    console.error("Twilio Network Error:", error);
    // Return true for demo purposes if it's just a CORS error, so the assistant flow doesn't break
    return { success: false, message: 'Network request failed (likely CORS). Setup requires backend proxy.' };
  }
};
