document.addEventListener('DOMContentLoaded', () => {
  // DOM要素
  const startBtn = document.getElementById('startBtn');
  const compareModal = document.getElementById('compareModal');
  const resultModal = document.getElementById('resultModal');
  const compareBtn = document.getElementById('compareBtn');
  const newCompare = document.getElementById('newCompare');
  const pdf1Input = document.getElementById('pdf1');
  const pdf2Input = document.getElementById('pdf2');
  const pdf1Canvas = document.getElementById('pdf1Canvas');
  const pdf2Canvas = document.getElementById('pdf2Canvas');
  const pdf1ResultCanvas = document.getElementById('pdf1ResultCanvas');
  const pdf2ResultCanvas = document.getElementById('pdf2ResultCanvas');
  const pageInfo = document.getElementById('pageInfo');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');
  const diffStats = document.getElementById('diffStats');

  // PDFファイル
  const pdfFiles = { pdf1: null, pdf2: null };

  // グローバル変数
  let currentPage = 1;
  let totalPagesPdf1 = 0;
  let totalPagesPdf2 = 0;
  let pdfDoc1 = null;
  let pdfDoc2 = null;
  let currentDifferences = [];
  let currentScale = 1.0; // Canvasのスケールを保持

  // モーダル制御
  function showModal(modal) {
    modal.classList.remove('hidden');
  }

  function hideModal(modal) {
    modal.classList.add('hidden');
  }

  // PDFプレビューの表示
  async function renderPDF(file, canvas, pageNum = 1, initial = false) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let pdfPage;
      if (canvas.id === 'pdf1Canvas' || canvas.id === 'pdf1ResultCanvas') {
        pdfDoc1 = pdf;
        totalPagesPdf1 = pdf.numPages;
        pdfPage = await pdfDoc1.getPage(pageNum);
      } else if (canvas.id === 'pdf2Canvas' || canvas.id === 'pdf2ResultCanvas') {
        pdfDoc2 = pdf;
        totalPagesPdf2 = pdf.numPages;
        pdfPage = await pdfDoc2.getPage(pageNum);
      } else {
        console.error('Invalid canvas ID');
        return false;
      }

      const containerWidth = canvas.parentElement.clientWidth - 32;
      const viewport = pdfPage.getViewport({ scale: 1.0 });
      currentScale = containerWidth / viewport.width; // スケールを更新
      const scaledViewport = pdfPage.getViewport({ scale: currentScale });

      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      const context = canvas.getContext('2d');
      await pdfPage.render({
        canvasContext: context,
        viewport: scaledViewport
      }).promise;

      if (initial) {
        updatePageInfo();
      }

      return true;
    } catch (error) {
      console.error('PDF rendering error:', error);
      alert('ファイルの読み込みに失敗しました。');
      return false;
    }
  }

  // ページ情報の更新
  function updatePageInfo() {
    const maxPages = Math.max(totalPagesPdf1, totalPagesPdf2);
    pageInfo.textContent = `${currentPage} / ${maxPages}`;
    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= maxPages;
  }

  // 差分のハイライト表示
  function highlightDifference(diff, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    ctx.save();

    let fillColor;
    let strokeColor;
    if (diff.type === 'addition') {
      fillColor = 'rgba(0, 255, 0, 0.3)';
      strokeColor = 'rgb(0, 200, 0)';
    } else if (diff.type === 'deletion') {
      fillColor = 'rgba(255, 0, 0, 0.3)';
      strokeColor = 'rgb(200, 0, 0)';
    } else {
      fillColor = 'rgba(255, 255, 0, 0.3)';
      strokeColor = 'rgb(200, 200, 0)';
    }

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;

    const x = diff.position.x * currentScale;
    const y = diff.position.y * currentScale;
    const width = diff.position.width * currentScale;
    const height = diff.position.height * currentScale;

    ctx.fillRect(x, y, width, height);
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    const label = diff.type === 'addition' ? '追加' : diff.type === 'deletion' ? '削除' : '変更';
    ctx.fillText(label, x + 2, y + 14);

    ctx.restore();
  }
  // 指定された差分リストをハイライト表示
  function redrawHighlights() {
    clearHighlights();
    for (const diff of currentDifferences) {
      if (diff.page === currentPage) {
        highlightDifference(diff, diff.pdf === 1 ? 'pdf1ResultCanvas' : 'pdf2ResultCanvas');
      }
    }
  }

  function clearHighlights() {
    const ctx1 = pdf1ResultCanvas.getContext('2d');
    ctx1.clearRect(0, 0, pdf1ResultCanvas.width, pdf1ResultCanvas.height);
    renderPDF(pdfFiles.pdf1, pdf1ResultCanvas, currentPage);

    const ctx2 = pdf2ResultCanvas.getContext('2d');
    ctx2.clearRect(0, 0, pdf2ResultCanvas.width, pdf2ResultCanvas.height);
    renderPDF(pdfFiles.pdf2, pdf2ResultCanvas, currentPage);
  }
    
  // 比較結果の表示
  async function showComparisonResults(result) {
    console.log('Result:', result);
    
    // 差分の統計情報を表示
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
      // 差分情報を更新
      currentDifferences = result.differences.map(diff => ({
        ...diff,
        page: diff.position.page,
        pdf: diff.pdf
      }));
    
      currentPage = 1;
      await Promise.all([
        renderPDF(pdfFiles.pdf1, pdf1ResultCanvas, currentPage, true),
        renderPDF(pdfFiles.pdf2, pdf2ResultCanvas, currentPage, true)
      ]);
    
      redrawHighlights(); // 初期ハイライト表示
    
      // 結果モーダルを表示
      hideModal(compareModal);
      showModal(resultModal);
    } catch (error) {
      console.error('Error showing comparison results:', error);
      alert('結果の表示中にエラーが発生しました。');
    }
  }

  // ページナビゲーション
  prevPage.addEventListener('click', async () => {
    if (currentPage > 1) {
      currentPage--;
      updatePage();
    }
  });

  nextPage.addEventListener('click', async () => {
    const maxPages = Math.max(totalPagesPdf1, totalPagesPdf2);
    if (currentPage < maxPages) {
      currentPage++;
      updatePage();
    }
  });

  async function updatePage() {
    await Promise.all([
      renderPDF(pdfFiles.pdf1, pdf1ResultCanvas, currentPage),
      renderPDF(pdfFiles.pdf2, pdf2ResultCanvas, currentPage)
    ]);
    updatePageInfo();
    redrawHighlights();
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

  pdf1Input.addEventListener('change', (e) => {
    handleFileUpload(e.target);
  });

  pdf2Input.addEventListener('change', (e) => {
    handleFileUpload(e.target);
  });

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
    currentPage = 1;
    totalPagesPdf1 = 0;
    totalPagesPdf2 = 0;
    currentDifferences = [];

    // アップロードエリアを再表示
    for (const area of document.querySelectorAll('.upload-area')) {
      area.classList.remove('hidden');
    }

    // プレビューを非表示
    for (const container of document.querySelectorAll('.preview-container')) {
      container.classList.add('hidden');
    }

    // キャンバスをクリア
    clearCanvas(pdf1Canvas);
    clearCanvas(pdf2Canvas);
    clearCanvas(pdf1ResultCanvas);
    clearCanvas(pdf2ResultCanvas);

    // プレビューテキストを再表示
    resetPreviewText(document.getElementById('preview1'));
    resetPreviewText(document.getElementById('preview2'));

    // 比較ボタンを無効化
    compareBtn.disabled = true;

    showModal(compareModal);
  });

  function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function resetPreviewText(previewElement) {
    previewElement.innerHTML = '<p class="text-gray-500">PDFをドラッグ＆ドロップ<br>または クリックして選択</p>';
  }

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