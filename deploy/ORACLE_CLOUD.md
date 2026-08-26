# Hosting on Oracle Cloud

Deployed to an Ampere A1 instance in `af-casablanca-1`.

| | |
|---|---|
| Host | `84.8.218.237` (user `ubuntu`) |
| Shape | 2 vCPU · 11 GB RAM · 45 GB disk · **aarch64** |
| OS | Ubuntu 22.04.5 LTS |
| App root | `~/metrology` |
| Public URL | `http://84.8.218.237` |

---

## 1. The network boundary

The development `docker-compose.yml` publishes Postgres, Redis and MinIO on
`0.0.0.0`, with credentials committed to this repository. That is harmless on a
laptop and directly exploitable on a public IP, so production uses a separate,
complete compose file rather than an override — Compose *concatenates* `ports`
when layering files with `-f`, which would have kept the insecure bindings
alongside the new ones.

```
                      internet
                          │
                    :80   │            <- the only published port
                          ▼
                    ┌──────────┐
                    │  nginx   │
                    └────┬─────┘
              /          │        /api/
              ▼          │          ▼
      ┌──────────────┐   │   ┌──────────────┐
      │ web-frontend │   │   │ auth-gateway │
      └──────────────┘   │   └──────┬───────┘
                         │          │
    ┌────────────────────┴──────────┴──────────────────┐
    │  compose bridge — no published ports              │
    │  postgres · redis · minio · ocr-parsing ·         │
    │  document-ingestion · metrology-engine ·          │
    │  ai-anomaly · reporting-notification              │
    └───────────────────────────────────────────────────┘
```

Serving the API from the same origin as the page means the browser needs one
port and there is no CORS configuration to get wrong.

---

## 2. Credentials

`~/metrology/.env` was generated **on the server** with `openssl rand` and is
not in git. The repository's values are public by definition and must never
protect an internet-facing datastore.

Rotated: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_SECRET_KEY`, `JWT_SECRET`.

Still the documented demo value: `DEFAULT_ADMIN_PASSWORD=fati2004@`. It is
published in this repo and now guards a login on the public internet — change
it from the UI, or in `.env` followed by a restart.

---

## 3. First-time setup (already done)

```bash
# Docker engine + compose, arm64 repository
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu jammy stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu

# 2 GB swap — 11 GB is ample at runtime, but the Next.js build peaks hard and
# an OOM kill mid-build is a confusing failure to diagnose.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab

# Instance firewall. Insert BEFORE the catch-all REJECT, or the rule is never
# reached. Oracle's Ubuntu image ships that REJECT at the end of INPUT.
sudo iptables -I INPUT 5 -p tcp --dport 80 -m state --state NEW -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

### The second firewall

Oracle has **two** layers. The instance `iptables` above is only the first; the
VCN **Security List** is enforced in the cloud fabric and cannot be changed over
SSH. Port 80 stays unreachable until an ingress rule is added in the console:

> Networking → Virtual Cloud Networks → *your VCN* → Subnets → *the subnet
> carrying `10.0.0.0/24`* → Security Lists → *Default Security List* →
> **Add Ingress Rules**
>
> | Field | Value |
> |---|---|
> | Stateless | No |
> | Source Type | CIDR |
> | Source CIDR | `0.0.0.0/0` |
> | IP Protocol | TCP |
> | Source Port Range | *(leave blank)* |
> | Destination Port Range | `80` |

If the instance uses a Network Security Group instead, add the same rule there.

---

## 4. Deploy and update

```bash
cd ~/metrology
git pull
sudo docker compose -f docker-compose.prod.yml up -d --build
```

`NEXT_PUBLIC_API_BASE_URL` is inlined by Next.js at **build** time, so changing
`PUBLIC_BASE_URL` (a new IP, or a domain) requires a rebuild of `web-frontend`,
not just a restart.

```bash
# status / logs
sudo docker compose -f docker-compose.prod.yml ps
sudo docker compose -f docker-compose.prod.yml logs -f ocr-parsing

# full reset — drops the database, required if the user_role enum changes
sudo docker compose -f docker-compose.prod.yml down -v
```

---

## 5. Verify

```bash
curl -o /dev/null -w "%{http_code}\n" http://localhost/            # 200
curl http://localhost/healthz                                      # ok

TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"fati_sadiki","password":"fati2004@"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/v1/certificates/stats
```

---

## 6. Notes for this host

- **aarch64.** Every dependency resolves to a prebuilt `manylinux_*_aarch64`
  wheel — `onnxruntime`, `rapidocr-onnxruntime`, `opencv-python`, `numpy`,
  `pyclipper`, `shapely`, `pillow` — so nothing compiles from source.
- **`OCR_PAGE_WORKERS=2`**, matching the 2 vCPUs. More workers than cores adds
  memory pressure and can surface as `ONNXRuntime inference failed` on a page;
  the run continues and records the reason in `diagnostics.local_ocr_error`.
  Expect roughly 60–150 s per certificate here.
- **No HTTPS.** Let's Encrypt needs a domain name; there is only an IP. Logins
  and JWTs therefore cross the network in clear text. Point a domain at this
  host and add certbot before treating it as more than a demo.
