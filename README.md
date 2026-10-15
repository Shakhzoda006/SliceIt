# SliceIt

SliceIt is a tennis-practice video analysis prototype. It combines a Next.js web app with a FastAPI service that samples video frames, extracts body pose landmarks with MediaPipe, and can ask OpenAI GPT-4o to return one coaching focus. Analysis sessions and sampled-frame data are stored in SQLite.

> **Prototype and security notice:** Do not deploy this version as a public, user-isolated service or use it with a valuable OpenAI API key. The API currently has no authentication, permits requests from any origin, and its in-progress status response includes the submitted API key. See [Security and privacy](#security-and-privacy) and [Known limitations](#known-limitations).

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Using the app](#using-the-app)
- [Analysis pipeline](#analysis-pipeline)
- [HTTP API](#http-api)
- [Data storage and retention](#data-storage-and-retention)
- [Deployment notes](#deployment-notes)
- [Security and privacy](#security-and-privacy)
- [Known limitations](#known-limitations)
- [Project layout](#project-layout)
- [Useful commands](#useful-commands)

## What it does

- Lets a player upload a practice video and choose their dominant hand.
- Uses MediaPipe Pose Landmarker to find one person's body landmarks in sampled frames.
- Applies basic position heuristics to label sampled poses as forehand, backhand, serve, or neutral.
- Uses stroke counts and elbow-angle variation to decide whether there is enough apparent tennis activity to request coaching.
- When the tennis activity gate passes, sends structured pose metrics and prior-session summaries to GPT-4o and displays one coaching focus.
- Stores session summaries and up to 100 sampled-frame records for the dashboard, history, and session detail views.

The landing page includes illustrative/demo copy and sample metrics. It is not a report of measured model performance.

## Architecture

```text
Browser (Next.js)
  ├─ stores the player's OpenAI key in localStorage
  ├─ uploads the video and key to the FastAPI backend
  └─ polls the backend for analysis status and displays saved sessions

FastAPI backend
  ├─ temporarily saves the uploaded video
  ├─ samples frames and extracts pose data with MediaPipe + OpenCV
  ├─ calls OpenAI GPT-4o with pose metrics when the tennis gate passes
  ├─ writes session and frame records to SQLite
  └─ attempts to remove the uploaded video when processing finishes
```

The frontend calls the backend directly from the browser. The API base URL is selected from `NEXT_PUBLIC_API_URL`; if it is not supplied, [next.config.ts](next.config.ts) currently defaults to the configured Render URL.

## Requirements

- Node.js 20.9 or later and npm.
- Python 3.11 recommended (the Render and Docker configurations use Python 3.11).
- A valid OpenAI API key for the app's coaching request.
- Network access to download the MediaPipe pose model during local setup.

MediaPipe and OpenCV include native components. Use a platform/interpreter combination supported by their installed wheels.

## Local development

Run the backend and frontend in separate terminals from the repository root.

### 1. Install and start the backend

Create and activate a virtual environment, then install the backend dependencies:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate with `.venv\Scripts\Activate.ps1` instead. Download the pose model into the `backend` directory; the pipeline expects the file at `backend/pose_landmarker.task`:

```bash
curl -L "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" -o pose_landmarker.task
```

The backend loads `backend/.env` at startup. Copy the example and configure `OPENAI_API_KEY`:

```bash
cp .env.example .env
```

Edit `.env` and provide a valid key. **Current implementation note:** the coaching request normally uses the key sent by the browser, but `coaching_engine.py` also constructs an OpenAI client from `OPENAI_API_KEY` during module import. Consequently, a backend environment key may be required just to start the service. Do not commit `.env` or put a real key in source control.

Start the API from the `backend` directory:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API health endpoint is available at `http://localhost:8000/api/health`; interactive API documentation is normally available at `http://localhost:8000/docs`.

### 2. Install and start the frontend

In another terminal, from the repository root:

```bash
npm ci
```

Create `.env.local` in the repository root to make the browser call the local backend:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server:

```bash
npm run dev
```

Open `http://localhost:3000`. Set the API URL before starting/building the frontend; `NEXT_PUBLIC_` values are bundled into client-side code and are not suitable for secrets.

## Configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL of the FastAPI service. For local work, use `http://localhost:8000`. Otherwise the current Next.js config defaults to `https://sliceit-backend-ex29.onrender.com`. |
| `OPENAI_API_KEY` | Backend | Loaded from `backend/.env` or the process environment. The coaching module constructs an OpenAI client from it at import time, although the analysis request passes the browser-supplied key to a separate client. |
| `PORT` | Backend hosting | Port provided by platforms such as Render; the Render start command binds Uvicorn to it. |

The browser stores the player's key under `sliceit_openai_key` in `localStorage`. The upload request sends it to the backend in the `X-OpenAI-Key` header. The server performs only a basic string-shape check (`sk-` prefix and minimum length); OpenAI determines whether the key is valid and authorized.

## Using the app

1. Start both services and open the frontend.
2. Go to **API Key** / **Settings** and enter an OpenAI API key.
3. Open **Upload**, select a video, and choose the dominant hand.
4. Start analysis. The frontend polls the backend while MediaPipe and the coaching step run.
5. Review the coaching focus and open the session report, dashboard, or history.

The practice-type selector is currently presentation-only: its value is not included in the upload request. The upload page's suggested duration and maximum file size are UI guidance, not backend-enforced limits.

## Analysis pipeline

1. The backend accepts a multipart upload (`file`) and an `is_right_handed` form value, checks the reported MIME type, saves the file under `backend/uploads/`, and creates a pending session.
2. A daemon thread opens the video with OpenCV and samples every fifth frame. MediaPipe runs one-person Pose Landmarker detection on each sampled frame with detections.
3. The pipeline records a subset of body landmarks, landmark presence/visibility, an elbow angle, wrist height, and a heuristic stroke hint. Stroke classification uses wrist position relative to the shoulder and hip midpoint; it is not a learned tennis-stroke classifier.
4. The coaching engine counts the sampled-frame labels and checks for elbow-angle variation. If its gate rejects the video, it returns a `no_tennis_detected` result without calling GPT-4o. Otherwise, it sends structured metrics and context from prior sessions to GPT-4o for a JSON coaching response.
5. Session metrics and up to 100 sampled-frame rows are saved in SQLite. In a `finally` block the backend attempts to delete the uploaded video; it logs a successful deletion or a deletion exception.

## HTTP API

The service is unauthenticated. `POST /api/analyze` requires the `X-OpenAI-Key` request header.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Returns backend health and the configured key-mode message. |
| `GET` | `/api/sessions` | Lists all stored session summaries, newest first. |
| `GET` | `/api/sessions/{session_id}` | Returns a session and its stored sampled-frame records; returns 404 if missing. |
| `GET` | `/api/sessions/{session_id}/status` | Returns in-memory progress or a database-derived state. |
| `POST` | `/api/analyze` | Accepts a video and starts background analysis. |
| `DELETE` | `/api/sessions/{session_id}` | Deletes a session and its related shot records. |

### Upload request fields

- `file`: required multipart file; the server checks that the submitted content type begins with `video/`.
- `is_right_handed`: optional multipart form value, defaults to `true`.
- `X-OpenAI-Key`: required header containing the user's OpenAI key.

An upload returns a `session_id` and initial `running` state. Poll the corresponding status path until it reports `done` or `error`. The current status endpoint may include intermediate step names/labels, coaching output, or an error string.

## Data storage and retention

- SQLite database: `backend/sessions.db`.
- Temporary uploads: `backend/uploads/`.
- MediaPipe model: `backend/pose_landmarker.task` (not session data; excluded from Git).
- Session rows include video filename, timestamps, video metadata, aggregate fields, coaching text, and the raw model response.
- Shot rows represent sampled frames with detected pose data. They are not guaranteed to correspond one-to-one with actual tennis shots.
- The upload is removed after a worker reaches its cleanup block, but deletion errors are logged and ignored. A process crash or failure before the worker starts may leave an uploaded file behind.
- The database is not automatically purged when a video is removed. Deleting a session through the API removes its related shot rows.

## Deployment notes

### Backend

[render.yaml](render.yaml) describes a Render Python web service. It installs the requirements, downloads the pose model, and starts Uvicorn on `$PORT`. The service currently has no persistent disk or external database configured. On an ephemeral filesystem, SQLite data can be lost when the instance is replaced or restarted; in-memory progress and daemon-thread jobs are also lost on process restart. Configure the required backend environment variables in the hosting service.

[backend/Dockerfile](backend/Dockerfile) builds a Python 3.11 image, installs system libraries for OpenCV/MediaPipe, downloads the model, and starts Uvicorn on port 8000. Review the Docker build context and ensure no secrets are present before building or publishing an image.

### Frontend

[firebase.json](firebase.json) is configured to serve a static `out` directory, but the current Next.js configuration does not enable static export and the app contains a dynamic session route. The checked-in Firebase configuration therefore should not be assumed to produce a working deployment from a standard `next build`. Verify the chosen hosting mode and dynamic-route behavior before deployment. The app can be hosted with a Next.js-compatible platform as well, provided `NEXT_PUBLIC_API_URL` points to the backend at build time.

## Security and privacy

This repository should be treated as a development prototype, not as a secure multi-user service:

- **In-progress API-key disclosure:** `main.py` stores `openai_key` in the in-memory status dictionary and the status endpoint returns that dictionary directly. Anyone who can request a session's status while analysis is running can receive the key. Remove the key from all status state and responses before using real keys with a deployed service.
- **No authentication or ownership checks:** session list, detail, status, upload, and delete routes are available without user identity or authorization. Session data is shared across callers of the same backend.
- **Open CORS policy:** the backend allows all origins and credentials. Restrict origins and reconsider credentialed cross-origin requests for a real deployment.
- **API key handling:** the key is saved in browser `localStorage`, sent to the SliceIt backend in a request header, and used by the backend to call OpenAI. The settings page's statement that it goes directly to OpenAI does not match the actual network path. The current status-response issue means the key is not reliably kept private while processing.
- **Uploaded video handling:** video content is sent to and processed on the backend, not exclusively on the user's device. The backend attempts to remove the temporary file after processing, but cleanup is best-effort.
- **Persisted analysis data:** session metadata, extracted keypoints, coaching output, and raw LLM response remain in the local database until the session is deleted or the database is otherwise removed.
- **No upload limits or rate limits:** the backend does not enforce the UI's stated 2 GB limit and has no visible rate limiting.

Do not use this service for sensitive videos or expose it publicly until these issues are addressed.

## Known limitations

- This is pose-based prototype analysis, not full tennis-event tracking. It does not detect the ball or racket, estimate ball trajectory or speed, or reliably segment individual shots.
- The pipeline samples every fifth frame and analyzes one person. Occlusion, camera angle, framing, lighting, and non-tennis movement can affect detections.
- Forehand/backhand/serve labels are simple wrist-position heuristics. `total_shots` is derived from counts of sampled-frame labels, not confirmed discrete shot events.
- `avg_pose_score` represents landmark visibility/presence, not tennis technique quality. The database has an `accuracy_pct` field, but the analysis path does not currently populate it.
- Coaching is an LLM interpretation of the extracted metrics, not a certified coaching assessment. It can be incomplete or incorrect; treat it as practice guidance, not medical or professional advice.
- The background worker is an in-process daemon thread, not a durable job queue. Restarting the service can interrupt work, and the in-memory status map is not shared across multiple server processes.
- The UI includes hard-coded example metrics and claims that are not computed by the current pipeline; distinguish those examples from a live session report.
- The upload page's practice type is not sent to the backend. File-size and minimum-duration guidance is not validated server-side.

## Project layout

```text
app/                  Next.js routes and page styles
  dashboard/          Session overview and charts
  history/            Session history
  profile/            Profile screen
  session/[id]/       Session detail view
  settings/           OpenAI key entry and management
  upload/              Video upload, progress, and result flow
backend/
  main.py             FastAPI routes and background analysis worker
  pose_pipeline.py    OpenCV and MediaPipe pose extraction
  coaching_engine.py  Metrics aggregation and GPT-4o coaching request
  database.py         SQLAlchemy models and SQLite setup
  requirements.txt    Python dependencies
components/           Shared React components
lib/
  api.ts              Browser API client and data types
  mockData.ts         Demo/sample content
```

## Useful commands

Run these from the repository root unless noted otherwise:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Build the frontend for production. |
| `npm run start` | Serve a previously built Next.js app. |
| `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` | Start the backend (run from `backend/` with its virtual environment active). |

There is currently no test script defined in `package.json`.
