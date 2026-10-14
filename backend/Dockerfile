FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV / MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# MediaPipe PoseLandmarker model required at runtime by pose_pipeline.py
RUN python -c "import urllib.request; urllib.request.urlretrieve('https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', '/app/pose_landmarker.task')"

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
