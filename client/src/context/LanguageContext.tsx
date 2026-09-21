import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'si' | 'es' | 'fr' | 'ar';

interface Translations {
  [key: string]: {
    [lang in Language]?: string;
  };
}

const TRANSLATIONS: Translations = {
  welcome: {
    en: 'Welcome to',
    si: 'ආයුබෝවන්',
    es: 'Bienvenido a',
    fr: 'Bienvenue à',
    ar: 'مرحبا بكم في'
  },
  room: {
    en: 'Room',
    si: 'කාමරය',
    es: 'Habitación',
    fr: 'Chambre',
    ar: 'غرفة'
  },
  howCanWeHelp: {
    en: 'How can we assist you today?',
    si: 'අප ඔබට උපකාර කළ හැක්කේ කෙසේද?',
    es: '¿Cómo podemos ayudarle hoy?',
    fr: 'Comment pouvons-nous vous aider aujourd\'hui?',
    ar: 'كيف يمكننا مساعدتك اليوم؟'
  },
  roomMaintenance: {
    en: 'Room Maintenance',
    si: 'කාමර නඩත්තුව',
    es: 'Mantenimiento de Habitación',
    fr: 'Entretien de Chambre',
    ar: 'صيانة الغرفة'
  },
  roomService: {
    en: 'Room Supplies & Service',
    si: 'කාමර සේවා සහ සැපයුම්',
    es: 'Servicio y Suministros',
    fr: 'Service et Fournitures',
    ar: 'خدمة الغرف والمستلزمات'
  },
  housekeeping: {
    en: 'Housekeeping',
    si: 'පිරිසිදු කිරීමේ සේවාව',
    es: 'Limpieza de Habitación',
    fr: 'Ménage',
    ar: 'خدمة تنظيف الغرف'
  },
  contactFrontOffice: {
    en: 'Contact Front Office',
    si: 'ඉදිරිපස කාර්යාලය අමතන්න',
    es: 'Contactar Recepción',
    fr: 'Contacter la Réception',
    ar: 'الاتصال بمكتب الاستقبال'
  },
  tipRoomStaff: {
    en: 'Tip Room Staff',
    si: 'කාර්ය මණ්ඩලයට උපහාර මුදලක් (Tip)',
    es: 'Dar Propina al Personal',
    fr: 'Pourboire au Personnel',
    ar: 'إكرامية الموظفين'
  },
  sendRequest: {
    en: 'Send Request',
    si: 'ඉල්ලීම යවන්න',
    es: 'Enviar Solicitud',
    fr: 'Envoyer la Demande',
    ar: 'إرسال الطلب'
  },
  trackStatus: {
    en: 'Track Status',
    si: 'තත්වය නිරීක්ෂණය කරන්න',
    es: 'Ver Estado',
    fr: 'Suivre le Statut',
    ar: 'تتبع الحالة'
  },
  submitted: {
    en: 'Submitted',
    si: 'ඉදිරිපත් කරන ලදී',
    es: 'Enviado',
    fr: 'Soumis',
    ar: 'تم التقديم'
  },
  inProgress: {
    en: 'In Progress',
    si: 'ක්‍රියාත්මක වෙමින් පවතී',
    es: 'En Progreso',
    fr: 'En Cours',
    ar: 'قيد التنفيذ'
  },
  completed: {
    en: 'Completed',
    si: 'සම්පූර්ණයි',
    es: 'Completado',
    fr: 'Terminé',
    ar: 'مكتمل'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('resortcare_lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('resortcare_lang', lang);
  };

  const t = (key: string, fallback?: string): string => {
    const entry = TRANSLATIONS[key];
    if (entry && entry[language]) {
      return entry[language]!;
    }
    if (entry && entry.en) {
      return entry.en;
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
