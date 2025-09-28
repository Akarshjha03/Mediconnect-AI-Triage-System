
import { MajorDiseaseInfo } from '../types';

export const MAJOR_DISEASES_DATA: MajorDiseaseInfo[] = [
  {
    keywords: ["chest pain", "pain in chest", "heart attack symptom", "angina"],
    response: "Chest pain can be a sign of a serious condition and should not be ignored. It's very important to seek immediate medical attention. Would you like assistance finding emergency services or shall I help you book an urgent appointment with one of our specialists?",
    offerBooking: true
  },
  {
    keywords: ["difficulty breathing", "shortness of breath", "can't breathe", "breathing trouble"],
    response: "Difficulty breathing is a serious symptom that requires prompt medical evaluation. Please seek medical help urgently. Can I help you book an appointment, or do you need information on emergency services?",
    offerBooking: true
  },
  {
    keywords: ["severe headache", "migraine", "worst headache ever", "sudden severe headache"],
    response: "A sudden, severe headache, or a headache that's very different from what you usually experience, needs to be checked by a doctor. This could be serious. Would you like to book an appointment?",
    offerBooking: true
  },
  {
    keywords: ["severe abdominal pain", "intense stomach pain", "stomach cramps severe"],
    response: "Severe abdominal pain can have many causes, some of which require urgent medical care. It's best to get this evaluated by a doctor. Can I assist you with booking an appointment?",
    offerBooking: true
  },
  {
    keywords: ["unexplained weight loss", "losing weight rapidly"],
    response: "Significant unexplained weight loss should always be investigated by a doctor to understand the cause. Would you like to schedule a consultation?",
    offerBooking: true
  },
  {
    keywords: ["high fever", "fever over 103", "fever 39.5", "persistent fever"],
    response: "A high or persistent fever needs medical attention to determine the cause and appropriate treatment. I can help you book an appointment to see a doctor.",
    offerBooking: true
  },
  {
    keywords: ["numbness", "weakness on one side", "slurred speech", "stroke symptoms", "facial drooping"],
    response: "Symptoms like numbness, weakness on one side of the body, or slurred speech could indicate a very serious condition like a stroke and require immediate emergency medical care. Please call emergency services (like 911 or your local equivalent) right away.",
    offerBooking: false // In this case, immediate emergency is better than booking
  },
  {
    keywords: ["suicidal thoughts", "want to harm myself", "feeling hopeless and want to die"],
    response: "I'm truly sorry to hear you're feeling this way. Please know that you're not alone and help is available. It's important to talk to someone right now. You can reach out to a crisis hotline or mental health professional. For immediate help, please contact a crisis line or emergency services. This is beyond my ability to help with directly, but your well-being is very important.",
    offerBooking: false
  }
];