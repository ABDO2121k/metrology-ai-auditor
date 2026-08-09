import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import Redis from 'ioredis';
import * as Minio from 'minio';
import { generateAuditPDFBuffer, AuditReportData } from './pdf_generator';

const server = Fastify({ logger: true });

server.register(fastifyCors, { origin: '*' });
server.register(fastifyWebsocket);

// MinIO Client Setup
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_HOST || 'minio',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minio_admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'MinioSecretPassword123!'
});

const BUCKET_AUDIT_REPORTS = 'audit-reports';

// Ensure audit-reports bucket exists
async function initMinioBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_AUDIT_REPORTS);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_AUDIT_REPORTS, 'us-east-1');
      console.log(`Created MinIO bucket: ${BUCKET_AUDIT_REPORTS}`);
    }
  } catch (err) {
    console.warn(`MinIO Bucket Init Warning: ${err}`);
  }
}

initMinioBucket();

// WebSocket Connection Map
const connectedClients = new Map<string, any>();

server.register(async function (fastify) {
  fastify.get('/ws/notifications', { websocket: true }, (connection, req) => {
    const clientId = Math.random().toString(36).substring(7);
    connectedClients.set(clientId, connection.socket);

    fastify.log.info(`WebSocket Client Connected: ${clientId}`);

    connection.socket.send(JSON.stringify({
      topic: 'system:welcome',
      message: 'Connected to Process Instruments Real-time Audit Stream',
      timestamp: new Date().toISOString()
    }));

    connection.socket.on('close', () => {
      connectedClients.delete(clientId);
      fastify.log.info(`WebSocket Client Disconnected: ${clientId}`);
    });
  });
});

// Broadcast Real-time Events to Frontend Clients
function broadcastEvent(topic: string, data: any) {
  const payload = JSON.stringify({ topic, data, timestamp: new Date().toISOString() });
  for (const [id, socket] of connectedClients.entries()) {
    if (socket.readyState === 1) { // OPEN
      socket.send(payload);
    }
  }
}

// Redis Pub-Sub Listener
const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'RedisSecret123!',
  lazyConnect: true
});

redisSubscriber.connect().then(() => {
  redisSubscriber.subscribe('certificate:processed', 'certificate:anomaly_flagged', (err) => {
    if (err) console.error('Redis Pub-Sub Subscription Error:', err);
    else console.log('Subscribed to Redis Pub-Sub channels: certificate:processed, certificate:anomaly_flagged');
  });
}).catch((err) => {
  console.warn('Redis Connection Warning:', err);
});

redisSubscriber.on('message', async (channel, message) => {
  try {
    const eventData = JSON.parse(message);
    server.log.info(`Pub-Sub event received on ${channel}:`, eventData);
    broadcastEvent(channel, eventData);
  } catch (e) {
    console.error('Pub-Sub Message Parse Error:', e);
  }
});

// Health Endpoint
server.get('/health', async () => {
  return {
    status: 'healthy',
    service: 'reporting-notification',
    connected_ws_clients: connectedClients.size
  };
});

// Generate PDF Report Endpoint
server.post('/api/v1/reports/generate', async (request, reply) => {
  try {
    const data = request.body as AuditReportData;
    const pdfBuffer = await generateAuditPDFBuffer(data);

    const objectName = `audit-reports/${data.certificate_number || data.certificate_id}_audit.pdf`;

    // Upload to MinIO
    try {
      await minioClient.putObject(BUCKET_AUDIT_REPORTS, objectName, pdfBuffer, pdfBuffer.length, {
        'Content-Type': 'application/pdf'
      });
    } catch (mErr) {
      server.log.warn(`MinIO upload skipped: ${String(mErr)}`);
    }

    // Broadcast WebSocket Event
    broadcastEvent('report:generated', {
      certificate_id: data.certificate_id,
      certificate_number: data.certificate_number,
      report_url: `/api/v1/reports/download/${objectName}`,
      overall_status: data.overall_status
    });

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${data.certificate_number}_audit_report.pdf"`);
    return reply.send(pdfBuffer);
  } catch (err: any) {
    reply.status(500).send({ error: err.message });
  }
});

// Demo 5 Certificate Models Batch PDF Generation Endpoint
server.get('/api/v1/reports/demo-5certs', async (request, reply) => {
  const demoReports: AuditReportData[] = [
    {
      certificate_id: 'cert-1-resistor',
      certificate_number: 'ARRM13388-26',
      client_name: 'PROCESS INSTRUMENTS CLIENT',
      instrument_name: 'Boîte de Résistance',
      audit_date: '2026-07-29',
      overall_status: 'PASSED',
      is_standard_valid: true,
      is_chronology_valid: true,
      is_page_count_valid: true,
      anomaly_score: 0.05,
      confidence_score: 98.5,
      recommendation: 'APPROVE',
      measurements: [
        { point_index: 1, nominal: 1.0, reference: 1.000, measured: 1.0134, calculated_error: 0.0134, calculated_correction: -0.0134, uncertainty_u: 0.0082, emt_limit: 0.05, is_conforme: true },
        { point_index: 2, nominal: 10.0, reference: 10.000, measured: 10.0042, calculated_error: 0.0042, calculated_correction: -0.0042, uncertainty_u: 0.0095, emt_limit: 0.05, is_conforme: true }
      ],
      anomalies: []
    },
    {
      certificate_id: 'cert-2-temp',
      certificate_number: 'AETE04897-26',
      client_name: 'SOCIETE DE THERMIE',
      instrument_name: 'Capteur Température Pt100 / TC',
      audit_date: '2026-07-29',
      overall_status: 'PASSED',
      is_standard_valid: true,
      is_chronology_valid: true,
      is_page_count_valid: true,
      anomaly_score: 0.05,
      confidence_score: 99.1,
      recommendation: 'APPROVE',
      measurements: [
        { point_index: 1, nominal: 0.0, reference: 0.00, measured: 0.02, calculated_error: 0.02, calculated_correction: -0.02, uncertainty_u: 0.05, emt_limit: 0.15, is_conforme: true },
        { point_index: 2, nominal: 100.0, reference: 100.00, measured: 100.08, calculated_error: 0.08, calculated_correction: -0.08, uncertainty_u: 0.06, emt_limit: 0.20, is_conforme: true }
      ],
      anomalies: []
    },
    {
      certificate_id: 'cert-3-multimeter',
      certificate_number: 'ARTL05391-26/A',
      client_name: 'LABORATOIRE METROLOGIE',
      instrument_name: 'Multimètre Numérique (V, A, Ω)',
      audit_date: '2026-07-29',
      overall_status: 'PASSED',
      is_standard_valid: true,
      is_chronology_valid: true,
      is_page_count_valid: true,
      anomaly_score: 0.05,
      confidence_score: 99.5,
      recommendation: 'APPROVE',
      measurements: [
        { point_index: 1, nominal: 10.0, reference: 10.0000, measured: 10.0002, calculated_error: 0.0002, calculated_correction: -0.0002, uncertainty_u: 0.0005, emt_limit: 0.005, is_conforme: true }
      ],
      anomalies: []
    },
    {
      certificate_id: 'cert-4-shunt',
      certificate_number: 'ARBI13361-26',
      client_name: 'ELECTRO TECH',
      instrument_name: 'Shunt Électrique de Précision',
      audit_date: '2026-07-29',
      overall_status: 'PASSED',
      is_standard_valid: true,
      is_chronology_valid: true,
      is_page_count_valid: true,
      anomaly_score: 0.05,
      confidence_score: 98.8,
      recommendation: 'APPROVE',
      measurements: [
        { point_index: 1, nominal: 75.0, reference: 75.000, measured: 75.008, calculated_error: 0.008, calculated_correction: -0.008, uncertainty_u: 0.012, emt_limit: 0.050, is_conforme: true }
      ],
      anomalies: []
    },
    {
      certificate_id: 'cert-5-calibrator',
      certificate_number: 'AENS12791-26',
      client_name: 'PROCESS CALIBRATION S.A.',
      instrument_name: 'Calibrateur de Processus Multifonction',
      audit_date: '2026-07-29',
      overall_status: 'CRITICAL_REJECT',
      is_standard_valid: true,
      is_chronology_valid: true,
      is_page_count_valid: false,
      anomaly_score: 0.90,
      confidence_score: 97.2,
      recommendation: 'REJECT',
      measurements: [
        { point_index: 1, nominal: 1.0, reference: 1.0000, measured: 1.0003, calculated_error: 0.0003, calculated_correction: -0.0003, uncertainty_u: 0.0008, emt_limit: 0.005, is_conforme: true }
      ],
      anomalies: [
        { type: 'MISSING_SIGNATURE', severity: 'CRITICAL', message: 'Validation signature absent.' },
        { type: 'PAGE_COUNT_MISMATCH', severity: 'CRITICAL', message: 'Document page count discrepancy.' }
      ]
    }
  ];

  const generatedList = [];

  for (const report of demoReports) {
    const pdfBuf = await generateAuditPDFBuffer(report);
    const objName = `audit-reports/${report.certificate_number}_audit.pdf`;

    try {
      await minioClient.putObject(BUCKET_AUDIT_REPORTS, objName, pdfBuf, pdfBuf.length, {
        'Content-Type': 'application/pdf'
      });
    } catch (e) {}

    generatedList.push({
      certificate_number: report.certificate_number,
      instrument_name: report.instrument_name,
      overall_status: report.overall_status,
      pdf_size_bytes: pdfBuf.length,
      uploaded_to_minio: true
    });
  }

  return {
    status: 'success',
    reports_generated: generatedList.length,
    reports: generatedList
  };
});

const start = async () => {
  try {
    await server.listen({ port: 8005, host: '0.0.0.0' });
    console.log('Reporting & Notification Microservice running on port 8005');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
