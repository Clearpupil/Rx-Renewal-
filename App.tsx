
import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Stethoscope,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Send,
  RefreshCw,
  ChevronRight,
  FileText,
  Lock,
  ExternalLink,
  Accessibility,
  Edit,
  Save
} from 'lucide-react';
import { AppState, PrescriptionRequest } from './types';
import { useLiveSession } from './hooks/useLiveSession';
import Visualizer from './components/Visualizer';
import EditableField from './components/EditableField';
import { validatePrescriptionData, sanitizeData } from './utils/validation';

type PageView = 'HOME' | 'PRESCRIPTION';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<PageView>('HOME');
  
  // Voice App State
  const [appState, setAppState] = useState<AppState>(AppState.WELCOME);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [collectedData, setCollectedData] = useState<PrescriptionRequest | null>(null);
  const [hasClickedPayment, setHasClickedPayment] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<PrescriptionRequest | null>(null);

  const handleDataCollected = (data: PrescriptionRequest) => {
    // Sanitize and validate data
    const sanitized = sanitizeData(data);
    const validation = validatePrescriptionData(sanitized);

    if (validation.isValid) {
      setCollectedData(sanitized);
      setValidationErrors([]);
      setAppState(AppState.REVIEW);
    } else {
      setValidationErrors(validation.errors);
      setErrorMsg('Some information appears incomplete. Please try again.');
      setAppState(AppState.ERROR);
    }
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    setAppState(AppState.ERROR);
  };

  const { isConnected, isSpeaking, volume, startSession, stopSession } = useLiveSession({
    onDataCollected: handleDataCollected,
    onError: handleError
  });

  const handleStartConsultation = async () => {
    setAppState(AppState.CONNECTING);
    await startSession();
    setAppState(AppState.ACTIVE);
  };

  const handleEndConsultation = () => {
    stopSession();
    setAppState(AppState.WELCOME);
  };

  const handleReset = () => {
    setCollectedData(null);
    setErrorMsg(null);
    setValidationErrors([]);
    setHasClickedPayment(false);
    setIsEditMode(false);
    setEditedData(null);
    setAppState(AppState.WELCOME);
  };

  const handleEditToggle = () => {
    if (!isEditMode && collectedData) {
      setEditedData({ ...collectedData });
    }
    setIsEditMode(!isEditMode);
  };

  const handleSaveEdits = () => {
    if (editedData) {
      const validation = validatePrescriptionData(editedData);
      if (validation.isValid) {
        setCollectedData(editedData);
        setIsEditMode(false);
        setValidationErrors([]);
      } else {
        setValidationErrors(validation.errors);
      }
    }
  };

  const handleFieldChange = (field: keyof PrescriptionRequest, value: string) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value });
    }
  };

  const handleProceedToPayment = () => {
    setAppState(AppState.PAYMENT);
  };

  const handlePaymentClick = () => {
    setHasClickedPayment(true);
    window.open('https://buy.stripe.com/00w4gA1zD2YYfJQ04agQE0t', '_blank');
  };

  const handlePaymentCompleted = () => {
    setAppState(AppState.SEND);
  };

  const generateMailtoLink = () => {
    if (!collectedData) return '#';
    const subject = encodeURIComponent(`Prescription Renewal Request: ${collectedData.fullName}`);
    const body = encodeURIComponent(`
Dear Dr. Miller,

I would like to request a prescription renewal.

Patient Name: ${collectedData.fullName}
DOB: ${collectedData.dateOfBirth}
WhatsApp: ${collectedData.whatsappNumber}

Pharmacy: ${collectedData.pharmacy}

Allergies: ${collectedData.allergies}

Current Medications:
${collectedData.currentMedications}

Renewal Request:
${collectedData.renewalRequest}

(Note: Processing fee has been handled separately).

Sincerely,
${collectedData.fullName}
    `);
    return `mailto:drmiller@oakleymedicalcentre.com?subject=${subject}&body=${body}`;
  };

  const navigateTo = (view: PageView) => {
    setCurrentView(view);
    // If leaving prescription page, maybe we should stop session? 
    // For now we keep state but if user goes back it resumes where they left off.
  };

  // --- Render Components ---

  const renderHeader = () => (
    <header className="w-full px-6 py-8 flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto">
      <a 
        href="https://drsebmiller.com/"
        className="flex items-center space-x-2 text-slate-900 cursor-pointer mb-4 md:mb-0"
      >
        <Stethoscope className="w-6 h-6 md:w-8 md:h-8" />
        <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Oakley Medical Centre</h1>
      </a>
      
      <nav className="flex items-center space-x-6 text-sm md:text-base font-medium text-slate-900">
        <a href="https://drsebmiller.com/" className="hover:text-slate-600 transition-colors">Home</a>
        <a href="https://www.myhealthaccess.ca/branded/ottawa-virtual-care-clinic" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Appointment</a>
        <a href="https://drsebmiller.com/help/" className="hover:text-slate-600 transition-colors">Help</a>
        <a href="https://drsebmiller.com/" className="hover:text-slate-600 transition-colors">Educational</a>
        <button 
          onClick={() => navigateTo('PRESCRIPTION')} 
          className={`hover:text-slate-600 transition-colors ${currentView === 'PRESCRIPTION' ? 'font-bold underline decoration-2 underline-offset-4 decoration-teal-500' : ''}`}
        >
          Prescription
        </button>
      </nav>
    </header>
  );

  const renderHomeView = () => (
    <div className="flex flex-col items-center text-center space-y-8 py-8 md:py-16">
      <h2 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
        Welcome to Oakley<br/>Medical Centre
      </h2>
      
      <p className="text-xl text-slate-500">
        3059a Carling Avenue, Ottawa, K2B 7K4
      </p>

      <div className="mt-8 flex items-start justify-center space-x-6">
        <div className="pt-2 text-slate-400">
          <Accessibility className="w-8 h-8" />
        </div>
        
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden text-left shadow-sm">
           <table className="min-w-[300px]">
             <thead className="bg-slate-50 border-b border-slate-200">
               <tr>
                 <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Day</th>
                 <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Hours</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               <tr>
                 <td className="px-6 py-3 text-slate-700">Monday</td>
                 <td className="px-6 py-3 text-slate-700">10:00 - 16:00</td>
               </tr>
               <tr>
                 <td className="px-6 py-3 text-slate-700">Tuesday</td>
                 <td className="px-6 py-3 text-slate-700">10:00 - 16:00</td>
               </tr>
               <tr>
                 <td className="px-6 py-3 text-slate-700">Wednesday</td>
                 <td className="px-6 py-3 text-slate-700">10:00 - 16:00</td>
               </tr>
               <tr>
                 <td className="px-6 py-3 text-slate-700">Thursday</td>
                 <td className="px-6 py-3 text-slate-700">10:00 - 16:00</td>
               </tr>
               <tr>
                 <td className="px-6 py-3 text-slate-700">Friday</td>
                 <td className="px-6 py-3 text-slate-700">10:00 - 13:00</td>
               </tr>
             </tbody>
           </table>
        </div>
      </div>

      <div className="mt-12">
        <button 
          onClick={() => navigateTo('PRESCRIPTION')}
          className="bg-teal-600 text-white px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:bg-teal-700 transition-all hover:shadow-xl hover:-translate-y-1"
        >
          Renew Prescription Online
        </button>
      </div>
    </div>
  );

  const renderPrescriptionView = () => (
    <div className="w-full max-w-lg mx-auto">
      {/* State: WELCOME */}
      {appState === AppState.WELCOME && (
        <div className="text-center space-y-8 py-6">
          <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto text-teal-600 mb-6">
             <Mic className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Prescription Renewal</h2>
            <p className="text-slate-500 leading-relaxed">
              Use our secure voice assistant "Ava" to request your medication renewal. You'll need to provide your details, allergies, current medications, WhatsApp number, and preferred pharmacy.
            </p>
          </div>
          
          <button
            onClick={handleStartConsultation}
            className="w-full group relative flex items-center justify-center py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-teal-500/30"
            aria-label="Start voice consultation with Ava"
            role="button"
          >
            <Mic className="w-5 h-5 mr-2" aria-hidden="true" />
            Start Voice Request
          </button>
          <p className="text-xs text-slate-400" role="note">Microphone access required</p>
        </div>
      )}

      {/* State: CONNECTING / ACTIVE */}
      {(appState === AppState.CONNECTING || appState === AppState.ACTIVE) && (
        <div className="flex flex-col items-center space-y-8 min-h-[400px] py-6">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-colors duration-500 ${isSpeaking ? 'bg-indigo-50 shadow-indigo-100' : 'bg-teal-50 shadow-teal-100'}`}>
              {/* Pulse Ring Animation Layer */}
              <div className={`absolute inset-0 rounded-full ${appState === AppState.ACTIVE ? 'bg-teal-400/20 pulse-ring' : ''}`}></div>
              
              <div className="relative z-10 text-slate-700">
                 <Visualizer volume={volume} isActive={appState === AppState.ACTIVE} isSpeaking={isSpeaking} />
              </div>
            </div>
            
            <div className="mt-8 text-center max-w-xs">
              <h3 className="text-lg font-semibold text-slate-800" aria-live="polite" aria-atomic="true">
                {appState === AppState.CONNECTING ? "Connecting to Ava..." : (isSpeaking ? "Ava is speaking..." : "Listening...")}
              </h3>
              <p className="text-slate-400 text-sm mt-2 leading-snug" role="status">
                 {appState === AppState.CONNECTING ? "Establishing secure connection." : "Please speak clearly to provide your details and medication list."}
              </p>
            </div>
          </div>

          <button
            onClick={handleEndConsultation}
            className="mt-auto flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="Cancel consultation and end voice session"
            title="Cancel Consultation"
          >
            <MicOff className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* State: REVIEW */}
      {appState === AppState.REVIEW && collectedData && (
        <div className="space-y-6 py-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3 text-teal-700">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold text-slate-800">Review Information</h2>
            </div>
            <button
              onClick={isEditMode ? handleSaveEdits : handleEditToggle}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isEditMode
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isEditMode ? (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </>
              )}
            </button>
          </div>

          <p className="text-slate-500 text-sm">
            {isEditMode
              ? 'Edit any fields that need correction, then click Save.'
              : 'Please verify the details Ava collected before proceeding to payment.'}
          </p>

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-bold text-red-700 uppercase mb-2">Please fix these issues:</p>
              <ul className="space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="bg-slate-50 rounded-xl p-6 space-y-4 border border-slate-100 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <EditableField
                label="Patient Name"
                value={isEditMode ? editedData?.fullName || '' : collectedData.fullName}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('fullName', val)}
              />
              <EditableField
                label="Date of Birth"
                value={isEditMode ? editedData?.dateOfBirth || '' : collectedData.dateOfBirth}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('dateOfBirth', val)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <EditableField
                label="WhatsApp"
                value={isEditMode ? editedData?.whatsappNumber || '' : collectedData.whatsappNumber}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('whatsappNumber', val)}
              />
              <EditableField
                label="Pharmacy"
                value={isEditMode ? editedData?.pharmacy || '' : collectedData.pharmacy}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('pharmacy', val)}
              />
            </div>

            <EditableField
              label="Allergies"
              value={isEditMode ? editedData?.allergies || '' : collectedData.allergies}
              isEditing={isEditMode}
              onChange={(val) => handleFieldChange('allergies', val)}
            />

            <div className="pt-2 border-t border-slate-200">
              <EditableField
                label="Current Medications"
                value={isEditMode ? editedData?.currentMedications || '' : collectedData.currentMedications}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('currentMedications', val)}
                multiline={true}
              />
            </div>

            <div className="pt-2 border-t border-slate-200">
              <EditableField
                label="Renewal Request"
                value={isEditMode ? editedData?.renewalRequest || '' : collectedData.renewalRequest}
                isEditing={isEditMode}
                onChange={(val) => handleFieldChange('renewalRequest', val)}
                multiline={true}
              />
            </div>
          </div>

          {!isEditMode && (
            <button
              onClick={handleProceedToPayment}
              className="w-full flex items-center justify-center py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-lg"
            >
              Confirm & Proceed to Payment
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          )}
          
           <button onClick={handleReset} className="w-full text-center text-slate-400 text-xs hover:text-slate-600">
            Discard & Start Over
          </button>
        </div>
      )}

      {/* State: PAYMENT */}
      {appState === AppState.PAYMENT && (
        <div className="space-y-8 text-center py-6">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
             <Lock className="w-8 h-8" />
          </div>
          
          <div>
             <h2 className="text-xl font-bold text-slate-800">Processing Fee Required</h2>
             <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">
               To finalize your prescription request, a standard processing fee must be completed via our secure payment partner.
             </p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={handlePaymentClick}
              className="w-full flex items-center justify-center py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Pay Processing Fee
              <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
            </button>

            {hasClickedPayment && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-xs text-slate-400 mb-3">After completing payment, confirm below:</p>
                <button 
                  onClick={handlePaymentCompleted}
                  className="w-full flex items-center justify-center py-3 px-6 bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-600 text-slate-600 font-semibold rounded-xl transition-colors"
                >
                  I have completed payment
                </button>
              </div>
            )}
          </div>
          
          <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
            Your request will be generated immediately after payment confirmation.
          </p>
        </div>
      )}

      {/* State: SEND */}
      {appState === AppState.SEND && collectedData && (
        <div className="space-y-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <FileText className="w-6 h-6 text-teal-600" />
              <h2 className="text-lg font-bold">Renewal Request Form</h2>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-md">Ready</span>
          </div>
          
          <div className="bg-white border-2 border-slate-200 rounded-sm p-6 shadow-sm relative">
             {/* Paper styling effect */}
             <div className="absolute top-0 left-0 w-full h-2 bg-slate-100/50"></div>

             <div className="space-y-6 font-mono text-sm text-slate-800">
               <div className="border-b border-slate-100 pb-2">
                  <p className="text-xs text-slate-400 mb-1">PATIENT IDENTIFIER</p>
                  <p className="font-bold uppercase">{collectedData.fullName}</p>
                  <p className="text-slate-500">DOB: {collectedData.dateOfBirth}</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">WHATSAPP</p>
                    <p>{collectedData.whatsappNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">PHARMACY</p>
                    <p>{collectedData.pharmacy}</p>
                  </div>
               </div>

               <div>
                  <p className="text-xs text-slate-400 mb-1">ALLERGIES</p>
                  <p className="font-bold text-red-600">{collectedData.allergies}</p>
               </div>
               
               <div>
                  <p className="text-xs text-slate-400 mb-1">CURRENT MEDICATIONS</p>
                  <p>{collectedData.currentMedications}</p>
               </div>

               <div className="bg-yellow-50/50 p-3 -mx-3 border-l-2 border-yellow-400">
                  <p className="text-xs text-yellow-600 mb-1 font-bold">RENEWAL REQUIRED FOR</p>
                  <p className="text-lg font-bold">{collectedData.renewalRequest}</p>
               </div>
               
               <div className="pt-2 text-xs text-slate-400 flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  Processing Fee Paid
               </div>
             </div>
          </div>

          <a 
            href={generateMailtoLink()}
            className="w-full flex items-center justify-center py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-teal-500/30"
          >
            <Send className="w-5 h-5 mr-2" />
            Submit to Dr. Miller
          </a>

          <button onClick={handleReset} className="w-full text-center text-slate-400 text-xs hover:text-slate-600 mt-2">
            Start New Request
          </button>
        </div>
      )}

      {/* State: ERROR */}
      {appState === AppState.ERROR && (
        <div className="text-center space-y-6 py-6">
           <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
             <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Something went wrong</h3>
          <p className="text-slate-500 text-sm">{errorMsg || "An unexpected error occurred."}</p>

          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
              <p className="text-xs font-bold text-red-700 uppercase mb-2">Issues found:</p>
              <ul className="space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleReset}
            className="flex items-center justify-center w-full py-3 px-6 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {renderHeader()}
      
      <main className="flex-1 w-full px-4 pb-12">
        <div className="max-w-4xl mx-auto bg-white rounded-[40px] shadow-sm p-8 md:p-12 min-h-[600px] flex items-center justify-center relative overflow-hidden">
          {/* Content Container */}
          <div className="w-full relative z-10">
             {currentView === 'HOME' ? renderHomeView() : renderPrescriptionView()}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-slate-400 text-xs">
        <p>&copy; {new Date().getFullYear()} Oakley Medical Centre. All rights reserved.</p>
        <p className="mt-1 opacity-75">3059a Carling Avenue, Ottawa, K2B 7K4</p>
      </footer>
    </div>
  );
};

export default App;
