# Step 8: Next.js 14 Modern Glassmorphism Web Application (`web-frontend`)

## 1. Objective & Scope

Design and build the **Next.js 14 Web Application** (`web-frontend`).

The user interface delivers a modern glassmorphism experience with dark mode aesthetics, dynamic micro-animations, real-time WebSocket updates, and structured workflows tailored for **Technicians**, **Quality Managers**, and **Validation Experts** at Process Instruments.

---

## 2. Recommended Frontend Tech Stack

- **Framework**: Next.js 14 (App Router + React Server Components).
- **Styling**: Tailwind CSS v3 + CSS Glassmorphism Utility Classes.
- **State & Data Fetching**: TanStack Query v5 (React Query) + Zustand (Global UI state).
- **Icons & Visuals**: `lucide-react`, `framer-motion` (smooth micro-animations), `recharts` (metrological charts).
- **Real-Time Updates**: Native WebSocket Hook connected to `reporting-notification` service.

---

## 3. Frontend Project Layout (`app/frontend/`)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing / Auth Redirect
│   │   ├── login/
│   │   │   └── page.tsx                # Glassmorphism Login
│   │   ├── dashboard/
│   │   │   └── page.tsx                # Overview KPI Metrics & Charts
│   │   ├── upload/
│   │   │   └── page.tsx                # PDF Upload Studio
│   │   └── certificates/
│   │       ├── page.tsx                # Certificates Data Grid
│   │       └── [id]/
│   │           └── page.tsx            # Split-View Validation Studio
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── badge.tsx
│   │   ├── navbar.tsx
│   │   ├── sidebar.tsx
│   │   ├── pdf_viewer.tsx
│   │   └── metrology_table.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useWebSocket.ts
│   └── lib/
│       └── api_client.ts
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## 4. Key UI Screens & Components

### 4.1 Split-View Certificate Validation Studio (`app/certificates/[id]/page.tsx`)

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function CertificateValidationStudio({ params }: { params: { id: string } }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch certificate details via Gateway API
  const { data: cert, isLoading } = useQuery({
    queryKey: ["certificate", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/certificates/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwt_token")}` }
      });
      return res.json();
    }
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading Certificate Audit Studio...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Glassmorphism Header */}
      <header className="flex justify-between items-center bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 mb-6 shadow-2xl">
        <div className="flex items-center space-x-3">
          <FileText className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">Certificat N° {cert.certificate_number}</h1>
            <p className="text-xs text-slate-400">Client: {cert.client_name} | Instrument: {cert.instrument_name}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {cert.status === "VALIDATED_CONFORME" && (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-sm font-semibold flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Conforme
            </span>
          )}
          {cert.status === "FLAGGED_ANOMALY" && (
            <span className="px-3 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-lg text-sm font-semibold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Anomalie Détectée
            </span>
          )}
        </div>
      </header>

      {/* Split-View Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Original PDF Viewer (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-4 h-[750px] flex flex-col">
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Aperçu du Certificat Original</h2>
          <iframe 
            src={`/api/v1/certificates/${cert.id}/file`} 
            className="w-full flex-1 rounded-xl border border-slate-800"
          />
        </div>

        {/* Right Panel: AI Metrological Audit & Decision Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* AI Anomaly Alert Card */}
          {cert.anomalies && cert.anomalies.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-950/40 border border-rose-800/60 backdrop-blur-xl rounded-2xl p-4"
            >
              <h3 className="text-rose-400 font-bold flex items-center gap-2 mb-2 text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> Critical Anomalies Detected by AI Model
              </h3>
              <ul className="space-y-1 text-xs text-rose-200">
                {cert.anomalies.map((anom: any, idx: number) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    <strong>[{anom.severity}]</strong> {anom.description}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Metrological Table Check */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-md font-bold mb-4 flex items-center gap-2 text-cyan-400">
              <ShieldCheck className="w-5 h-5" /> Vérification des Points de Mesure (ISO 17025)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase">
                    <th className="p-2">Point</th>
                    <th className="p-2">Consigne</th>
                    <th className="p-2">Référence</th>
                    <th className="p-2">Mesuré</th>
                    <th className="p-2">Correction</th>
                    <th className="p-2">U (Incertitude)</th>
                    <th className="p-2">EMT</th>
                    <th className="p-2">Règle (|Corr|+U ≤ EMT)</th>
                  </tr>
                </thead>
                <tbody>
                  {cert.measurements.map((pt: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="p-2 font-mono text-slate-300">#{pt.point_index}</td>
                      <td className="p-2 font-mono">{pt.nominal_value}</td>
                      <td className="p-2 font-mono">{pt.reference_value}</td>
                      <td className="p-2 font-mono">{pt.measured_value}</td>
                      <td className="p-2 font-mono">{pt.calculated_correction}</td>
                      <td className="p-2 font-mono">±{pt.uncertainty_u}</td>
                      <td className="p-2 font-mono">{pt.emt}</td>
                      <td className="p-2">
                        {pt.is_conforme ? (
                          <span className="text-emerald-400 font-bold">✓ Conforme</span>
                        ) : (
                          <span className="text-rose-400 font-bold">✗ Dépassé</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Validation Action Footer */}
          <div className="flex justify-end space-x-4 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <button 
              className="px-5 py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl font-semibold text-sm transition flex items-center gap-2"
              onClick={() => setIsSubmitting(true)}
            >
              <XCircle className="w-4 h-4" /> Rejeter le Certificat
            </button>
            <button 
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-900/30 transition flex items-center gap-2"
              onClick={() => setIsSubmitting(true)}
            >
              <CheckCircle className="w-4 h-4" /> Valider & Signer
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
```

---

## 5. Verification Checklist

- [ ] Run `npm run dev` inside `app/frontend/`. Verify dashboard renders with zero console errors.
- [ ] Test glassmorphism layout responsiveness across desktop (1920x1080) and tablet screens.
- [ ] Confirm split-view certificate studio renders PDF iframe and metrological table simultaneously.
