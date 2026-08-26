import type { Language } from '@/context/LanguageContext';

/**
 * Audit findings, in the reader's language.
 *
 * The audit runs in Python and emits English prose, so a French operator was
 * reading French chrome wrapped around English findings — and an Arabic one
 * got no Arabic at all. Each finding now carries a stable `code` and its
 * `params`, and the sentence is built here instead.
 *
 * Anything without a translation falls back to the English `message` the
 * backend sent, so a newly added finding degrades to English rather than
 * disappearing.
 */

export type Severity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface Finding {
  code: string;
  severity: Severity;
  params: Record<string, unknown>;
  message: string;
}

type Template = (p: Record<string, any>) => string;

const FR: Record<string, Template> = {
  POINT_NO_EMT: (p) =>
    `Point ${p.point} : aucun EMT n'est imprimé sur le certificat, la conformité n'a pas pu être décidée.`,
  POINT_EXCEEDS_EMT: (p) =>
    `Point ${p.point} (${p.nominal} ${p.unit}) : |Correction| + U = ${p.guard_band} dépasse l'EMT de ${p.emt}.`,
  POINT_MATH_MISMATCH: (p) =>
    `Point ${p.point} : le certificat indique une erreur de ${p.stated}, le recalcul donne ${p.recomputed}.`,
  POINT_HYSTERESIS: (p) =>
    `Point ${p.point} : hystérésis de ${p.delta}, au-delà du seuil de ${p.threshold}.`,
  NO_EMT_ANYWHERE: (p) =>
    `Aucun EMT n'est imprimé pour les ${p.total} point(s) de mesure : aucun verdict de conformité ne peut être prononcé.`,
  PARTIAL_VERDICT: (p) =>
    `Conformité prononcée sur ${p.decided} point(s) sur ${p.total} ; les autres ne portent pas d'EMT.`,
  CHRONOLOGY: (p) => `Erreur de chronologie : ${p.detail}`,
  PAST_NEXT_CALIBRATION: (p) =>
    `Le certificat a dépassé sa date de prochain étalonnage (${p.date}).`,
  NO_TRACEABILITY: () =>
    `Aucune traçabilité d'étalon de référence n'a été trouvée sur le certificat.`,
  STANDARD_UNVERIFIABLE: () =>
    `La validité de l'étalon de référence n'a pas pu être vérifiée (date d'étalonnage ou échéance de l'étalon manquante).`,
  STANDARD_EXPIRED: (p) =>
    `L'étalon de référence ${p.standard ?? ''} a expiré le ${p.expiry} mais a servi à l'étalonnage du ${p.calibration}.`.replace(
      /\s+/g,
      ' ',
    ),
  TEMPERATURE_OUT_OF_RANGE: (p) =>
    `Température ambiante de ${p.value} °C, hors de la plage ${p.nominal} ± ${p.tolerance} °C.`,
  TEMPERATURE_MISSING: () =>
    `Température ambiante introuvable — vérifiez le bloc des conditions d'étalonnage.`,
  HUMIDITY_OUT_OF_RANGE: (p) =>
    `Humidité relative de ${p.value} %HR, au-delà du maximum de ${p.maximum} %HR.`,
  HUMIDITY_MISSING: () =>
    `Humidité ambiante introuvable — vérifiez le bloc des conditions d'étalonnage.`,
  PAGE_COUNT_MISSING: () =>
    `Le nombre de pages annoncé est absent du cartouche du certificat.`,
  PAGE_COUNT_MISMATCH: (p) =>
    `Nombre de pages incohérent : le certificat en annonce ${p.announced}, ${p.extracted} ont été extraites.`,
  PAGE_COUNT_MISMATCH_OCR: (p) =>
    `Nombre de pages incohérent : ${p.announced} annoncée(s), ${p.extracted} extraite(s). Le repère de page a été lu par OCR — à vérifier manuellement.`,
  CACHET_ABSENT: () => `Le cachet de validation du laboratoire est absent du document.`,
  CACHET_UNVERIFIABLE: () =>
    `Le cachet de validation n'a pas pu être vérifié automatiquement — confirmez-le visuellement avant de valider.`,
  SIGNATURE_ABSENT: () => `La signature de validation est absente du document.`,
  SIGNATURE_UNVERIFIABLE: () =>
    `La signature n'a pas pu être vérifiée automatiquement — confirmez-la visuellement avant de valider.`,
  MISSING_CRITICAL_FIELD: (p) => `Champ critique manquant ou illisible : ${p.field}`,
  DOCUMENT_TRUNCATED: (p) =>
    `Document incomplet : la dernière page (${p.last_page}) annonce une suite (« ${p.marker} »), le certificat se poursuit sur un feuillet absent du fichier.`,
  NO_POINTS_TRUNCATED: () =>
    `Aucun point de mesure n'a pu être extrait : la page qui porte le tableau de mesures ne fait pas partie du document.`,
  SUGGEST_RESCAN: () =>
    `Re-numérisez le certificat avec toutes ses pages, puis déposez-le à nouveau.`,
  NO_POINTS: (p) =>
    `Aucun point de mesure n'a pu être extrait du certificat${p.reason ? ` (${p.reason})` : ''}.`,
  SUGGEST_ENABLE_VISION: () =>
    `Activez la couche vision (OPENAI_API_KEY) pour lire les tableaux de mesures des certificats scannés, ou saisissez les points manuellement.`,
  TABLE_PARTIAL: (p) => `Tableau de mesures lu partiellement — ${p.reason}`,
  COLUMNS_INFERRED: (p) =>
    `${p.count} point(s) reconstruits depuis l'OCR brut sans en-têtes de colonnes : le rattachement référence/incertitude/EMT est déduit et la conformité n'a pas été prononcée.`,
  READING_DISAGREEMENT: (p) => `Désaccord entre les lectures — ${p.detail}`,
  VISION_UNAVAILABLE: (p) => `Couche vision indisponible : ${p.detail}`,
  LOCAL_OCR_DEGRADED: (p) => `OCR local dégradé : ${p.detail}`,
  FIELD_UNREADABLE: (p) => `Champ signalé illisible par la couche vision : ${p.field}`,
};

const EN: Record<string, Template> = {
  POINT_NO_EMT: (p) =>
    `Point ${p.point}: no EMT is printed on the certificate, so conformity could not be decided.`,
  POINT_EXCEEDS_EMT: (p) =>
    `Point ${p.point} (${p.nominal} ${p.unit}): |Correction| + U = ${p.guard_band} exceeds the EMT of ${p.emt}.`,
  POINT_MATH_MISMATCH: (p) =>
    `Point ${p.point}: the certificate states an error of ${p.stated}; recomputing gives ${p.recomputed}.`,
  POINT_HYSTERESIS: (p) =>
    `Point ${p.point}: hysteresis of ${p.delta}, beyond the ${p.threshold} threshold.`,
  NO_EMT_ANYWHERE: (p) =>
    `No EMT is printed for any of the ${p.total} measurement point(s), so no conformity verdict can be reached.`,
  PARTIAL_VERDICT: (p) =>
    `Conformity decided on ${p.decided} of ${p.total} point(s); the rest carry no EMT.`,
  CHRONOLOGY: (p) => `Chronology error: ${p.detail}`,
  PAST_NEXT_CALIBRATION: (p) => `The certificate is past its next calibration date (${p.date}).`,
  NO_TRACEABILITY: () => `No reference standard traceability was found on the certificate.`,
  STANDARD_UNVERIFIABLE: () =>
    `Reference standard validity could not be verified (calibration date or standard expiry missing).`,
  STANDARD_EXPIRED: (p) =>
    `Reference standard ${p.standard ?? ''} expired on ${p.expiry} but was used for calibration on ${p.calibration}.`.replace(
      /\s+/g,
      ' ',
    ),
  TEMPERATURE_OUT_OF_RANGE: (p) =>
    `Ambient temperature ${p.value} °C is outside ${p.nominal} ± ${p.tolerance} °C.`,
  TEMPERATURE_MISSING: () => `Ambient temperature not found — check the calibration conditions block.`,
  HUMIDITY_OUT_OF_RANGE: (p) =>
    `Relative humidity ${p.value} %RH exceeds the ${p.maximum} %RH maximum.`,
  HUMIDITY_MISSING: () => `Ambient humidity not found — check the calibration conditions block.`,
  PAGE_COUNT_MISSING: () => `The announced page count is missing from the title block.`,
  PAGE_COUNT_MISMATCH: (p) =>
    `Page count mismatch: the certificate announces ${p.announced}, ${p.extracted} were extracted.`,
  PAGE_COUNT_MISMATCH_OCR: (p) =>
    `Page count mismatch: ${p.announced} announced, ${p.extracted} extracted. The page marker was read by OCR — verify manually.`,
  CACHET_ABSENT: () => `The laboratory validation cachet is not present on the document.`,
  CACHET_UNVERIFIABLE: () =>
    `The validation cachet could not be verified automatically — confirm it visually before validating.`,
  SIGNATURE_ABSENT: () => `The validation signature is not present on the document.`,
  SIGNATURE_UNVERIFIABLE: () =>
    `The signature could not be verified automatically — confirm it visually before validating.`,
  MISSING_CRITICAL_FIELD: (p) => `Critical field missing or illegible: ${p.field}`,
  DOCUMENT_TRUNCATED: (p) =>
    `Document is incomplete: the last page (${p.last_page}) announces a continuation ("${p.marker}"), so the certificate runs onto a sheet that is not in this file.`,
  NO_POINTS_TRUNCATED: () =>
    `No measurement points could be extracted: the page carrying the measurement table is not part of the document.`,
  SUGGEST_RESCAN: () => `Re-scan the certificate including every page, then upload it again.`,
  NO_POINTS: (p) =>
    `No measurement points could be extracted from the certificate${p.reason ? ` (${p.reason})` : ''}.`,
  SUGGEST_ENABLE_VISION: () =>
    `Enable the vision layer (OPENAI_API_KEY) to read measurement tables from scanned certificates, or capture the points manually.`,
  TABLE_PARTIAL: (p) => `Measurement table only partly read — ${p.reason}`,
  COLUMNS_INFERRED: (p) =>
    `${p.count} point(s) reconstructed from raw OCR without column headers: the reference/uncertainty/EMT mapping is inferred and conformity was not decided.`,
  READING_DISAGREEMENT: (p) => `Reading disagreement — ${p.detail}`,
  VISION_UNAVAILABLE: (p) => `Vision layer unavailable: ${p.detail}`,
  LOCAL_OCR_DEGRADED: (p) => `Local OCR degraded: ${p.detail}`,
  FIELD_UNREADABLE: (p) => `Field reported unreadable by the vision layer: ${p.field}`,
};

const AR: Record<string, Template> = {
  POINT_NO_EMT: (p) =>
    `النقطة ${p.point}: لا يوجد حد خطأ أقصى (EMT) مطبوع على الشهادة، لذا تعذّر البتّ في المطابقة.`,
  POINT_EXCEEDS_EMT: (p) =>
    `النقطة ${p.point} (${p.nominal} ${p.unit}): |التصحيح| + U = ${p.guard_band} يتجاوز حد الخطأ الأقصى ${p.emt}.`,
  POINT_MATH_MISMATCH: (p) =>
    `النقطة ${p.point}: الشهادة تذكر خطأً قدره ${p.stated}، وإعادة الحساب تعطي ${p.recomputed}.`,
  POINT_HYSTERESIS: (p) => `النقطة ${p.point}: تخلّف مقداره ${p.delta}، أي فوق العتبة ${p.threshold}.`,
  NO_EMT_ANYWHERE: (p) =>
    `لا يوجد حد خطأ أقصى مطبوع لأيٍّ من نقاط القياس البالغة ${p.total}، لذا لا يمكن إصدار حكم بالمطابقة.`,
  PARTIAL_VERDICT: (p) =>
    `تم البتّ في المطابقة على ${p.decided} من أصل ${p.total} نقطة؛ الباقي بلا حد خطأ أقصى.`,
  CHRONOLOGY: (p) => `خطأ في التسلسل الزمني: ${p.detail}`,
  PAST_NEXT_CALIBRATION: (p) => `تجاوزت الشهادة تاريخ المعايرة التالية (${p.date}).`,
  NO_TRACEABILITY: () => `لم يُعثر على أي إسناد لمرجع المعايرة في الشهادة.`,
  STANDARD_UNVERIFIABLE: () =>
    `تعذّر التحقق من صلاحية مرجع المعايرة (تاريخ المعايرة أو تاريخ انتهاء المرجع مفقود).`,
  STANDARD_EXPIRED: (p) =>
    `انتهت صلاحية مرجع المعايرة ${p.standard ?? ''} بتاريخ ${p.expiry} لكنه استُخدم للمعايرة بتاريخ ${p.calibration}.`.replace(
      /\s+/g,
      ' ',
    ),
  TEMPERATURE_OUT_OF_RANGE: (p) =>
    `درجة الحرارة المحيطة ${p.value} °م خارج المجال ${p.nominal} ± ${p.tolerance} °م.`,
  TEMPERATURE_MISSING: () => `لم يتم العثور على درجة الحرارة المحيطة — راجع كتلة ظروف المعايرة.`,
  HUMIDITY_OUT_OF_RANGE: (p) =>
    `الرطوبة النسبية ${p.value}% تتجاوز الحد الأقصى ${p.maximum}%.`,
  HUMIDITY_MISSING: () => `لم يتم العثور على الرطوبة المحيطة — راجع كتلة ظروف المعايرة.`,
  PAGE_COUNT_MISSING: () => `عدد الصفحات المعلن غير موجود في ترويسة الشهادة.`,
  PAGE_COUNT_MISMATCH: (p) =>
    `عدد الصفحات غير متطابق: الشهادة تعلن ${p.announced}، وتم استخراج ${p.extracted}.`,
  PAGE_COUNT_MISMATCH_OCR: (p) =>
    `عدد الصفحات غير متطابق: ${p.announced} معلنة، ${p.extracted} مستخرجة. قُرئ مؤشر الصفحة بالتعرف الضوئي — يُرجى التحقق يدويًا.`,
  CACHET_ABSENT: () => `خاتم اعتماد المختبر غير موجود على الوثيقة.`,
  CACHET_UNVERIFIABLE: () => `تعذّر التحقق آليًا من خاتم الاعتماد — تأكّد منه بصريًا قبل الاعتماد.`,
  SIGNATURE_ABSENT: () => `توقيع الاعتماد غير موجود على الوثيقة.`,
  SIGNATURE_UNVERIFIABLE: () => `تعذّر التحقق آليًا من التوقيع — تأكّد منه بصريًا قبل الاعتماد.`,
  MISSING_CRITICAL_FIELD: (p) => `حقل أساسي مفقود أو غير مقروء: ${p.field}`,
  DOCUMENT_TRUNCATED: (p) =>
    `الوثيقة غير مكتملة: الصفحة الأخيرة (${p.last_page}) تشير إلى تتمة («${p.marker}»)، أي أن الشهادة تمتد إلى ورقة غير موجودة في هذا الملف.`,
  NO_POINTS_TRUNCATED: () =>
    `تعذّر استخراج أي نقطة قياس: الصفحة التي تحمل جدول القياسات ليست ضمن الوثيقة.`,
  SUGGEST_RESCAN: () => `أعد مسح الشهادة بكل صفحاتها ثم ارفعها من جديد.`,
  NO_POINTS: (p) =>
    `تعذّر استخراج أي نقطة قياس من الشهادة${p.reason ? ` (${p.reason})` : ''}.`,
  SUGGEST_ENABLE_VISION: () =>
    `فعّل طبقة الرؤية (OPENAI_API_KEY) لقراءة جداول القياس من الشهادات الممسوحة، أو أدخل النقاط يدويًا.`,
  TABLE_PARTIAL: (p) => `تمت قراءة جدول القياسات جزئيًا — ${p.reason}`,
  COLUMNS_INFERRED: (p) =>
    `تمت إعادة بناء ${p.count} نقطة من التعرف الضوئي الخام بدون عناوين أعمدة: ربط المرجع/عدم اليقين/حد الخطأ الأقصى استنتاجي ولم يتم البتّ في المطابقة.`,
  READING_DISAGREEMENT: (p) => `اختلاف بين القراءات — ${p.detail}`,
  VISION_UNAVAILABLE: (p) => `طبقة الرؤية غير متاحة: ${p.detail}`,
  LOCAL_OCR_DEGRADED: (p) => `تدهور في التعرف الضوئي المحلي: ${p.detail}`,
  FIELD_UNREADABLE: (p) => `حقل أبلغت طبقة الرؤية بأنه غير مقروء: ${p.field}`,
};

const CATALOGUES: Record<Language, Record<string, Template>> = { fr: FR, en: EN, ar: AR };

/** Render one finding, falling back to the backend's English message. */
export function translateFinding(finding: Finding, lang: Language): string {
  const template = CATALOGUES[lang]?.[finding.code] ?? CATALOGUES.fr[finding.code];
  if (!template) return finding.message;
  try {
    return template(finding.params || {});
  } catch {
    // A malformed param must not blank the finding out.
    return finding.message;
  }
}

export function findingsBySeverity(findings: Finding[] | undefined, severity: Severity): Finding[] {
  return (findings || []).filter((f) => f.severity === severity);
}
