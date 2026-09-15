@echo off
cd /d "%~dp0"
python -m streamlit run web_app.py --server.port 8502
pause
