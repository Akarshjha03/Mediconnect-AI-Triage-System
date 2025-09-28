
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import Modal from './Modal';
import { ChatMessage, InitialFormData, Appointment, ChatOption } from '../types';
import { PaperAirplaneIcon } from './icons/SolidIcons';
import { APP_NAME, APPOINTMENT_FEE, BOT_GREETING_MESSAGE, MOCKED_PATIENT_PASSWORD } from '../constants.ts';
import { saveAppointment } from '../services/localStorageService';
import { loadRazorpayScript, initiateRazorpayPayment } from '../services/razorpayService';

interface ChatbotPopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: InitialFormData;
  onAppointmentBooked: (appointment: Appointment) => void;
}

enum ChatState {
  IDLE,
  CHATTING,
  AWAITING_PAYMENT,
  APPOINTMENT_BOOKED_SUCCESS,
}

const getSystemPrompt = (details?: InitialFormData) => {
    const initialDataString = details && (details.name || details.email || details.phone || details.symptom)
      ? `The user has already provided some initial details: Name: ${details.name || 'not provided'}, Email: ${details.email || 'not provided'}, Phone: ${details.phone || 'not provided'}, Symptom: ${details.symptom || 'not provided'}. Use these details to inform your conversation and only ask for what's missing when it's time to book.`
      : 'No initial details were provided.';

    return `You are a friendly, professional, and empathetic medical AI assistant for "MediConnect AI". Your goal is to help users understand their symptoms and book appointments.

Your workflow has two main steps:

**Step 1: Triage and Report**
First, engage with the user to understand their symptoms. Once you have enough information, you MUST generate a "Triage Report".
The Triage Report should be formatted exactly like this, using markdown and emojis:

🩺 **Triage Report**
- **Urgency:** [e.g., Low, Moderate, High, Emergency]
- **Probable Conditions:** [e.g., Common cold, Viral infection]
- **Recommendation:** [e.g., Rest and hydrate. See a doctor if symptoms persist for 3 days.]

After presenting the report, ask the user if they would like to book an appointment based on the recommendation.

**Step 2: Appointment Booking**
If the user agrees to book an appointment, you MUST then conversationally collect the following four pieces of information if you don't have them already:
1. Full Name
2. Email Address
3. Phone Number
4. The primary symptom (which you should already have from the triage step).

${initialDataString}

After confirming all four details with the user, your *very next* response MUST be ONLY a single, raw JSON object, without any markdown formatting (like \`\`\`json), comments, or extra text. The JSON object must have this exact structure:
{
  "action": "BOOK_APPOINTMENT",
  "details": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "symptom": "string"
  }
}
The application will use this JSON to start the payment process.

**IMPORTANT GUIDELINES & EXAMPLES (TRAINING DATA):**

**Medical Emergencies:**
- If a user mentions symptoms of a medical emergency (e.g., "chest pain", "difficulty breathing", "stroke symptoms", "severe bleeding", "loss of consciousness", "facial drooping", "slurred speech"), your Triage Report's Urgency MUST be "Emergency".
- The recommendation MUST be to call emergency services (like 911) or go to the nearest ER immediately.
- **Example Emergency:**
  - User: "I have severe chest pain and my left arm feels numb."
  - Your Triage Report:
    🩺 **Triage Report**
    - **Urgency:** Emergency
    - **Probable Conditions:** Potential cardiac event (e.g., heart attack).
    - **Recommendation:** This is a medical emergency. Please call 911 or go to the nearest emergency room immediately. Do not delay.
- In emergency cases, do NOT offer to book an appointment. Prioritize telling them to seek immediate help.

**Major but Non-Emergency Conditions:**
- For symptoms like "high fever", "severe abdominal pain", or "unexplained weight loss".
- **Example Major:**
  - User: "I have had a fever over 103 for two days."
  - Your Triage Report:
    🩺 **Triage Report**
    - **Urgency:** High
    - **Probable Conditions:** Significant infection.
    - **Recommendation:** You should see a doctor as soon as possible, within the next 12-24 hours.
  - Your next message: "Based on this, would you like me to help you book an appointment?"

**Minor Conditions:**
- For symptoms like "common cold", "runny nose", "slight headache".
- **Example Minor:**
  - User: "I have a runny nose and I'm sneezing a lot."
  - Your Triage Report:
    🩺 **Triage Report**
    - **Urgency:** Low
    - **Probable Conditions:** Common cold, allergies.
    - **Recommendation:** Rest, stay hydrated. Over-the-counter medication may help. Consider booking an appointment if symptoms don't improve in 5-7 days.
  - Your next message: "Would you like to book an appointment for a later date just in case, or do you have any other questions?"`;
};


const ChatbotPopup: React.FC<ChatbotPopupProps> = ({ isOpen, onClose, initialData, onAppointmentBooked }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentChatState, setCurrentChatState] = useState<ChatState>(ChatState.IDLE);
  const chatRef = useRef<Chat | null>(null);

  const addMessageToChat = (text: string, sender: 'user' | 'bot' | 'system', options?: ChatOption[], isStreaming = false, id?: string) => {
    const newMessage: ChatMessage = {
      id: id || Date.now().toString() + Math.random(),
      text,
      sender,
      timestamp: Date.now(),
      options,
      isStreaming,
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, isBotTyping]);

  const initializeChat = useCallback(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      chatRef.current = ai.chats.create({
        model: 'gemini-2.5-flash-preview-04-17',
        config: {
          systemInstruction: getSystemPrompt(initialData),
        },
      });

      let welcomeMessage = BOT_GREETING_MESSAGE;
      if (initialData?.name) {
          welcomeMessage = `Hello ${initialData.name}! I'm your ${APP_NAME} assistant. I see you're interested in help regarding "${initialData.symptom || 'your health'}". How can I assist you?`;
      }
      
      addMessageToChat(welcomeMessage, 'bot');
      setCurrentChatState(ChatState.CHATTING);
    } catch (error) {
      console.error("Error initializing Gemini Chat:", error);
      addMessageToChat("I'm sorry, I'm having trouble connecting to my AI brain. Please try again in a moment.", 'bot');
    }
  }, [initialData]);

  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setIsBotTyping(false);
      setIsLoading(false);
      initializeChat();
    } else {
      chatRef.current = null;
      setCurrentChatState(ChatState.IDLE);
    }
  }, [isOpen, initializeChat]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || userInput;
    if (!textToSend.trim() || isBotTyping || isLoading) return;

    addMessageToChat(textToSend, 'user');
    setUserInput('');
    setIsBotTyping(true);

    const botMessageId = addMessageToChat('', 'bot', undefined, true);

    try {
      if (!chatRef.current) {
        throw new Error("Chat is not initialized.");
      }

      const stream = await chatRef.current.sendMessageStream({ message: textToSend });

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        setMessages(prev => prev.map(m => m.id === botMessageId ? {...m, text: fullResponse} : m));
      }

      let finalBotText = fullResponse;
      try {
        const jsonResponse = JSON.parse(fullResponse);
        if (jsonResponse.action === 'BOOK_APPOINTMENT' && jsonResponse.details) {
          finalBotText = `Great! I have all your details. To confirm your appointment for "${jsonResponse.details.symptom}", we'll proceed with the nominal consultation fee.`;
          setCurrentChatState(ChatState.AWAITING_PAYMENT);
          handlePayment(jsonResponse.details);
        }
      } catch (e) {
        // Not a JSON response, so it's a regular chat message.
      }
      
      setMessages(prev => prev.map(m => m.id === botMessageId ? {...m, text: finalBotText, isStreaming: false} : m));

    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      setMessages(prev => prev.map(m => m.id === botMessageId ? {...m, text: "I'm sorry, an error occurred. Please try again.", isStreaming: false} : m));
    } finally {
      setIsBotTyping(false);
    }
  };
  
  const handlePayment = async (details: InitialFormData) => {
    if (!details?.name || !details?.email || !details?.phone || !details?.symptom) {
       addMessageToChat("Something went wrong. It seems I'm missing some details for the booking. Could you please provide your name, email, phone, and symptom again?", 'bot');
       setCurrentChatState(ChatState.CHATTING);
       return;
    }

    setIsLoading(true);
    addMessageToChat("Loading payment gateway...", 'system');

    const razorpayLoaded = await loadRazorpayScript();
    if (!razorpayLoaded) {
      addMessageToChat("Failed to load payment gateway. Please try again.", 'system');
      setIsLoading(false);
      setCurrentChatState(ChatState.CHATTING);
      return;
    }

    initiateRazorpayPayment({
      amount: APPOINTMENT_FEE,
      currency: 'INR',
      name: details.name,
      description: `Appointment for ${details.symptom}`,
      email: details.email,
      contact: details.phone,
      onSuccess: (response) => {
        const patientId = `PID-${Date.now()}`;
        const newAppointment: Appointment = {
          id: response.razorpay_payment_id,
          name: details.name,
          email: details.email,
          phone: details.phone,
          symptom: details.symptom,
          bookingDate: new Date().toISOString(),
          patientId: patientId,
          paymentStatus: 'completed',
        };
        saveAppointment(newAppointment);
        onAppointmentBooked(newAppointment);
        addMessageToChat(
          `Thank you, ${details.name}! Your payment was successful and your appointment is booked.\nYour Patient ID is ${patientId}.\n\nA login has been automatically created for you. You can log in anytime using:\nUsername: ${details.email}\nPassword: "${MOCKED_PATIENT_PASSWORD}"\n\nYou can now close this chat or ask more questions.`,
          'bot'
        );
        setCurrentChatState(ChatState.APPOINTMENT_BOOKED_SUCCESS);
        setIsLoading(false);
      },
      onFailure: (errorMsg) => {
        addMessageToChat(
          `The payment failed or was cancelled. Reason: ${errorMsg}\n\nDon't worry, your appointment is not booked yet. You can try the payment again or ask me to change the details. What would you like to do?`, 
          'bot'
        );
        setIsLoading(false);
        setCurrentChatState(ChatState.CHATTING);
      },
    });
  };

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.sender === 'user';
    const isSystem = msg.sender === 'system';

    if (isSystem) {
      return (
        <div key={msg.id} className="text-center my-2">
          <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-3 py-1">{msg.text}</span>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex items-end gap-2 my-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
            AI
          </div>
        )}
        <div 
          className={`px-4 py-2.5 rounded-2xl max-w-sm md:max-w-md break-words ${
            isUser 
              ? 'bg-primary text-white rounded-br-lg' 
              : 'bg-white text-dark rounded-bl-lg shadow-sm'
          }`}
        >
          {msg.isStreaming && !msg.text ? (
             <div className="flex items-center justify-center space-x-1 p-2">
                <span className="sr-only">Typing...</span>
                <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce"></div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{msg.text}</p>
          )}
          {msg.options && (
            <div className="mt-3 border-t border-gray-300/50 pt-2 flex flex-wrap gap-2">
              {msg.options.map((opt, index) => (
                <button
                  key={index}
                  onClick={opt.action}
                  disabled={isLoading}
                  className="bg-secondary/20 text-secondary hover:bg-secondary/40 text-sm font-semibold px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${APP_NAME} Assistant`} size="lg">
      <div className="flex flex-col h-[70vh]">
        <div className="flex-grow p-4 overflow-y-auto bg-extralight rounded-t-lg">
          {messages.map(renderMessage)}
          {isBotTyping && !messages.some(m => m.isStreaming) && (
             <div className="flex items-end gap-2 my-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                AI
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-white text-dark rounded-bl-lg shadow-sm">
                 <div className="flex items-center justify-center space-x-1 p-2">
                    <span className="sr-only">Typing...</span>
                    <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-white border-t border-gray-200 rounded-b-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-3"
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || isBotTyping}
              className="flex-grow w-full px-4 py-2.5 text-gray-900 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-75 transition-shadow"
              autoFocus
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isLoading || isBotTyping}
              className="bg-primary text-white p-3 rounded-full hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-110"
              aria-label="Send Message"
            >
              <PaperAirplaneIcon className="w-6 h-6" />
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
};

export default ChatbotPopup;
