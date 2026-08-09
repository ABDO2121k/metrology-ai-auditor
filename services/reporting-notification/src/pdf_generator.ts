import PDFDocument from 'pdfkit';

export interface AuditReportData {
  certificate_id: string;
  certificate_number: string;
  client_name: string;
  instrument_name: string;
  audit_date: string;
  overall_status: string;
  is_standard_valid: boolean;
  is_chronology_valid: boolean;
  is_page_count_valid: boolean;
  anomaly_score: number;
  confidence_score: number;
  recommendation: string;
  measurements: Array<{
    point_index: number;
    nominal: number;
    reference: number;
    measured: number;
    calculated_error: number;
    calculated_correction: number;
    uncertainty_u: number;
    emt_limit: number;
    is_conforme: boolean;
  }>;
  anomalies: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
}

export function generateAuditPDFBuffer(data: AuditReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. Header Banner
      doc.rect(40, 40, 515, 60).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text('PROCESS INSTRUMENTS', 55, 52);
      doc.font('Helvetica').fontSize(11).text('RAPPORT D\'AUDIT MÉTROLOGIQUE AUTOMATISÉ IA (ISO/IEC 17025:2017)', 55, 74);

      doc.fillColor('#1e293b').fontSize(10);
      doc.moveDown(3);

      // 2. Certificate Metadata Summary Table
      doc.fontSize(12).font('Helvetica-Bold').text('1. INFORMATIONS GÉNÉRALES ET TRAÇABILITÉ', { underline: true });
      doc.font('Helvetica').fontSize(10);
      doc.moveDown(0.5);

      doc.text(`N° Certificat Audit : ${data.certificate_number}`);
      doc.text(`ID Unique Système   : ${data.certificate_id}`);
      doc.text(`Client              : ${data.client_name}`);
      doc.text(`Instrument Métro.   : ${data.instrument_name}`);
      doc.text(`Date de l'Audit     : ${data.audit_date}`);
      doc.moveDown(1);

      // 3. Audit Verdict & AI Anomaly Score
      doc.fontSize(12).font('Helvetica-Bold').text('2. SYNTHÈSE DE CONFORMITÉ & ANALYSE D\'ANOMALIE IA', { underline: true });
      doc.moveDown(0.5);

      const statusColor = data.overall_status === 'PASSED' ? '#15803d' : '#b91c1c';
      doc.fontSize(11).fillColor(statusColor).font('Helvetica-Bold').text(`STATUT GLOBAL : ${data.overall_status}`);
      
      doc.fillColor('#1e293b').font('Helvetica').fontSize(10);
      doc.text(`Score d'Anomalie IA  : ${data.anomaly_score.toFixed(4)} / 1.0000`);
      doc.text(`Niveau de Confiance  : ${data.confidence_score.toFixed(1)}%`);
      doc.text(`Recommandation       : ${data.recommendation}`);
      doc.text(`Étalon de Référence : ${data.is_standard_valid ? 'VALIDE' : 'EXPIRÉ (CRITIQUE)'}`);
      doc.text(`Chronologie Dates    : ${data.is_chronology_valid ? 'CONFORME' : 'ANOMALIE'}`);
      doc.moveDown(1);

      // 4. Measurement Point Details
      doc.fontSize(12).font('Helvetica-Bold').text('3. RELEVÉS MÉTROLOGIQUES & DÉCISION ISO 17025 (|Corr| + U <= EMT)', { underline: true });
      doc.moveDown(0.5);

      // Table Headers
      const startY = doc.y;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
      doc.text('Pt', 45, startY);
      doc.text('Nominal', 75, startY);
      doc.text('Référence', 135, startY);
      doc.text('Mesurée', 195, startY);
      doc.text('Erreur', 255, startY);
      doc.text('Correction', 315, startY);
      doc.text('Incertitude U', 375, startY);
      doc.text('EMT', 445, startY);
      doc.text('Décision', 495, startY);

      doc.moveTo(40, startY + 12).lineTo(555, startY + 12).stroke('#cbd5e1');

      let currentY = startY + 18;
      doc.font('Helvetica').fillColor('#1e293b');

      data.measurements.forEach((m) => {
        doc.text(m.point_index.toString(), 45, currentY);
        doc.text(m.nominal.toString(), 75, currentY);
        doc.text(m.reference.toString(), 135, currentY);
        doc.text(m.measured.toString(), 195, currentY);
        doc.text(m.calculated_error.toString(), 255, currentY);
        doc.text(m.calculated_correction.toString(), 315, currentY);
        doc.text(m.uncertainty_u.toString(), 375, currentY);
        doc.text(m.emt_limit.toString(), 445, currentY);

        const decText = m.is_conforme ? 'OK' : 'NON';
        const decColor = m.is_conforme ? '#15803d' : '#b91c1c';
        doc.font('Helvetica-Bold').fillColor(decColor).text(decText, 495, currentY);
        doc.font('Helvetica').fillColor('#1e293b');

        currentY += 16;
      });

      doc.moveDown(2);

      // 5. Detected Anomalies
      doc.fontSize(12).font('Helvetica-Bold').text('4. ALERTES ET ANOMALIES DÉTECTÉES', { underline: true });
      doc.moveDown(0.5);

      if (data.anomalies.length === 0) {
        doc.fontSize(10).font('Helvetica').fillColor('#15803d').text('Aucune anomalie ni falsification détectée.');
      } else {
        doc.fontSize(10).font('Helvetica').fillColor('#b91c1c');
        data.anomalies.forEach((a) => {
          doc.text(`• [${a.severity}] ${a.type} : ${a.message}`);
        });
      }

      // 6. Signatures & Footer
      doc.fillColor('#64748b').fontSize(8).font('Helvetica');
      doc.text('Document généré automatiquement par Process Instruments AI Metrology Engine.', 40, 780, { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
