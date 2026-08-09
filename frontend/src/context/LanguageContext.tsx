'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'fr' | 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

interface LanguageContextType {
  lang: Language;
  dir: Direction;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Topbar & Nav
    appName: "PROCESS INSTRUMENTS",
    appSub: "Plateforme d'Audit Métrologique & AI Anomaly",
    isoBadge: "ISO/IEC 17025",
    loginBtn: "Se Connecter",
    logoutBtn: "Déconnexion",
    profilePwd: "Mot de passe",
    navHome: "Accueil",
    navUpload: "Studio Dépôt PDF",
    navCerts: "Registre Certificats",
    nav5Certs: "Studio 5 Certificats",
    navDirector: "Dashboard Directeur",
    navReports: "Archive Rapports PDF",
    navUsers: "Gestion Utilisateurs",
    navHealth: "Santé Microservices",
    
    // Landing Page
    heroBadge: "DÉPARTEMENT ÉLECTRIQUE · PLATFORME AI & MÉTROLOGIE",
    heroTitle: "Système Intelligent d'Audit Métrologique",
    heroTitleGradient: "ISO 17025 & IA",
    heroDesc: "Validation automatisée des certificats d'étalonnage, calcul d'incertitudes élargie, vérification d'accréditation et détection des anomalies par réseaux de neurones.",
    ctaGetStarted: "Accéder au Studio",
    ctaLogin: "Se Connecter Maintenant",
    ctaDashboard: "Ouvrir mon Dashboard",
    
    // Stats
    statCerts: "Certificats Traités",
    statAccuracy: "Précision Audit",
    statPassRate: "Taux Conformité",
    statSpeed: "Temps Ingestion",
    
    // Features
    featOcrTitle: "Extraction OCR & Sceaux",
    featOcrDesc: "Détection automatique des logos d'accréditation, numéros de certificat et conditions ambiantes (23°C / 50% HR).",
    featMathTitle: "Vérification ISO 17025",
    featMathDesc: "Calcul de correction |Corr| + U ≤ EMT, contrôles d'hystérésis et suivi des étalons de référence.",
    featAiTitle: "Détection Anomales ONNX",
    featAiDesc: "Scoring de risque IA (0% à 100%) et détection des sceaux manquants, signatures absentes et falsifications.",
    featReportTitle: "Rapports Audit MinIO",
    featReportDesc: "Génération automatique des procès-verbaux d'audit certifiés PDF et archivage S3 sécurisé.",
    
    // Role Badges & Welcomes
    welcomeUser: "Bienvenue",
    roleTechnicianText: "Espace Technicien : Importez vos certificats et inspectez les extractions OCR.",
    roleValidatorText: "Espace Responsable Qualité : Inspectez les calculs d'incertitude et signez les certificats.",
    roleDirectorText: "Espace Directeur : Analysez les indicateurs de performance et les graphiques de conformité.",
    roleAdminText: "Espace Administrateur : Gérez les comptes utilisateurs, mots de passe et la santé des conteneurs."
  },
  en: {
    // Topbar & Nav
    appName: "PROCESS INSTRUMENTS",
    appSub: "Metrological Audit & AI Anomaly Platform",
    isoBadge: "ISO/IEC 17025",
    loginBtn: "Sign In",
    logoutBtn: "Sign Out",
    profilePwd: "Password",
    navHome: "Home",
    navUpload: "PDF Upload Studio",
    navCerts: "Certificates Registry",
    nav5Certs: "5 Certs Studio",
    navDirector: "Director Dashboard",
    navReports: "PDF Audit Archive",
    navUsers: "User Management",
    navHealth: "Microservices Health",
    
    // Landing Page
    heroBadge: "ELECTRICAL DEPT · AI & METROLOGY PLATFORM",
    heroTitle: "Intelligent Metrological Audit System",
    heroTitleGradient: "ISO 17025 & AI",
    heroDesc: "Automated calibration certificate verification, expanded uncertainty math, accreditation seal check, and neural network anomaly detection.",
    ctaGetStarted: "Open Studio",
    ctaLogin: "Sign In Now",
    ctaDashboard: "Go to Dashboard",
    
    // Stats
    statCerts: "Certificates Processed",
    statAccuracy: "Audit Accuracy",
    statPassRate: "Compliance Pass Rate",
    statSpeed: "Ingestion Latency",
    
    // Features
    featOcrTitle: "OCR & Seals Extraction",
    featOcrDesc: "Automated accreditation seal classification, cert numbers, and ambient conditions (23°C / 50% RH).",
    featMathTitle: "ISO 17025 Verification",
    featMathDesc: "Guard-band calculation |Corr| + U ≤ EMT, hysteresis checks, and reference standards expiry tracking.",
    featAiTitle: "ONNX Anomaly Scoring",
    featAiDesc: "AI risk score (0% to 100%) flagging missing signatures, missing stamps, and data falsifications.",
    featReportTitle: "MinIO PDF Reports",
    featReportDesc: "Automatic generation of certified PDF audit reports stored in secure MinIO S3 buckets.",
    
    // Role Badges & Welcomes
    welcomeUser: "Welcome",
    roleTechnicianText: "Technician Portal: Upload certificates and inspect OCR bounding box extractions.",
    roleValidatorText: "Validator Portal: Audit uncertainty calculations and electronically sign certificates.",
    roleDirectorText: "Director Portal: Analyze executive KPIs, throughput trends, and compliance charts.",
    roleAdminText: "Administrator Portal: Manage user accounts, force password resets, and monitor container health."
  },
  ar: {
    // Topbar & Nav
    appName: "بروسيس إنسترومينتس",
    appSub: "منصة التدقيق المترولوجي ورصد الشذوذ بالذكاء الاصطناعي",
    isoBadge: "ISO/IEC 17025",
    loginBtn: "تسجيل الدخول",
    logoutBtn: "تسجيل الخروج",
    profilePwd: "كلمة المرور",
    navHome: "الرئيسية",
    navUpload: "استوديو رفع الملفات",
    navCerts: "سجل شهادات المعايرة",
    nav5Certs: "استوديو 5 شهادات",
    navDirector: "لوحة تحكم المدير",
    navReports: "أرشيف تقارير PDF",
    navUsers: "إدارة المستخدمين",
    navHealth: "صحة الخدمات المصغرة",
    
    // Landing Page
    heroBadge: "قسم الكهرباء · منصة الذكاء الاصطناعي والمترولوجيا",
    heroTitle: "النظام الذكي للتدقيق المترولوجي",
    heroTitleGradient: "ISO 17025 والذكاء الاصطناعي",
    heroDesc: "التحقق التلقائي من شهادات المعايرة، حساب عدم اليقين الموسع، الفحص الآلي لأختام الاعتماد ورصد الشذوذ بالشبكات العصبية.",
    ctaGetStarted: "دخول الاستوديو",
    ctaLogin: "تسجيل الدخول الآن",
    ctaDashboard: "فتح لوحة التحكم",
    
    // Stats
    statCerts: "شهادة معالجة",
    statAccuracy: "دقة التدقيق",
    statPassRate: "نسبة المطابقة",
    statSpeed: "سرعة المعالجة",
    
    // Features
    featOcrTitle: "استخراج OCR والأختام",
    featOcrDesc: "التعرف التلقائي على شعارات الاعتماد، أرقام الشهادات والظروف البيئية (23°C / 50% HR).",
    featMathTitle: "التحقق وفق ISO 17025",
    featMathDesc: "حساب معادلة التصحيح |Corr| + U ≤ EMT وفحص التكرارية وصلاحية المعايير المرجعية.",
    featAiTitle: "تقييم الشذوذ بالذكاء الاصطناعي",
    featAiDesc: "مؤشر المخاطر الذكي (0% إلى 100%) وكشف التواقيع والأختام المفقودة والتزوير.",
    featReportTitle: "تقارير تدقيق MinIO",
    featReportDesc: "إنشاء تقارير التدقيق المعتمدة بصيغة PDF وتخزينها بأمان في حاويات MinIO S3.",
    
    // Role Badges & Welcomes
    welcomeUser: "مرحباً بك",
    roleTechnicianText: "فضاء الفني: قم برفع الشهادات وفحص مخرجات استخراج النصوص الضوئية.",
    roleValidatorText: "فضاء مسؤول الجودة: تدقيق حسابات الارتياب والتوقيع الإلكتروني على الشهادات.",
    roleDirectorText: "فضاء مدير المختبر: تحليل مؤشرات الأداء والرسومات البيانية للمطابقة.",
    roleAdminText: "فضاء المسؤول: إدارة حسابات المستخدمين وتغيير كلمات المرور ومراقبة الحاويات."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('fr');
  const [dir, setDir] = useState<Direction>('ltr');

  useEffect(() => {
    const saved = localStorage.getItem('app_lang') as Language;
    if (saved && (saved === 'fr' || saved === 'en' || saved === 'ar')) {
      setLangState(saved);
      setDir(saved === 'ar' ? 'rtl' : 'ltr');
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    const newDir = newLang === 'ar' ? 'rtl' : 'ltr';
    setDir(newDir);
    localStorage.setItem('app_lang', newLang);
    document.documentElement.dir = newDir;
    document.documentElement.lang = newLang;
  };

  const t = (key: string): string => {
    return translations[lang][key] || translations['fr'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
