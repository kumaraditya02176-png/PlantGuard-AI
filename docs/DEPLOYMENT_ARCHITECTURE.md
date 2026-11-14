# DEPLOYMENT_ARCHITECTURE

## Local proof-of-concept topology

```text
Browser
  -> Next.js frontend (localhost:3000)
  -> FastAPI backend (localhost:8001)
      -> in-memory extrusion simulator
      -> process-local synthetic training/evaluation dataset
      -> PyTorch PINN and LSTM model cache
```

The frontend requests dashboard, sensor-history, risk, advisory, and metrics data from the API. The interactive ROI form calculates locally from user assumptions. Simulation commands update in-memory state under a lock. The model cache is initialized once per backend process on first use; a restart resets both cache and simulator state.

## Container demo

`docker-compose.yml` defines a Python backend container on host port 8000 and a Next.js development server on host port 3000. It is a convenience for local demonstrations, not a production topology. Confirm the frontend's API URL is configured for the container network before relying on a container-to-container run.

## Production gaps

No production-grade identity, authorization, tenant separation, durable database, message broker, secret management, TLS termination, observability stack, backup/restore, deployment automation, high availability, or validated edge runtime is implemented. A future deployment design must be threat-modeled and approved for the target plant before connection to operational networks.
