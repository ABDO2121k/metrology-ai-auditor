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
    navHealth: "Métriques Docker",
    
    // Landing Page
    heroBadge: "DÉPARTEMENT ÉLECTRIQUE · PLATEFORME AI & MÉTROLOGIE",
    heroTitle: "Système Intelligent d'Audit Métrologique",
    heroTitleGradient: "ISO 17025 & IA",
    heroDesc: "Validation automatisée des certificats d'étalonnage, calcul d'incertitudes élargie, vérification d'accréditation et détection des anomalies par réseaux de neurones.",
    ctaGetStarted: "Accéder au Studio",
    ctaLogin: "Se Connecter Maintenant",
    ctaDashboard: "Ouvrir mon Dashboard",
    
    // Role Chip & Title Translations
    role_ADMINISTRATOR: "Administrateur Système",
    role_TECHNICIAN: "Technicien Étalonneur",
    role_VALIDATOR: "Responsable Validation Qualité",
    role_DIRECTOR: "Directeur du Laboratoire",

    name_fati_sadiki: "Fatima-Ezzahrae Sadiki",
    name_tech_fati: "Technicien Étalonneur",
    name_val_fati: "Responsable Validation Qualité",
    name_director_fati: "Directeur du Laboratoire",
    
    // Stats & Admin Metrics
    statCerts: "Certificats Traités",
    statAccuracy: "Précision Audit",
    statPassRate: "Taux Conformité ISO 17025",
    statSpeed: "Temps Ingestion",
    statConnectedUsers: "Utilisateurs Connectés Temps Réel",
    statTotalUsers: "Comptes Utilisateurs Inscrits",
    statTotalUsersSub: "Table PostgreSQL users",
    statTotalCerts: "Total Certificats Audités",
    statTotalCertsSub: "Base de données Métrologie",
    statCompliancePass: "Conformité ISO 17025",
    statComplianceSub: "Règle |Corr| + U ≤ EMT",
    statAnomaliesCount: "Catégories d'Anomalies Détectées",
    statAnomaliesSub: "Modèle ONNX Anomaly",
    
    // Admin & User Management
    adminDashboardTitle: "Tableau de Bord Administrateur (Données Réelles Backend)",
    adminDashboardSub: "Statistiques réelles extraites de la base PostgreSQL et de l'Auth Gateway",
    adminTableTitle: "Répartition des Comptes Inscrits",
    adminTableManageLink: "Gérer les comptes →",
    adminUserTitle: "Gestion des Utilisateurs & Mots de Passe",
    adminUserSub: "Provisionnement des comptes et override administrateur",
    btnNewUser: "Nouveau Compte",
    tableUser: "Utilisateur",
    tableEmail: "Email",
    tableRole: "Rôle",
    tableStatus: "Statut",
    tableActions: "Actions Admin",
    btnOverridePass: "Override Admin Mot de Passe",
    statusActive: "Actif",
    
    // Docker Metrics
    dockerTitle: "Métriques Docker & Microservices System",
    dockerSub: "Surveillance temps réel des 9 conteneurs Docker de la plateforme",
    dockerHealthyCount: "Conteneurs Opérationnels",
    dockerClusterStatus: "Statut Conteneurs Docker",
    dockerOnline: "9/9 EN LIGNE",
    btnRefresh: "Actualiser",
    
    // Role Badges & Welcomes
    welcomeUser: "Bienvenue",
    roleTechnicianText: "Espace Technicien : Importez vos certificats et inspectez les extractions OCR.",
    roleValidatorText: "Espace Responsable Qualité : Inspectez les calculs d'incertitude et signez les certificats.",
    roleDirectorText: "Espace Directeur : Analysez les indicateurs de performance et les graphiques de conformité.",
    roleAdminText: "Espace Administrateur : Gérez les comptes utilisateurs, mots de passe et la santé des conteneurs.",

    // Features section (Key Features Grid)
    featOcrTitle: "Extraction OCR Multi-Modèle",
    featOcrDesc: "Extraction automatique des champs textuels depuis les PDF de certificats d'étalonnage via OCR multi-couche.",
    featMathTitle: "Calcul Incertitudes ISO",
    featMathDesc: "Vérification automatique de l'incertitude élargie U selon la règle |Corr| + U ≤ EMT de la norme ISO 17025.",
    featAiTitle: "IA & Détection d'Anomalies",
    featAiDesc: "Réseau neuronal ONNX pour détecter les anomalies critiques : EMT dépassés, tampons manquants, signatures absentes.",
    featReportTitle: "Rapports PDF & Audit Trail",
    featReportDesc: "Génération automatique de rapports d'audit PDF signés avec archivage sécurisé dans MinIO S3.",

    // Sidebar portal section labels
    sidebarTechnicianPortal: "Portail Technicien",
    sidebarValidatorPortal: "Portail Responsable Qualité",
    sidebarDirectorPortal: "Portail Directeur",
    sidebarAdminPortal: "Portail Administrateur",

    // Dashboard page
    dashboardWelcome: "Bienvenue dans votre espace de travail",
    dashboardSubtitle: "Tableau de bord personnalisé selon votre rôle dans la plateforme",
    dashboardTechKpi1: "Certificats Déposés",
    dashboardTechKpi2: "En Attente de Validation",
    dashboardTechKpi3: "Conformes ISO 17025",
    dashboardTechKpi4: "Anomalies Détectées",
    dashboardTechDesc: "Importez vos certificats PDF d'étalonnage, inspectez les extractions OCR et suivez le statut de validation en temps réel.",
    dashboardValDesc: "Auditez les certificats soumis, validez les calculs d'incertitude et signez électroniquement les rapports.",
    dashboardDirDesc: "Visualisez les KPIs de conformité ISO 17025 et les graphiques de performance du laboratoire.",
    dashboardAdminDesc: "Gérez les comptes utilisateurs, surveillez les 9 microservices Docker et contrôlez l'accès à la plateforme.",
    dashboardQuickLinks: "Accès Rapides",
    dashboardGoTo: "Accéder →",
    featuresTitle: "Fonctionnalités Clés du Système",
    featuresSubtitle: "Intelligence artificielle et métrologie au service de l'audit ISO 17025",

    // Upload page
    uploadSubtitle: "Déposez vos certificats d'étalonnage PDF pour traitement OCR et validation ISO 17025",
    uploadDropTitle: "Glissez-déposez vos fichiers PDF ici",
    uploadDropSub: "Cliquez ou glissez vos fichiers PDF (max 50 Mo par fichier)",
    uploadSHA256Check: "Vérification SHA-256 anti-doublons",
    uploadAllBtn: "Envoyer tout",
    uploadClearDone: "Effacer terminés",
    uploadOk: "Uploadés",
    uploadFailed: "Erreurs",
    uploadUploading: "Envoi en cours",
    uploadQueue: "File d'attente",
    uploadStatusPendingOCR: "En attente OCR → Traitement automatique",
    uploadStatusDuplicate: "Doublon rejeté — SHA-256 déjà présent",
    uploadStatusQueued: "En file d'attente",
    uploadDuplicateMsg: "Doublon détecté — Hash",
    uploadEmptyState: "Aucun fichier dans la file d'attente",

    // Certificates page
    certsSubtitle: "Registre de tous les certificats d'étalonnage soumis à la plateforme",
    certsTotal: "Total Certificats",
    certsConforme: "Conformes",
    certsPending: "En Attente OCR",
    certsAnomaly: "Anomalies",
    certsSearch: "Rechercher par numéro ou nom de fichier...",
    certsFilterAll: "Tous les statuts",
    certsLoading: "Chargement des certificats...",
    certsEmpty: "Aucun certificat trouvé",
    certsEmptySub: "Importez vos premiers certificats PDF via le Studio d'Upload",
    certColNumber: "N° Certificat",
    certColFilename: "Fichier Original",
    certColStatus: "Statut",
    certColHash: "SHA-256",
    certColDate: "Date Upload",
    certViewBtn: "Voir détails"
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
    navHealth: "Docker Metrics",
    
    // Landing Page
    heroBadge: "ELECTRICAL DEPT · AI & METROLOGY PLATFORM",
    heroTitle: "Intelligent Metrological Audit System",
    heroTitleGradient: "ISO 17025 & AI",
    heroDesc: "Automated calibration certificate verification, expanded uncertainty math, accreditation seal check, and neural network anomaly detection.",
    ctaGetStarted: "Open Studio",
    ctaLogin: "Sign In Now",
    ctaDashboard: "Go to Dashboard",

    // Role Chip & Title Translations
    role_ADMINISTRATOR: "System Administrator",
    role_TECHNICIAN: "Calibration Technician",
    role_VALIDATOR: "Quality Validator",
    role_DIRECTOR: "Laboratory Director",

    name_fati_sadiki: "Fatima-Ezzahrae Sadiki",
    name_tech_fati: "Calibration Technician",
    name_val_fati: "Quality Validator Expert",
    name_director_fati: "Laboratory Director",
    
    // Stats & Admin Metrics
    statCerts: "Certificates Processed",
    statAccuracy: "Audit Accuracy",
    statPassRate: "ISO 17025 Compliance Pass Rate",
    statSpeed: "Ingestion Latency",
    statConnectedUsers: "Real-Time Connected Users",
    statTotalUsers: "Registered User Accounts",
    statTotalUsersSub: "PostgreSQL users table",
    statTotalCerts: "Total Audited Certificates",
    statTotalCertsSub: "Metrology Database",
    statCompliancePass: "ISO 17025 Compliance",
    statComplianceSub: "Rule |Corr| + U ≤ EMT",
    statAnomaliesCount: "Detected Anomaly Categories",
    statAnomaliesSub: "ONNX Anomaly Model",
    
    // Admin & User Management
    adminDashboardTitle: "Administrator Dashboard (Real Backend Data)",
    adminDashboardSub: "Real statistics extracted from PostgreSQL database and Auth Gateway",
    adminTableTitle: "Registered Accounts Distribution",
    adminTableManageLink: "Manage accounts →",
    adminUserTitle: "User & Password Management",
    adminUserSub: "Account provisioning and administrator force overrides",
    btnNewUser: "New Account",
    tableUser: "User",
    tableEmail: "Email",
    tableRole: "Role",
    tableStatus: "Status",
    tableActions: "Admin Actions",
    btnOverridePass: "Admin Override Password",
    statusActive: "Active",
    
    // Docker Metrics
    dockerTitle: "Docker Metrics & Microservices System",
    dockerSub: "Real-time monitoring of all 9 Docker platform containers",
    dockerHealthyCount: "Healthy Containers",
    dockerClusterStatus: "Docker Cluster Status",
    dockerOnline: "9/9 ONLINE",
    btnRefresh: "Refresh",
    
    // Role Badges & Welcomes
    welcomeUser: "Welcome",
    roleTechnicianText: "Technician Portal: Upload certificates and inspect OCR bounding box extractions.",
    roleValidatorText: "Validator Portal: Audit uncertainty calculations and electronically sign certificates.",
    roleDirectorText: "Director Portal: Analyze executive KPIs, throughput trends, and compliance charts.",
    roleAdminText: "Administrator Portal: Manage user accounts, force password resets, and monitor container health.",

    // Features section (Key Features Grid)
    featOcrTitle: "Multi-Model OCR Extraction",
    featOcrDesc: "Automatic text field extraction from calibration certificate PDFs via multi-layer OCR pipelines.",
    featMathTitle: "ISO Uncertainty Calculation",
    featMathDesc: "Automatic verification of expanded uncertainty U using the ISO 17025 rule |Corr| + U ≤ EMT.",
    featAiTitle: "AI & Anomaly Detection",
    featAiDesc: "ONNX neural network to detect critical anomalies: exceeded EMTs, missing stamps, absent signatures.",
    featReportTitle: "PDF Reports & Audit Trail",
    featReportDesc: "Automatic generation of signed PDF audit reports with secure archiving in MinIO S3.",

    // Sidebar portal section labels
    sidebarTechnicianPortal: "Technician Portal",
    sidebarValidatorPortal: "Quality Validator Portal",
    sidebarDirectorPortal: "Director Portal",
    sidebarAdminPortal: "Administrator Portal",

    // Dashboard page
    dashboardWelcome: "Welcome to your workspace",
    dashboardSubtitle: "Personalized dashboard based on your platform role",
    dashboardTechKpi1: "Certificates Uploaded",
    dashboardTechKpi2: "Pending Validation",
    dashboardTechKpi3: "ISO 17025 Compliant",
    dashboardTechKpi4: "Anomalies Detected",
    dashboardTechDesc: "Upload calibration certificate PDFs, inspect OCR extractions, and track validation status in real-time.",
    dashboardValDesc: "Audit submitted certificates, validate uncertainty calculations, and electronically sign reports.",
    dashboardDirDesc: "Visualize ISO 17025 compliance KPIs and laboratory performance charts.",
    dashboardAdminDesc: "Manage user accounts, monitor 9 Docker microservices, and control platform access.",
    dashboardQuickLinks: "Quick Access",
    dashboardGoTo: "Go →",
    featuresTitle: "Key System Features",
    featuresSubtitle: "AI and metrology at the service of ISO 17025 audit automation",

    // Upload page
    uploadSubtitle: "Drop your calibration certificate PDFs for OCR processing and ISO 17025 validation",
    uploadDropTitle: "Drag and drop your PDF files here",
    uploadDropSub: "Click or drag PDF files (max 50 MB per file)",
    uploadSHA256Check: "SHA-256 anti-duplicate check",
    uploadAllBtn: "Upload All",
    uploadClearDone: "Clear Completed",
    uploadOk: "Uploaded",
    uploadFailed: "Errors",
    uploadUploading: "Uploading",
    uploadQueue: "Upload Queue",
    uploadStatusPendingOCR: "Pending OCR → Automatic processing",
    uploadStatusDuplicate: "Duplicate rejected — SHA-256 already exists",
    uploadStatusQueued: "Queued",
    uploadDuplicateMsg: "Duplicate detected — Hash",
    uploadEmptyState: "No files in the upload queue",

    // Certificates page
    certsSubtitle: "Registry of all calibration certificates submitted to the platform",
    certsTotal: "Total Certificates",
    certsConforme: "Compliant",
    certsPending: "Pending OCR",
    certsAnomaly: "Anomalies",
    certsSearch: "Search by certificate number or filename...",
    certsFilterAll: "All statuses",
    certsLoading: "Loading certificates...",
    certsEmpty: "No certificates found",
    certsEmptySub: "Upload your first PDF certificates via the Upload Studio",
    certColNumber: "Certificate No.",
    certColFilename: "Original File",
    certColStatus: "Status",
    certColHash: "SHA-256",
    certColDate: "Upload Date",
    certViewBtn: "View details"
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
    navHealth: "مقاييس دوكر",
    
    // Landing Page
    heroBadge: "قسم الكهرباء · منصة الذكاء الاصطناعي والمترولوجيا",
    heroTitle: "النظام الذكي للتدقيق المترولوجي",
    heroTitleGradient: "ISO 17025 والذكاء الاصطناعي",
    heroDesc: "التحقق التلقائي من شهادات المعايرة، حساب عدم اليقين الموسع، الفحص الآلي لأختام الاعتماد ورصد الشذوذ بالشبكات العصبية.",
    ctaGetStarted: "دخول الاستوديو",
    ctaLogin: "تسجيل الدخول الآن",
    ctaDashboard: "فتح لوحة التحكم",

    // Role Chip & Title Translations
    role_ADMINISTRATOR: "مسؤول النظام",
    role_TECHNICIAN: "فني معايرة",
    role_VALIDATOR: "مسؤول الاعتماد والجودة",
    role_DIRECTOR: "مدير المختبر",

    name_fati_sadiki: "فاطمة الزهراء صديقي",
    name_tech_fati: "فني معايرة معتمد",
    name_val_fati: "خبير الاعتماد والجودة",
    name_director_fati: "مدير المختبر الرئيسي",
    
    // Stats & Admin Metrics
    statCerts: "شهادة معالجة",
    statAccuracy: "دقة التدقيق",
    statPassRate: "نسبة مطابقة ISO 17025",
    statSpeed: "سرعة المعالجة",
    statConnectedUsers: "المستخدمون المتصلون حالياً",
    statTotalUsers: "حسابات المستخدمين المسجلة",
    statTotalUsersSub: "جدول المستخدمين في بوسطجريس",
    statTotalCerts: "إجمالي الشهادات المدققة",
    statTotalCertsSub: "قاعدة بيانات المترولوجيا",
    statCompliancePass: "مطابقة ISO 17025",
    statComplianceSub: "قاعدة |Corr| + U ≤ EMT",
    statAnomaliesCount: "فئات الشذوذ المكتشفة",
    statAnomaliesSub: "نموذج ONNX للشذوذ",
    
    // Admin & User Management
    adminDashboardTitle: "لوحة تحكم المسؤول (بيانات حقيقية من النظام)",
    adminDashboardSub: "إحصائيات حقيقية مستخرجة من قاعدة بيانات بوسطجريس والممر الآمن",
    adminTableTitle: "توزيع الحسابات المسجلة",
    adminTableManageLink: "إدارة الحسابات ←",
    adminUserTitle: "إدارة المستخدمين وكلمات المرور",
    adminUserSub: "تهيئة الحسابات وتجاوز كلمة المرور من المسؤول",
    btnNewUser: "حساب جديد",
    tableUser: "المستخدم",
    tableEmail: "البريد الإلكتروني",
    tableRole: "الدور",
    tableStatus: "الحالة",
    tableActions: "إجراءات المسؤول",
    btnOverridePass: "تجاوز كلمة المرور من المسؤول",
    statusActive: "نشط",
    
    // Docker Metrics
    dockerTitle: "مقاييس دوكر وصحة الحاويات",
    dockerSub: "المراقبة المباشرة لجميع حاويات النظام الـ 9",
    dockerHealthyCount: "الحاويات النشطة",
    dockerClusterStatus: "حالة حاويات دوكر",
    dockerOnline: "9/9 متصل",
    btnRefresh: "تحديث",
    
    // Role Badges & Welcomes
    welcomeUser: "مرحباً بك",
    roleTechnicianText: "فضاء الفني: قم برفع الشهادات وفحص مخرجات استخراج النصوص الضوئية.",
    roleValidatorText: "فضاء مسؤول الجودة: تدقيق حسابات الارتياب والتوقيع الإلكتروني على الشهادات.",
    roleDirectorText: "فضاء مدير المختبر: تحليل مؤشرات الأداء والرسومات البيانية للمطابقة.",
    roleAdminText: "فضاء المسؤول: إدارة حسابات المستخدمين وتغيير كلمات المرور ومراقبة الحاويات.",

    // Features section (Key Features Grid)
    featOcrTitle: "استخراج النصوص متعدد النماذج",
    featOcrDesc: "استخراج تلقائي للحقول النصية من ملفات PDF لشهادات المعايرة عبر سلاسل معالجة OCR متعددة الطبقات.",
    featMathTitle: "حساب عدم اليقين وفق ISO",
    featMathDesc: "التحقق التلقائي من عدم اليقين الموسع U وفق قاعدة ISO 17025: |Corr| + U ≤ EMT.",
    featAiTitle: "الذكاء الاصطناعي ورصد الشذوذ",
    featAiDesc: "شبكة عصبية ONNX لاكتشاف الشذوذات الحرجة: تجاوز حدود EMT، الأختام المفقودة، التوقيعات الغائبة.",
    featReportTitle: "تقارير PDF ومسار التدقيق",
    featReportDesc: "توليد تلقائي لتقارير تدقيق PDF موقعة مع أرشفة آمنة في MinIO S3.",

    // Sidebar portal section labels
    sidebarTechnicianPortal: "بوابة الفني",
    sidebarValidatorPortal: "بوابة مسؤول الجودة",
    sidebarDirectorPortal: "بوابة المدير",
    sidebarAdminPortal: "بوابة المسؤول",

    // Dashboard page
    dashboardWelcome: "مرحباً بك في فضاء العمل",
    dashboardSubtitle: "لوحة تحكم شخصية بناءً على دورك في المنصة",
    dashboardTechKpi1: "شهادات مرفوعة",
    dashboardTechKpi2: "في انتظار التحقق",
    dashboardTechKpi3: "مطابقة ISO 17025",
    dashboardTechKpi4: "شذوذات مكتشفة",
    dashboardTechDesc: "ارفع ملفات PDF لشهادات المعايرة وافحص مخرجات الاستخراج وتتبع حالة التحقق في الوقت الفعلي.",
    dashboardValDesc: "دقق الشهادات المقدمة وتحقق من حسابات الارتياب ووقع التقارير إلكترونياً.",
    dashboardDirDesc: "اعرض مؤشرات الأداء للمطابقة ISO 17025 ورسومات أداء المختبر البيانية.",
    dashboardAdminDesc: "أدر حسابات المستخدمين وراقب التسعة حاويات دوكر وتحكم في صلاحيات المنصة.",
    dashboardQuickLinks: "وصول سريع",
    dashboardGoTo: "اذهب →",
    featuresTitle: "الميزات الرئيسية للنظام",
    featuresSubtitle: "الذكاء الاصطناعي والمترولوجيا في خدمة التدقيق وفق ISO 17025",

    // Upload page
    uploadSubtitle: "ألق ملفات PDF لشهادات المعايرة لمعالجة OCR والتحقق من ISO 17025",
    uploadDropTitle: "اسحب ملفات PDF وألقها هنا",
    uploadDropSub: "انقر أو اسحب ملفات PDF (الحجم الأقصى 50 ميغابايت لكل ملف)",
    uploadSHA256Check: "فحص SHA-256 لمنع التكرار",
    uploadAllBtn: "رفع الكل",
    uploadClearDone: "مسح المكتملة",
    uploadOk: "مرفوعة",
    uploadFailed: "أخطاء",
    uploadUploading: "جاري الرفع",
    uploadQueue: "قائمة الرفع",
    uploadStatusPendingOCR: "في انتظار OCR → المعالجة التلقائية",
    uploadStatusDuplicate: "تكرار مرفوض — SHA-256 موجود مسبقاً",
    uploadStatusQueued: "في قائمة الانتظار",
    uploadDuplicateMsg: "تكرار مكتشف — البصمة",
    uploadEmptyState: "لا توجد ملفات في قائمة الرفع",

    // Certificates page
    certsSubtitle: "سجل جميع شهادات المعايرة المقدمة إلى المنصة",
    certsTotal: "إجمالي الشهادات",
    certsConforme: "مطابقة",
    certsPending: "في انتظار OCR",
    certsAnomaly: "شذوذات",
    certsSearch: "بحث برقم الشهادة أو اسم الملف...",
    certsFilterAll: "جميع الحالات",
    certsLoading: "جاري تحميل الشهادات...",
    certsEmpty: "لا توجد شهادات",
    certsEmptySub: "ارفع أول شهادات PDF عبر استوديو الرفع",
    certColNumber: "رقم الشهادة",
    certColFilename: "الملف الأصلي",
    certColStatus: "الحالة",
    certColHash: "SHA-256",
    certColDate: "تاريخ الرفع",
    certViewBtn: "عرض التفاصيل"
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
