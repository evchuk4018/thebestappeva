FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    numpy scipy sympy \
    pandas polars \
    matplotlib plotly \
    scikit-learn \
    Pillow opencv-python-headless \
    openpyxl XlsxWriter \
    pypdf reportlab python-docx

RUN useradd --create-home --shell /bin/false pyworker
WORKDIR /work
RUN mkdir -p /inputs && chmod 0o555 /inputs

COPY exec_worker.py /opt/exec_worker.py
RUN chmod 0o555 /opt/exec_worker.py

USER pyworker

ENTRYPOINT ["python", "/opt/exec_worker.py"]