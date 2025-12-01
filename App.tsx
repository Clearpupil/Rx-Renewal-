import React, { useState, useEffect, useRef } from 'react';
import { 
  GoogleGenAI, 
  LiveServerMessage, 
  Modality, 
  Type, 
  FunctionDeclaration,
  Chat,
  GenerateContentResponse
} from '@google/genai';
import { 
  ConnectionStatus, 
  LogEntry, 
  PrescriptionRequest 
} from './types';
import { SYSTEM_INSTRUCTION, STRIPE_RENEWAL_LINK } from './constants';
import { sendEmailNotification, sendWhatsAppNotification } from './services/integrations';
import { createBlob, decodeAudioData, base64ToUint8Array } from './utils/audioUtils';
import { Visualizer } from './components/Visualizer';

// Tool Definitions
const submitPrescriptionTool: FunctionDeclaration = {
  name: 'submitPrescriptionRequest',
  description: 'Submits the gathered prescription renewal details to the doctor.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      patientName: { type: Type.STRING, description: "Full name of the patient" },
      dateOfBirth: { type: Type.STRING, description: "Date of birth (e.g., 9-1-1971)" },
      allergies: { type: Type.STRING, description: "Known allergies" },
      medications: { type: Type.STRING, description: "Current medications list" },
      renewalRequest: { type: Type.STRING, description: "Medication to renew" },
      pharmacy: { type: Type.STRING, description: "Preferred pharmacy name" },
    },
    required: ["patientName", "dateOfBirth", "allergies", "medications", "renewalRequest", "pharmacy"],
  },
};

const requestPaymentTool: FunctionDeclaration = {
  name: 'requestPayment',
  description: 'Triggers the display of the payment link for the patient to pay the renewal fee.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const App: React.FC = () => {
  // State
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessingTool, setIsProcessingTool] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [textInput, setTextInput] = useState('');

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Refs for sessions
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);

  const addLog = (message: string, source: LogEntry['source'], type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, source, type }]);
  };

  // --- Initial Checks ---
  useEffect(() => {
    // Detect if speech is supported
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!hasGetUserMedia) {
      console.warn("Audio not supported or restricted. Defaulting to text mode.");
      setIsTextMode(true);
      addLog("Audio input not detected. Switched to Text Mode.", 'system', 'info');
    }
    return () => cleanupAudio();
  }, []);

  const cleanupAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
  };

  // --- Shared Tool Execution Logic ---
  const executeTool = async (name: string, args: any): Promise<{ result: string }> => {
    setIsProcessingTool(true);
    try {
      if (name === 'requestPayment') {
        addLog("Initiating Payment Request...", 'tool', 'info');
        setShowPayment(true);
        return { result: "Payment link displayed to user. Waiting for user confirmation." };
      } 
      else if (name === 'submitPrescriptionRequest') {
        const reqArgs = args as PrescriptionRequest;
        addLog(`Processing renewal for ${reqArgs.patientName}...`, 'tool', 'info');
        
        // Execute Integrations
        const emailSuccess = await sendEmailNotification(reqArgs);
        const whatsappResult = await sendWhatsAppNotification(reqArgs);
        
        addLog(`Email Notification: ${emailSuccess ? 'Sent' : 'Failed'}`, 'tool', emailSuccess ? 'success' : 'error');
        addLog(`WhatsApp Notification: ${whatsappResult.success ? 'Sent' : 'Failed'} (${whatsappResult.message})`, 'tool', whatsappResult.success ? 'success' : 'info');

        return { result: "Request processed successfully. Notifications sent to Dr. Miller." };
      }
      return { result: "Tool not found" };
    } finally {
      setIsProcessingTool(false);
    }
  };

  // --- Gemini Live (Voice) ---
  const connectToGeminiLive = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setHasError(null);
      setShowPayment(false);
      addLog("Initializing Secure Audio Connection...", 'system');

      // 1. Setup Audio Input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const inputNode = audioContextRef.current.createGain();
      inputSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      addLog("Connecting to Oakley Medical Assistant...", 'system');

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [submitPrescriptionTool, requestPaymentTool] }],
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            addLog("Connected. Assistant is listening.", 'system', 'success');
            
            // Connect Audio Pipeline
            inputSourceRef.current?.connect(processorRef.current!);
            processorRef.current?.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              try {
                const audioData = base64ToUint8Array(base64Audio);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  audioData,
                  outputAudioContext,
                  24000,
                  1
                );
                
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              } catch (e) {
                console.error("Audio decode error", e);
              }
            }

            // 2. Handle Interruption
            if (message.serverContent?.interrupted) {
              addLog("User interrupted.", 'user');
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // 3. Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const { result } = await executeTool(fc.name, fc.args);
                
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      name: fc.name,
                      id: fc.id,
                      response: { result }
                    }
                  });
                });
              }
            }
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
            addLog("Session ended.", 'system');
          },
          onerror: (err) => {
            console.error(err);
            setHasError("Connection Error. Switching to Text Mode.");
            setStatus(ConnectionStatus.DISCONNECTED);
            setIsTextMode(true); // Fallback on error
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

      // Start Audio Streaming logic
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

    } catch (error: any) {
      console.error(error);
      setHasError("Microphone access failed. Switched to text mode.");
      setIsTextMode(true); // Fallback on catch
      setStatus(ConnectionStatus.DISCONNECTED);
    }
  };

  // --- Chat API (Text Mode) ---
  const startTextSession = async () => {
    setStatus(ConnectionStatus.CONNECTED);
    addLog("Text Session Started.", 'system', 'success');
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [submitPrescriptionTool, requestPaymentTool] }],
      },
    });

    // Initial greeting (optional trigger)
    // await handleTextMessage("Hello"); 
  };

  const handleTextMessage = async (text: string) => {
    if (!text.trim() || !chatSessionRef.current) return;
    
    const userMsg = text;
    setTextInput('');
    addLog(userMsg, 'user');

    try {
      let response = await chatSessionRef.current.sendMessage({ message: userMsg });
      
      // Loop to handle tool calls until we get a text response
      while (response.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
        const functionCall = response.candidates[0].content.parts[0].functionCall;
        const { result } = await executeTool(functionCall.name, functionCall.args);
        
        // Send tool response back
        response = await chatSessionRef.current.sendMessage({
           message: [{
             functionResponse: {
               name: functionCall.name,
               response: { result }
             }
           }]
        });
      }

      const modelText = response.text;
      if (modelText) {
        addLog(modelText, 'ai');
      }

    } catch (e: any) {
      console.error(e);
      addLog(`Error: ${e.message}`, 'system', 'error');
    }
  };


  // --- Logic Dispatcher ---
  const handleConnect = () => {
    if (isTextMode) {
      startTextSession();
    } else {
      connectToGeminiLive();
    }
  };

  const handleDisconnect = () => {
    cleanupAudio();
    sessionPromiseRef.current = null;
    chatSessionRef.current = null;
    setStatus(ConnectionStatus.DISCONNECTED);
    setShowPayment(false);
    addLog("Disconnected.", 'system');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 font-sans">
      {/* Medical Header */}
      <header className="bg-teal-800 text-white shadow-lg relative z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-teal-800 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V3a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Oakley Medical Centre</h1>
              <p className="text-xs text-teal-200 font-medium tracking-wide uppercase hidden sm:block">Automated Prescription Renewal System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-teal-900/50 py-1.5 px-4 rounded-full border border-teal-700">
            <div className={`h-2.5 w-2.5 rounded-full shadow-sm ${
              status === ConnectionStatus.CONNECTED ? 'bg-green-400 animate-pulse shadow-green-400/50' : 
              status === ConnectionStatus.CONNECTING ? 'bg-amber-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm font-medium uppercase tracking-wider text-teal-50">
              {status === ConnectionStatus.CONNECTED ? 'Online' : status}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col md:flex-row gap-6 relative">
        
        {/* Payment Modal Overlay */}
        {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-6">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
               <div className="text-center">
                  <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Payment Required</h3>
                  <p className="text-slate-500 mb-6">Please complete the renewal processing fee to finalize your request.</p>
                  
                  <a 
                    href={STRIPE_RENEWAL_LINK} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition-all transform hover:-translate-y-1 text-center mb-4 flex items-center justify-center gap-2"
                  >
                    <span>Pay via Stripe Securely</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  
                  <p className="text-xs text-slate-400 italic">
                    After payment, please tell the assistant: <br/>"I have completed the payment"
                  </p>
                  
                  <button 
                    onClick={() => setShowPayment(false)}
                    className="mt-4 text-slate-400 hover:text-slate-600 text-sm underline"
                  >
                    Close Payment Window
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Left Panel: Assistant Interface */}
        <section className="w-full md:w-3/5 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-white relative overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 transition-all duration-500 min-h-[500px]">
          
          {/* Decorative Background */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-5 pointer-events-none">
             <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="text-center z-10 max-w-lg mt-2">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-800 mb-3">
              {status === ConnectionStatus.CONNECTED 
                ? (isTextMode ? "Secure Chat Session" : "I'm listening...") 
                : "Prescription Renewal"}
            </h2>
            <p className="text-slate-500 text-base md:text-lg mb-8 leading-relaxed">
              {status === ConnectionStatus.CONNECTED 
                ? (isTextMode ? "Type your details below." : "Please speak naturally to provide your details.") 
                : "Connect to securely verify your identity and process your medication renewal request."}
            </p>
          </div>

          {/* Interaction Zone */}
          <div className="relative mb-12 z-10 w-full max-w-md flex flex-col items-center">
            
            {!isTextMode ? (
              // Voice UI
              <div className="relative">
                {status === ConnectionStatus.CONNECTED && (
                   <div className="absolute -inset-4 rounded-full bg-teal-100 animate-pulse opacity-50 blur-xl"></div>
                )}
                <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${
                  status === ConnectionStatus.CONNECTED 
                    ? 'bg-white border-4 border-teal-500' 
                    : 'bg-slate-50 border-4 border-slate-100'
                }`}>
                  {status === ConnectionStatus.CONNECTED ? (
                    <div className="w-full flex justify-center items-center">
                      <Visualizer isActive={true} color="bg-teal-600" />
                    </div>
                  ) : (
                    <div className="text-slate-300">
                      <svg className="w-20 h-20 md:w-24 md:h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Text UI
              <div className="w-full animate-fade-in">
                 {status === ConnectionStatus.CONNECTED ? (
                    <div className="w-full bg-slate-50 rounded-2xl p-2 border border-slate-200 shadow-inner flex items-center gap-2">
                       <input 
                          type="text" 
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTextMessage(textInput)}
                          placeholder="Type your message here..."
                          className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-slate-800 placeholder-slate-400 text-base"
                          autoFocus
                       />
                       <button 
                          onClick={() => handleTextMessage(textInput)}
                          className="bg-teal-600 text-white p-3 rounded-xl hover:bg-teal-700 transition-colors"
                       >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                       </button>
                    </div>
                 ) : (
                   <div className="w-full h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <p className="text-slate-400 text-sm">Chat interface will appear here</p>
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="z-10 flex flex-col items-center gap-4 w-full">
            {status === ConnectionStatus.CONNECTED ? (
              <button
                onClick={handleDisconnect}
                className="group px-8 py-3 bg-white text-red-500 rounded-full font-semibold hover:bg-red-50 hover:text-red-600 transition-all shadow-lg shadow-red-100 border border-red-100 flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 group-hover:animate-ping"></span>
                End {isTextMode ? 'Chat' : 'Secure'} Session
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full">
                <button
                  onClick={handleConnect}
                  disabled={status === ConnectionStatus.CONNECTING}
                  className={`px-10 py-4 rounded-full font-semibold text-white text-lg shadow-xl shadow-teal-600/20 transition-all flex items-center gap-3 ${
                    status === ConnectionStatus.CONNECTING 
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-teal-600 hover:bg-teal-700 transform hover:-translate-y-1'
                  }`}
                >
                  {status === ConnectionStatus.CONNECTING ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Establishing Connection...
                    </>
                  ) : (
                    <>
                      {isTextMode ? (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      )}
                      Start {isTextMode ? 'Text' : 'Voice'} Consultation
                    </>
                  )}
                </button>
                
                {/* Toggle Button */}
                <button 
                  onClick={() => setIsTextMode(!isTextMode)}
                  className="text-teal-600 text-sm font-medium hover:text-teal-800 underline decoration-teal-200 underline-offset-4 p-2"
                >
                  Switch to {isTextMode ? 'Voice' : 'Text'} Mode
                </button>
              </div>
            )}
          </div>

          {hasError && (
            <div className="mt-8 p-4 bg-amber-50 text-amber-700 text-sm rounded-xl border border-amber-100 flex items-center gap-2 animate-fade-in">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {hasError}
            </div>
          )}

          {isProcessingTool && (
            <div className="mt-6 flex flex-col items-center text-teal-600 animate-pulse">
              <span className="text-sm font-bold uppercase tracking-wide mb-1">Processing Request</span>
              <span className="text-xs text-teal-400">Syncing with Dr. Miller...</span>
            </div>
          )}
        </section>

        {/* Right Panel: Medical Chart / Transcript */}
        <section className="w-full md:w-2/5 bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-white flex flex-col overflow-hidden h-96 md:h-auto">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Session Transcript
            </h3>
            <span className="text-xs font-mono text-slate-400">REF: {new Date().toLocaleDateString()}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30 scroll-smooth">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm">Waiting for session start...</p>
              </div>
            )}
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`text-sm p-4 rounded-2xl border shadow-sm ${
                  log.type === 'success' ? 'bg-green-50 border-green-100 text-green-900' :
                  log.type === 'error' ? 'bg-red-50 border-red-100 text-red-900' :
                  log.source === 'tool' ? 'bg-indigo-50 border-indigo-100 text-indigo-900' :
                  log.source === 'user' ? 'bg-white border-slate-100 text-slate-700 ml-8' :
                  'bg-teal-50 border-teal-100 text-teal-900 mr-8'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    log.source === 'user' ? 'bg-slate-100 text-slate-500' : 
                    log.source === 'tool' ? 'bg-indigo-100 text-indigo-600' :
                    'bg-teal-100 text-teal-700'
                  }`}>
                    {log.source === 'ai' ? 'Oakley Assistant' : log.source}
                  </span>
                  <span className="text-[10px] opacity-40 font-mono">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{log.message}</p>
              </div>
            ))}
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-slate-400 text-xs border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <span>&copy; {new Date().getFullYear()} Oakley Medical Centre. All rights reserved.</span>
          <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-green-500"></span>
             <span>System Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;