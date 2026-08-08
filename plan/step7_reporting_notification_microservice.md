# Step 7: Audit Report Generation & Notification Microservice (`reporting-notification`)

## 1. Objective & Scope

Design and build the **Audit Report Generation & Notification Microservice** (`reporting-notification`) using **Node.js (Fastify)**, **BullMQ**, and **WebSockets**.

This microservice handles:
- Asynchronous generation of formal PDF audit reports for validated or rejected certificates.
- Real-time event notifications delivered directly to the Next.js frontend via WebSockets / Server-Sent Events (SSE).
- Email notifications and webhook alerts for critical blocking anomalies (e.g. expired reference standard or falsified values).

---

## 2. Recommended Technology Choice

- **Framework**: Fastify v4+ (Sub-millisecond HTTP & WebSocket handler).
- **Job Queue**: `bullmq` + `ioredis` (Resilient Redis-backed worker queue).
- **PDF Generation Engine**: Puppeteer Headless Stream / Chromium (Generates crisp, print-ready PDF reports from HTML templates).
- **WebSockets**: `@fastify/websocket` for real-time frontend notifications.

---

## 3. Microservice Project Layout (`app/services/reporting-notification/`)

```
reporting-notification/
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── queues/
│   │   ├── pdf_queue.ts
│   │   └── notification_queue.ts
│   ├── templates/
│   │   └── audit_report_template.html
│   ├── websocket/
│   │   └── ws_handler.ts
│   └── services/
│       ├── pdf_generator.ts
│       └── mail_service.ts
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## 4. Implementation Details

### 4.1 Real-Time WebSocket & Event Listener (`src/server.ts`)

```typescript
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import Redis from 'ioredis';
import { generateAuditPDF } from './services/pdf_generator';

const fastify = Fastify({ logger: true });
fastify.register(fastifyWebsocket);

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'RedisSecret123!'
});

// Active WebSocket client connections map
const connectedClients = new Map<string, any>();

fastify.register(async function (fastify) {
  fastify.get('/ws/notifications', { websocket: true }, (connection, req) => {
    const clientId = Math.random().toString(36).substring(7);
    connectedClients.set(clientId, connection.socket);

    fastify.log.info(`WebSocket Client Connected: ${clientId}`);

    connection.socket.on('close', () => {
      connectedClients.delete(clientId);
      fastify.log.info(`WebSocket Client Disconnected: ${clientId}`);
    });
  });
});

// Broadcast Real-time Events to All Connected Frontend Clients
function broadcastEvent(topic: string, data: any) {
  const payload = JSON.stringify({ topic, data, timestamp: new Date().toISOString() });
  for (const [id, socket] of connectedClients.entries()) {
    if (socket.readyState === 1) { // OPEN
      socket.send(payload);
    }
  }
}

// Subscribe to Redis Pub-Sub Channel
redisSubscriber.subscribe('certificate:processed', 'certificate:anomaly_flagged', (err, count) => {
  if (err) console.error('Failed to subscribe to Redis channels:', err);
});

redisSubscriber.on('message', async (channel, message) => {
  const eventData = JSON.parse(message);
  fastify.log.info(`Received event on channel ${channel}:`, eventData);

  // Broadcast to frontend dashboard
  broadcastEvent(channel, eventData);

  // Trigger PDF Audit Report Generation if Processed
  if (channel === 'certificate:processed') {
    await generateAuditPDF(eventData.certificate_id, eventData);
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 8005, host: '0.0.0.0' });
    console.log('Reporting & Notification Microservice running on port 8005');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

---

### 4.2 PDF Audit Report Template (`src/templates/audit_report_template.html`)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport d'Audit Métrologique IA</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color: #1e293b; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 20px; font-weight: bold; color: #0f172a; }
    .badge-conforme { background: #dcfce7; color: #15803d; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .badge-nonconforme { background: #fee2e2; color: #b91c1c; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">PROCESS INSTRUMENTS — RAPPORT D'AUDIT IA (ISO 17025)</div>
    <div>Numéro Certificat: <strong>{{certificate_number}}</strong> | Date: {{audit_date}}</div>
  </div>

  <h3>Résumé de la Validation Métrologique</h3>
  <p>Statut Global: <span class="{{status_class}}">{{status_text}}</span></p>
  <p>Score de Confiance IA: <strong>{{confidence_score}}%</strong></p>

  <h3>Tableau des Relevés & Calculs Métrologiques</h3>
  <table>
    <thead>
      <tr>
        <th>N°</th>
        <th>Valeur Consigne</th>
        <th>Valeur Référence</th>
        <th>Valeur Mesurée</th>
        <th>Erreur Calculée</th>
        <th>Correction</th>
        <th>Incertitude U</th>
        <th>EMT</th>
        <th>Conformité (|Corr|+U ≤ EMT)</th>
      </tr>
    </thead>
    <tbody>
      {{#measurements}}
      <tr>
        <td>{{point_index}}</td>
        <td>{{nominal}}</td>
        <td>{{reference}}</td>
        <td>{{measured}}</td>
        <td>{{calculated_error}}</td>
        <td>{{calculated_correction}}</td>
        <td>{{uncertainty_u}}</td>
        <td>{{emt_limit}}</td>
        <td>{{conforme_badge}}</td>
      </tr>
      {{/measurements}}
    </tbody>
  </table>

  <h3>Anomalies & Alertes Détectées</h3>
  <ul>
    {{#anomalies}}
    <li style="color: #b91c1c;"><strong>[{{severity}}]</strong> {{description}}</li>
    {{/anomalies}}
  </ul>
</body>
</html>
```

---

## 5. Verification Checklist

- [ ] Connect WebSocket client at `ws://localhost:8005/ws/notifications`.
- [ ] Publish test message to Redis `certificate:processed`. Verify WebSocket payload arrives in **<10ms**.
- [ ] Verify generated PDF audit report appears in MinIO bucket `audit-reports` formatted per ISO 17025 rules.
