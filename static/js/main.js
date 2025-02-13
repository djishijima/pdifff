document.addEventListener('DOMContentLoaded', () => {
    // DOM要素
    const startBtn = document.getElementById('startBtn');
    const compareModal = document.getElementById('compareModal');
    const resultModal = document.getElementById('resultModal');
    const compareBtn = document.getElementById('compareBtn');
    const newCompare = document.getElementById('newCompare');
    const pdf1Input = document.getElementById('pdf1');
    const pdf2Input = document.getElementById('pdf2');

    // PDFファイル
    const pdfFiles = { pdf1: null, pdf2: null };

    // モーダル制御
    function showModal(modal) {
        modal.classList.remove('hidden');
    }

    function hideModal(modal) {
        modal.classList.add('hidden');
    }

    // 現在のページ番号を保持
    let currentPage = 1;
    const totalPages = { pdf1: 1, pdf2: 1 };
    const pdfDocs = { pdf1: null, pdf2: null };

    // PDFプレビューの表示
    async function renderPDF(file, canvas, pageNum = 1) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            // PDFドキュメントを保存
            if (canvas.id === 'pdf1ResultCanvas') {
                pdfDocs.pdf1 = pdfDoc;
                totalPages.pdf1 = pdfDoc.numPages;
            } else if (canvas.id === 'pdf2ResultCanvas') {
                pdfDocs.pdf2 = pdfDoc;
                totalPages.pdf2 = pdfDoc.numPages;
            }

            // ページ情報を更新
            updatePageInfo();

            const pdfPage = await pdfDoc.getPage(pageNum);
            const containerWidth = canvas.parentElement.clientWidth - 32;
            const viewport = pdfPage.getViewport({ scale: 1.0 });
            const scale = containerWidth / viewport.width;
            const scaledViewport = pdfPage.getViewport({ scale });

            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;

            const context = canvas.getContext('2d');
            await pdfPage.render({
                canvasContext: context,
                viewport: scaledViewport
            }).promise;

            context.globalCompositeOperation = 'source-over';
            return true;
        } catch (error) {
            console.error('PDF rendering error:', error);
            alert('ファイルの読み込みに失敗しました。');
            return false;
        }
    }

    // ページ情報の更新
    function updatePageInfo() {
        const maxPages = Math.max(totalPages.pdf1, totalPages.pdf2);
        document.getElementById('pageInfo').textContent = `${currentPage}/${maxPages}`;

        // ページ移動ボタンの有効/無効を設定
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= maxPages;
    }

    // ファイルアップロード処理
    async function handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('PDFファイルを選択してください。');
            return;
        }

        try {
            // ファイル情報を更新
            if (input.id === 'pdf1') {
                pdfFiles.pdf1 = file;
            } else {
                pdfFiles.pdf2 = file;
            }

            // アップロードエリアを最小化
            const uploadArea = input.closest('.upload-area');
            uploadArea.style.height = '40px';
            uploadArea.style.padding = '0.5rem';
            const previewText = uploadArea.querySelector('p');
            previewText.style.margin = '0';
            previewText.textContent = `${file.name}`;

            // プレビューを表示
            const canvas = document.getElementById(`${input.id}Canvas`);
            if (canvas) {
                await renderPDF(file, canvas);
            }

            // 両方のPDFがアップロードされていれば比較ボタンを有効化
            compareBtn.disabled = !(pdfFiles.pdf1 && pdfFiles.pdf2);
        } catch (error) {
            console.error('Error handling file upload:', error);
            alert('ファイルの読み込みに失敗しました。');
        }
    }

    // イベントリスナーの設定
    startBtn.addEventListener('click', () => {
        showModal(compareModal);
    });

    // ページナビゲーションの設定
    document.getElementById('prevPage').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await Promise.all([
                renderPDF(pdfFiles.pdf1, document.getElementById('pdf1ResultCanvas'), currentPage),
                renderPDF(pdfFiles.pdf2, document.getElementById('pdf2ResultCanvas'), currentPage)
            ]);
            updatePageInfo();
        }
    });

    // ページナビゲーションの設定
    document.getElementById('nextPage').addEventListener('click', async () => {
        const maxPages = Math.max(totalPages.pdf1, totalPages.pdf2);
        if (currentPage < maxPages) {
            currentPage++;
            await Promise.all([
                renderPDF(pdfFiles.pdf1, document.getElementById('pdf1ResultCanvas'), currentPage),
                renderPDF(pdfFiles.pdf2, document.getElementById('pdf2ResultCanvas'), currentPage)
            ]);
            updatePageInfo();
        }
    });

    // PDFファイルのアップロード
    pdf1Input.addEventListener('change', (e) => {
        handleFileUpload(e.target);
    });

    pdf2Input.addEventListener('change', (e) => {
        handleFileUpload(e.target);
    });

    // 比較結果の表示
    async function showComparisonResults(result) {
        console.log('Result:', result);  // デバッグ用

        // 差分の概要を表示
        const diffStats = document.getElementById('diffStats');
        diffStats.innerHTML = `
            <div class="flex justify-center items-center space-x-8 p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-100">
                <div class="text-center">
                    <div class="text-3xl font-bold text-blue-600">${result.differences.length}</div>
                    <div class="text-sm text-blue-500">変更箇所</div>
                </div>
                <div class="text-4xl text-blue-300">•</div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-blue-600">${result.changePercentage}%</div>
                    <div class="text-sm text-blue-500">変更率</div>
                </div>
            </div>
        `;

        try {
            // 変数を初期化
            currentPage = 1;

            // PDFを結果モーダルに表示
            await Promise.all([
                renderPDF(pdfFiles.pdf1, document.getElementById('pdf1ResultCanvas'), currentPage),
                renderPDF(pdfFiles.pdf2, document.getElementById('pdf2ResultCanvas'), currentPage)
            ]);

            // ページ情報を更新
            updatePageInfo();

            // 差分の詳細を表示
            const diffContent = document.getElementById('diffContent');
            diffContent.innerHTML = '';
            for (const diff of result.differences) {
                const diffElement = document.createElement('div');
                diffElement.className = `p-2 mb-2 rounded ${diff.type === 'addition' ? 'bg-green-100' : diff.type === 'deletion' ? 'bg-red-100' : 'bg-yellow-100'}`;
                diffElement.innerHTML = `
                    <span class="font-semibold">${diff.type === 'addition' ? '追加' : diff.type === 'deletion' ? '削除' : '変更'}</span>:
                    <span class="text-gray-700">${diff.content}</span>
                    <span class="text-sm text-gray-500">(ページ ${diff.position.page})</span>
                `;
                diffElement.addEventListener('click', () => {
                    highlightDifference(diff);
                });
                diffContent.appendChild(diffElement);
            }

            // 全ての差分をハイライト表示
            for (const diff of result.differences) {
                if (diff.position && diff.position.page === currentPage) {
                    highlightDifference(diff);
                }
            }

        } catch (error) {
            console.error('Error showing comparison results:', error);
            alert('結果の表示中にエラーが発生しました。');
        }
    }

    // 差分のハイライト表示
    function highlightDifference(diff) {
        // 両方のキャンバスをクリア
        for (const canvasId of ['pdf1ResultCanvas', 'pdf2ResultCanvas']) {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // PDFを再描画
        Promise.all([
            renderPDF(pdfFiles.pdf1, document.getElementById('pdf1ResultCanvas')),
            renderPDF(pdfFiles.pdf2, document.getElementById('pdf2ResultCanvas'))
        ]).then(() => {
            // 差分をハイライト
            const canvas = document.getElementById(diff.position.page === 1 ? 'pdf1ResultCanvas' : 'pdf2ResultCanvas');
            const ctx = canvas.getContext('2d');
            const scale = canvas.width / canvas.offsetWidth;

            ctx.save();

            // 差分の種類に応じて色を設定
            if (diff.type === 'addition') {
                ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.strokeStyle = 'rgb(0, 200, 0)';
            } else if (diff.type === 'deletion') {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.strokeStyle = 'rgb(200, 0, 0)';
            } else {
                ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.strokeStyle = 'rgb(200, 200, 0)';
            }

            // 位置をスケーリング
            const x = diff.position.x * scale;
            const y = diff.position.y * scale;
            const width = diff.position.width * scale;
            const height = diff.position.height * scale;

            // 塗りつぶし
            ctx.fillRect(x, y, width, height);

            // 枠線
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);

            // ラベルを表示
            ctx.font = '14px Arial';
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            const label = diff.type === 'addition' ? '追加' :
                diff.type === 'deletion' ? '削除' : '変更';
            ctx.strokeText(label, x, y - 5);
            ctx.fillText(label, x, y - 5);

            ctx.restore();
        });
    }

    // 比較開始
    compareBtn.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('pdf1', pdfFiles.pdf1);
        formData.append('pdf2', pdfFiles.pdf2);

        try {
            compareBtn.disabled = true;
            compareBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                分析中...
            `;

            const response = await fetch('/compare', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('エラーが発生しました');
            }

            const result = await response.json();
            await showComparisonResults(result);

            // 結果モーダルを表示
            hideModal(compareModal);
            showModal(resultModal);

        } catch (error) {
            console.error('Error:', error);
            alert(`エラーが発生しました: ${error.message}`);
        } finally {
            compareBtn.disabled = false;
            compareBtn.textContent = '比較開始';
        }
    });

    // 新しい比較を開始
    newCompare.addEventListener('click', () => {
        hideModal(resultModal);
        // 全ての入力をリセット
        pdf1Input.value = '';
        pdf2Input.value = '';
        pdfFiles.pdf1 = null;
        pdfFiles.pdf2 = null;

        // アップロードエリアを再表示
        for (const area of document.querySelectorAll('.upload-area')) {
            area.classList.remove('hidden');
        }

        // プレビューを非表示
        for (const container of document.querySelectorAll('.preview-container')) {
            container.classList.add('hidden');
        }

        // 比較ボタンを無効化
        compareBtn.disabled = true;

        showModal(compareModal);
    });

    // ドラッグ＆ドロップの処理
    function setupDragAndDrop(input) {
        const area = input.closest('.upload-area');
        if (!area) return;

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight() {
            area.classList.add('drag-over');
        }

        function unhighlight() {
            area.classList.remove('drag-over');
        }

        function handleDrop(e) {
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            } else {
                alert('PDFファイルをドロップしてください。');
            }
        }

        for (const event of ['dragenter', 'dragover', 'dragleave', 'drop']) {
            area.addEventListener(event, preventDefaults);
        }

        for (const event of ['dragenter', 'dragover']) {
            area.addEventListener(event, highlight);
        }

        for (const event of ['dragleave', 'drop']) {
            area.addEventListener(event, unhighlight);
        }

        area.addEventListener('drop', handleDrop);
        area.addEventListener('click', () => input.click());
    }

    // ドラッグ＆ドロップを設定
    setupDragAndDrop(pdf1Input);
    setupDragAndDrop(pdf2Input);
});