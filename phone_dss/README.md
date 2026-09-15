# 📱 Phone DSS - Hệ trợ giúp quyết định lựa chọn điện thoại

Project xây dựng hệ trợ giúp quyết định lựa chọn điện thoại dựa trên:

- Ngân sách
- Máy mới / máy cũ
- Camera
- Gaming
- Pin
- Màn hình
- Mỏng nhẹ
- Mức độ đáng tiền

Hệ thống sử dụng Python và Pandas để đọc dữ liệu CSV, tính điểm, lọc sản phẩm và xếp hạng các điện thoại phù hợp với nhu cầu người dùng.

---

# 1. Yêu cầu trước khi chạy

Máy cần cài:

- Python 3
- Visual Studio Code
- Git (không bắt buộc nếu tải bằng ZIP)

Kiểm tra Python bằng cách mở Terminal và nhập:

```powershell
python --version

Nếu hiện ví dụ:

Python 3.12.x

thì có thể tiếp tục.

2. Tải code từ GitHub
Cách 1: Download ZIP

Trên trang GitHub của project:

Code
→ Download ZIP

Sau khi tải xong:

Chuột phải file ZIP
→ Extract All / Giải nén

Ví dụ thư mục sau khi giải nén:

C:\phone_dss-main
Cách 2: Clone bằng Git

Nếu máy đã cài Git:

git clone <link-github-cua-project>

Sau đó:

cd phone_dss
3. Mở project trong VS Code

Mở Visual Studio Code.

Chọn:

File
→ Open Folder

Sau đó chọn đúng thư mục chứa project.

Ví dụ:

C:\phone_dss-main

Thư mục project nên có dạng:

phone_dss-main/
│
├── data/
│   ├── 01_product_catalog.csv
│   ├── 02_specs.csv
│   ├── 03_chipset_benchmark.csv
│   ├── 04a_price_new.csv
│   └── 04b_price_used.csv
│
├── main.py
├── recommender.py
├── scoring.py
├── test_cases.py
└── requirements.txt
4. Mở Terminal

Trong VS Code chọn:

Terminal
→ New Terminal

Kiểm tra Terminal đang đứng đúng thư mục project.

Ví dụ:

PS C:\phone_dss-main>

Có thể kiểm tra bằng:

dir

Trong danh sách cần nhìn thấy:

main.py
recommender.py
scoring.py
requirements.txt
data

Nếu không thấy main.py thì đang đứng sai thư mục.

5. Tạo môi trường ảo Python

Chỉ cần thực hiện bước tạo .venv ở lần chạy đầu tiên:

python -m venv .venv

Sau khi chạy, project sẽ có thêm thư mục:

.venv
6. Kích hoạt môi trường ảo

Nếu dùng PowerShell:

.\.venv\Scripts\Activate.ps1

Nếu thành công, Terminal sẽ thay đổi thành:

(.venv) PS C:\phone_dss-main>
Nếu PowerShell báo lỗi:
running scripts is disabled on this system

Chạy:

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

Sau đó chạy lại:

.\.venv\Scripts\Activate.ps1

Khi nhìn thấy:

(.venv)

ở đầu Terminal là đã kích hoạt thành công.

7. Cài thư viện

Sau khi đã kích hoạt .venv, chạy:

python -m pip install -r requirements.txt

Lệnh này sẽ tự động cài các thư viện mà project cần.

Ví dụ project sử dụng:

pandas
numpy
python-dateutil
pytz
tzdata

Có thể kiểm tra pandas bằng:

python -c "import pandas as pd; print(pd.__version__)"

Nếu hiện phiên bản pandas thì đã cài thành công.

8. Chạy chương trình

Chạy:

python main.py

Chương trình sẽ hiện:

=======================================================
HỆ TRỢ GIÚP QUYẾT ĐỊNH CHỌN ĐIỆN THOẠI
=======================================================

Ngân sách tối thiểu (triệu đồng):

Ví dụ nhập:

Ngân sách tối thiểu: 5

Ngân sách tối đa: 10

Tình trạng:
1. Máy mới
2. Máy cũ

Chọn: 1

Tiêu chí:
1. Camera
2. Gaming
3. Pin
4. Màn hình
5. Mỏng nhẹ

Ưu tiên 1: 2

Ví dụ trên có nghĩa là:

Ngân sách: 5 - 10 triệu
Tình trạng: Máy mới
Ưu tiên: Gaming

Hệ thống sẽ tính điểm và trả về các điện thoại phù hợp nhất.

9. Chạy bộ test

Ngoài chương trình chính, project có file:

test_cases.py

Dùng để kiểm tra nhiều trường hợp tự động.

Chạy:

python test_cases.py

Ví dụ các test:

5 - 10 triệu - ưu tiên Gaming

5 - 10 triệu - ưu tiên Pin

7 - 15 triệu - ưu tiên Camera

5 - 10 triệu máy cũ - Gaming + Pin

Ngân sách quá thấp

Mục đích là kiểm tra khi nhu cầu người dùng thay đổi thì thứ tự điện thoại được đề xuất cũng thay đổi theo.

10. Những lần chạy sau

Sau khi đã tạo .venv và cài thư viện một lần, KHÔNG cần tạo .venv lại.

Chỉ cần mở project và chạy:

.\.venv\Scripts\Activate.ps1

sau đó:

python main.py

Nếu PowerShell tiếp tục chặn Activate thì chạy:

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

rồi:

.\.venv\Scripts\Activate.ps1
11. Một số lỗi thường gặp
Lỗi không tìm thấy main.py

Ví dụ:

can't open file 'main.py'

Nguyên nhân:

Terminal đang đứng sai thư mục.

Kiểm tra bằng:

dir

Nếu project nằm trong:

C:\phone_dss-main

thì:

cd C:\phone_dss-main

sau đó:

python main.py
Lỗi không tìm thấy pandas

Ví dụ:

ModuleNotFoundError: No module named 'pandas'

Kích hoạt .venv:

.\.venv\Scripts\Activate.ps1

Sau đó:

python -m pip install -r requirements.txt

Rồi chạy lại:

python main.py
Kiểm tra đang dùng đúng Python hay chưa

Chạy:

where.exe python

Khi .venv đang được kích hoạt, đường dẫn đầu tiên nên gần giống:

C:\phone_dss-main\.venv\Scripts\python.exe
12. Tóm tắt lệnh chạy lần đầu

Nếu vừa tải project từ GitHub về, chạy lần lượt:

cd C:\phone_dss-main

python -m venv .venv

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt

python main.py
13. Tóm tắt lệnh từ lần thứ hai
cd C:\phone_dss-main

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

.\.venv\Scripts\Activate.ps1

python main.py

Không cần chạy lại:

python -m venv .venv

và cũng không cần cài lại thư viện nếu requirements.txt chưa thay đổi.


Một chỗ bạn cần sửa trước khi đưa lên GitHub là đoạn:

```text
git clone <link-github-cua-project>

thành link repository thật của nhóm. Ngoài ra, nếu tên thư mục repo của bạn không phải phone_dss-main, bạn nên đổi các ví dụ đường dẫn trong README thành đúng tên repo để bạn bè chỉ việc copy lệnh và chạy.
