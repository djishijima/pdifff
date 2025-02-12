# PDF Diff Analyzer

PDFファイル同士を比較し、差分を視覚的に表示するWebアプリケーションです。

## 機能

- 2つのPDFファイルをアップロードして比較
- 変更箇所の自動検出とハイライト表示
- 変更の種類（追加/削除/変更）を色分けして表示
- ページ単位での閲覧と変更箇所の確認
- 変更率と変更箇所数の表示

## 技術スタック

- Backend: Python (Flask)
- Frontend: JavaScript, HTML, CSS (Tailwind CSS)
- PDF処理: PyMuPDF (fitz)
- PDF表示: PDF.js

## 必要要件

- Python 3.8以上
- requirements.txtに記載のPythonパッケージ

## インストール方法

```bash
# リポジトリのクローン
git clone https://github.com/djishijima/-pdifff.git
cd -pdifff

# 仮想環境の作成と有効化
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# アプリケーションの起動
python app.py
```

アプリケーションは http://localhost:8002 で起動します。

## 使用方法

1. 「PDFを比較する」ボタンをクリック
2. 比較したい2つのPDFファイルをアップロード
3. 「分析開始」ボタンをクリック
4. 差分の分析結果が表示され、変更箇所がハイライトされます
5. ページ送りボタンで他のページも確認できます

## ライセンス

MIT License
# pdifff
