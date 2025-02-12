from flask import Flask, render_template, request, jsonify
import fitz  # PyMuPDF
import difflib
import os
import logging
from datetime import datetime
from itertools import zip_longest

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

def get_diff_summary(diff_text):
    """差分テキストから重要な変更点を抽出する簡易な関数"""
    if not diff_text:
        return "変更点は見つかりませんでした。"
    
    # 追加された行と削除された行を分けて集計
    added_lines = [line[2:] for line in diff_text.split('\n') if line.startswith('+ ')]
    removed_lines = [line[2:] for line in diff_text.split('\n') if line.startswith('- ')]
    
    summary_parts = []
    
    if added_lines:
        summary_parts.append(f"追加された内容（{len(added_lines)}行）:\n" + 
                           "\n".join(added_lines[:5]) + 
                           ("\n..." if len(added_lines) > 5 else ""))
    
    if removed_lines:
        summary_parts.append(f"削除された内容（{len(removed_lines)}行）:\n" + 
                           "\n".join(removed_lines[:5]) + 
                           ("\n..." if len(removed_lines) > 5 else ""))
    
    if not summary_parts:
        return "変更点は見つかりませんでした。"
    
    return "\n\n".join(summary_parts)

@app.route('/')
def index():
    return render_template('index.html')

# アップロードフォルダを設定
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/compare', methods=['POST'])
def compare_pdfs():
    if 'pdf1' not in request.files or 'pdf2' not in request.files:
        return jsonify({'error': 'PDFファイルが選択されていません'}), 400

    pdf1 = request.files['pdf1']
    pdf2 = request.files['pdf2']

    # PDFファイルを一時的に保存
    pdf1_path = os.path.join(app.config['UPLOAD_FOLDER'], 'pdf1.pdf')
    pdf2_path = os.path.join(app.config['UPLOAD_FOLDER'], 'pdf2.pdf')
    pdf1.save(pdf1_path)
    pdf2.save(pdf2_path)

    try:
        # PDFの解析
        doc1 = fitz.open(pdf1_path)
        doc2 = fitz.open(pdf2_path)

        differences = []
        total_chars = 0
        changed_chars = 0

        # 各ページを比較
        for page_num in range(min(len(doc1), len(doc2))):
            page1 = doc1[page_num]
            page2 = doc2[page_num]

            # テキストを取得
            text1 = page1.get_text()
            text2 = page2.get_text()

            # テキストを行ごとに分割
            lines1 = text1.split('\n')
            lines2 = text2.split('\n')
            total_chars += len(text1)

            # 差分を検出
            matcher = difflib.SequenceMatcher(None, lines1, lines2)
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag != 'equal':
                    changed_chars += sum(len(line) for line in lines1[i1:i2])
                    diff_type = 'change' if tag == 'replace' else ('addition' if tag == 'insert' else 'deletion')
                    
                    # 差分の位置情報を取得
                    rect = page1.search_for(''.join(lines1[i1:i2])) if i2 > i1 else page2.search_for(''.join(lines2[j1:j2]))
                    if rect:
                        bbox = rect[0]  # 最初のマッチを使用
                        differences.append({
                            'type': diff_type,
                            'content': ''.join(lines1[i1:i2]) if diff_type != 'addition' else ''.join(lines2[j1:j2]),
                            'position': {
                                'page': page_num + 1,
                                'x': bbox.x0,
                                'y': bbox.y0,
                                'width': bbox.x1 - bbox.x0,
                                'height': bbox.y1 - bbox.y0
                            }
                        })

        # 変更率を計算
        change_percentage = round((changed_chars / total_chars * 100) if total_chars > 0 else 0, 2)

        return jsonify({
            'differences': differences,
            'changePercentage': change_percentage,
            'totalPages': min(len(doc1), len(doc2))
        })

    except Exception as e:
        logging.error(f'Error comparing PDFs: {str(e)}')
        return jsonify({'error': str(e)}), 500

    finally:
        # 一時ファイルを削除
        if os.path.exists(pdf1_path):
            os.remove(pdf1_path)
        if os.path.exists(pdf2_path):
            os.remove(pdf2_path)

def highlight_differences(page1, page2):
    """ページ間の差分をハイライトする"""
    blocks1 = page1.get_text('dict')['blocks']
    blocks2 = page2.get_text('dict')['blocks']
    
    differences = []
    for block1, block2 in zip_longest(blocks1, blocks2, fillvalue=None):
        if block1 and block2:
            text1 = block1.get('text', '')
            text2 = block2.get('text', '')
            
            if text1 != text2:
                bbox = block1.get('bbox')
                if bbox:
                    differences.append({
                        'type': 'change',
                        'bbox': bbox,
                        'old_text': text1,
                        'new_text': text2
                    })
    
    return differences

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8002, debug=True)
