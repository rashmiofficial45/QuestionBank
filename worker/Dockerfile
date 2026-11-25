FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY document_layout.py extract.py main.py refresh_tables.py ./
ENV PYTHONUNBUFFERED=1
CMD ["python", "main.py"]
