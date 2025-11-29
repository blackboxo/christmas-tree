@echo off
REM Download MediaPipe hand landmarker model
REM This script downloads the model file to avoid loading it from Google Storage (blocked in China)

if not exist "public\models" mkdir public\models

echo Downloading hand_landmarker.task model...
curl -L "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -o public\models\hand_landmarker.task

echo Model downloaded successfully to public\models\hand_landmarker.task

