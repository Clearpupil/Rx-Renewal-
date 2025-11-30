
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, base64ToUint8Array, decodeAudioData } from '../utils/audio';
import { PrescriptionRequest } from '../types';

interface UseLiveSessionProps {
  onDataCollected: (data: PrescriptionRequest) => void;
  onError: (error: string) => void;
}

export const useLiveSession = ({ onDataCollected, onError }: UseLiveSessionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Model is speaking
  const [volume, setVolume] = useState(0); // For visualizer

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Queue Management
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isSessionActiveRef = useRef(false);

  const stopSession = useCallback(() => {
    isSessionActiveRef.current = false;
    
    // Stop all playing audio
    scheduledSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    scheduledSourcesRef.current.clear();

    // Close input stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Disconnect audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close context if needed (optional, usually kept alive, but good to suspend)
    if (inputAudioContextRef.current?.state === 'running') {
      inputAudioContextRef.current.suspend();
    }
    
    // Close session
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
         try { session.close(); } catch(e) { console.error(e); }
      });
      sessionPromiseRef.current = null;
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const startSession = useCallback(async () => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not found. Please add it to .env.local");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      // Request Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Define Tool
      const submitRequestTool: FunctionDeclaration = {
        name: 'submitPrescriptionRequest',
        description: 'Submit the collected prescription renewal details after the user has confirmed them.',
        parameters: {
          type: Type.OBJECT,
          required: ['fullName', 'dateOfBirth', 'allergies', 'currentMedications', 'renewalRequest', 'whatsappNumber', 'pharmacy'],
          properties: {
            fullName: { type: Type.STRING, description: "The patient's full name" },
            dateOfBirth: { type: Type.STRING, description: "The patient's date of birth" },
            allergies: { type: Type.STRING, description: "List of known drug allergies, or 'None' if the patient has none." },
            currentMedications: { type: Type.STRING, description: "List of medications the patient is currently taking" },
            renewalRequest: { type: Type.STRING, description: "Specific medication(s) requested for renewal" },
            whatsappNumber: { type: Type.STRING, description: "The patient's most convenient WhatsApp number for communication" },
            pharmacy: { type: Type.STRING, description: "The name and/or location of the patient's preferred pharmacy" }
          }
        }
      };

      // Connect to Live API
      isSessionActiveRef.current = true;
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `You are 'Ava', a professional and empathetic medical receptionist at Oakley Medical Centre. 
          Your goal is to collect a prescription renewal request from the patient.
          You MUST collect these 7 pieces of information:
          1. Full Name
          2. Date of Birth
          3. Any Drug Allergies (ask explicitly)
          4. Current Medications (list them)
          5. Which medication needs renewal
          6. Most convenient WhatsApp number for communication
          7. Preferred Pharmacy (so the doctor can inform them when it is sent)
          
          Speak clearly and concisely. Do not ask for everything at once. Guide the user through the questions.
          If they say they have no allergies, record "None".
          Once you have all the information, summarize it back to the user and ask for confirmation.
          ONLY when the user says "yes" or confirms the details are correct, say exactly: "Please review your prescription request and send - Dr Miller will inform you as soon as it is completed" and then IMMEDIATELY call the 'submitPrescriptionRequest' tool.
          Do not call the tool until the user has explicitly confirmed the summary.`,
          tools: [{ functionDeclarations: [submitRequestTool] }]
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setIsConnected(true);
            
            // Setup Audio Input Streaming
            if (!inputAudioContextRef.current || !audioStreamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(audioStreamRef.current);
            sourceRef.current = source;
            
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              if (!isSessionActiveRef.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Calculate volume for visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(rms);

              // Send to API
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             // Handle Tool Calls
             if (msg.toolCall) {
                console.log("Tool call received:", msg.toolCall);
                for (const fc of msg.toolCall.functionCalls) {
                  if (fc.name === 'submitPrescriptionRequest') {
                     // We have the data!
                     const data = fc.args as unknown as PrescriptionRequest;
                     onDataCollected(data);
                     
                     // Respond to model (though we will likely stop session shortly)
                     sessionPromise.then(session => {
                        session.sendToolResponse({
                          functionResponses: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: "Success" }
                          }
                        });
                     });
                     
                     stopSession(); // End conversation on success
                     return; 
                  }
                }
             }

             // Handle Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData && outputAudioContextRef.current) {
               setIsSpeaking(true);
               const ctx = outputAudioContextRef.current;
               
               // Sync Playback
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 base64ToUint8Array(audioData),
                 ctx,
                 24000,
                 1
               );

               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(ctx.destination);
               
               source.addEventListener('ended', () => {
                 scheduledSourcesRef.current.delete(source);
                 if (scheduledSourcesRef.current.size === 0) {
                    setIsSpeaking(false);
                 }
               });
               
               source.start(nextStartTimeRef.current);
               scheduledSourcesRef.current.add(source);
               nextStartTimeRef.current += audioBuffer.duration;
             }
             
             // Handle Interruption
             if (msg.serverContent?.interrupted) {
               console.log("Model interrupted");
               scheduledSourcesRef.current.forEach(s => s.stop());
               scheduledSourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsSpeaking(false);
             }
          },
          onclose: () => {
            console.log('Session closed');
            setIsConnected(false);
            setIsSpeaking(false);
          },
          onerror: (e) => {
            console.error('Session error:', e);
            onError("Connection error occurred. Please try again.");
            stopSession();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      onError("Failed to start audio session. Please check permissions.");
    }
  }, [onDataCollected, onError, stopSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return {
    isConnected,
    isSpeaking,
    volume,
    startSession,
    stopSession
  };
};
