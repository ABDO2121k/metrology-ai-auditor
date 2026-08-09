# EPIC 6: Director & Executive Analytics Dashboard (Data Visualizations & Charts)

## 1. Executive Summary & Vision

This Epic specifies the **Director & Executive Analytics Dashboard** (`/director-dashboard`), tailored for **Laboratory Management / Directors** per ISO/IEC 17025 Article 8 and **PR.ECE V9**.

It provides high-level business intelligence, quality compliance audit metrics, anomaly trend analysis, and team throughput statistics powered by interactive data visualization charts (`Recharts` / `Chart.js`).

---

## 2. Backend Support & API Endpoints Verification

> [!NOTE]
> **Backend Implementation Status**:
> - **`auth-gateway`** (Port 8000) exposes `GET /api/v1/analytics/dashboard` (restricted to `DIRECTOR`, `ADMINISTRATOR`, `VALIDATOR`), returning JSON datasets for calibration throughput, compliance percentages, and anomaly breakdown counts.

```
[Director Dashboard UI (`/director-dashboard`)]
       │
       │ GET /api/v1/analytics/dashboard
       ▼
┌────────────────────────────────────────────────────────┐
│             auth-gateway Service (Port 8000)           │
│  Returns:                                              │
│  • throughput_line_chart: [{month, certificates}]      │
│  • compliance_pie_chart: {conforme_%, non_conforme_%} │
│  • anomaly_types_bar_chart: [{type, count}]            │
└────────────────────────────────────────────────────────┘
```

---

## 3. Data Visualization Charts & Visual Widgets

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIRECTOR EXECUTIVE ANALYTICS VIEW                    │
│                                                                        │
│  [Total Audited Certs: 1,248]        [ISO 17025 Pass Rate: 98.4%]      │
│  [AI Anomalies Blocked: 18]          [Avg Ingestion Latency: <12ms]    │
│                                                                        │
│  ┌─────────────────────────────────┐   ┌────────────────────────────┐  │
│  │ Calibration Throughput Trend    │   │ Compliance Rate (ISO 17025)│  │
│  │ (Line Chart: Monthly Volume)    │   │ (Pie Chart: 98.4% vs 1.6%) │  │
│  └─────────────────────────────────┘   └────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────┐   ┌────────────────────────────┐  │
│  │ Anomaly Flag Types Breakdown    │   │ Validator Audit Logs       │  │
│  │ (Bar Chart: Seals vs Math Exceed)│   │ (Recent Electronic Sign)   │  │
│  └─────────────────────────────────┘   └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. UI Components List (`/director-dashboard`)

1. **`ExecutiveKpiGridComponent`**: Total Audited Certificates, Pass Rate %, Fraud Detection Count, Average Ingestion Time.
2. **`CalibrationThroughputLineChartComponent`**: Interactive Line Chart rendering monthly calibration volume for Electrical Department (`Recharts`).
3. **`CompliancePieChartComponent`**: Donut / Pie Chart rendering ISO 17025 compliance vs non-conformity rates (`98.4%` vs `1.6%`).
4. **`AnomalyTypesBarChartComponent`**: Bar Chart breaking down anomaly types (`MISSING_SIGNATURE`, `MISSING_STAMP`, `PAGE_COUNT_MISMATCH`, `EXPIRED_STANDARD`, `EMT_LIMIT_EXCEEDED`).
5. **`UserActivityAuditTrailComponent`**: Table listing technician uploads, validator approvals, and electronic signatures with timestamps.
