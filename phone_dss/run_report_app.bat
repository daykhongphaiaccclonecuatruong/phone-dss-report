@echo off
cd /d "%~dp0"
python -m streamlit run report_app.py --server.port 8501
pause
