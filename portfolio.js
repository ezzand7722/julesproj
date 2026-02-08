// Portfolio Management Logic

// Add CSS for Portfolio
const portfolioStyle = document.createElement('style');
portfolioStyle.textContent = `
    .portfolio-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;
        margin-top: 20px;
    }
    .portfolio-item {
        position: relative;
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #eee;
    }
    .portfolio-item img, .portfolio-item video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .portfolio-delete-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(255, 0, 0, 0.8);
        color: white;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
    }
    .upload-placeholder {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.2s;
    }
    .upload-placeholder:hover {
        border-color: var(--primary);
    }
    .upload-icon {
        font-size: 2rem;
        display: block;
        margin-bottom: 8px;
    }
    .input-caption {
        width: 100%;
        padding: 8px;
        margin-top: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
    }
    .upload-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }
`;
document.head.appendChild(portfolioStyle);

// Load Portfolio
async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;

    const { data: items, error } = await supabaseDashboard
        .from('provider_portfolio')
        .select('*')
        .eq('provider_id', currentProvider.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading portfolio:', error);
        grid.innerHTML = '<p class="error-text">فشل تحميل المعرض</p>';
        return;
    }

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-state" style="grid-column: 1/-1;">لا يوجد أعمال مضافة</p>';
        return;
    }

    grid.innerHTML = items.map(item => `
        <div class="portfolio-item">
            ${item.media_type === 'video'
            ? `<video src="${item.media_url}" muted></video>`
            : `<img src="${item.media_url}" alt="${escapeHtml(item.caption)}">`
        }
            <button class="portfolio-delete-btn" onclick="deletePortfolioItem('${item.id}')" title="حذف">✕</button>
        </div>
    `).join('');
}

// Handle File Selection
window.handleFileSelect = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const previewImg = document.getElementById('previewImg');
    const previewVideo = document.getElementById('previewVideo');
    const uploadPreview = document.getElementById('uploadPreview');
    const placeholder = document.querySelector('.upload-placeholder');

    placeholder.style.display = 'none';
    uploadPreview.style.display = 'block';

    const reader = new FileReader();
    reader.onload = function (e) {
        if (file.type.startsWith('image/')) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
            previewVideo.style.display = 'none';
        } else if (file.type.startsWith('video/')) {
            previewVideo.src = e.target.result;
            previewVideo.style.display = 'block';
            previewImg.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

// Reset Upload Form
window.resetUpload = function () {
    document.getElementById('portfolioFile').value = '';
    document.getElementById('portfolioCaption').value = '';
    document.getElementById('uploadPreview').style.display = 'none';
    document.querySelector('.upload-placeholder').style.display = 'block';
}

// Upload Item
window.uploadPortfolioItem = async function () {
    const fileInput = document.getElementById('portfolioFile');
    const file = fileInput.files[0];
    const caption = document.getElementById('portfolioCaption').value;

    if (!file) {
        showNotification('الرجاء اختيار ملف', 'warning');
        return;
    }

    const btn = document.querySelector('.upload-actions .btn-primary');
    btn.disabled = true;
    btn.textContent = 'جاري الرفع...';

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentProvider.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload to Storage
        const { data: uploadData, error: uploadError } = await supabaseDashboard
            .storage
            .from('portfolio')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabaseDashboard
            .storage
            .from('portfolio')
            .getPublicUrl(filePath);

        // 3. Insert into Database
        const { error: dbError } = await supabaseDashboard
            .from('provider_portfolio')
            .insert([{
                provider_id: currentProvider.id,
                media_url: publicUrl,
                media_type: file.type.startsWith('video/') ? 'video' : 'image',
                caption: caption
            }]);

        if (dbError) throw dbError;

        showNotification('تم الرفع بنجاح! 🎉', 'success');
        resetUpload();
        loadPortfolio();

    } catch (err) {
        console.error('Upload failed:', err);
        showNotification('فشل الرفع: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'رفع';
    }
}

// Delete Item
window.deletePortfolioItem = async function (id) {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;

    try {
        const { error } = await supabaseDashboard
            .from('provider_portfolio')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('تم الحذف بنجاح', 'success');
        loadPortfolio();
    } catch (err) {
        console.error('Delete failed:', err);
        showNotification('فشل الحذف', 'error');
    }
}

// Hook into updateUI to load portfolio
const originalUpdateUI = window.updateUI;
window.updateUI = async function () {
    if (originalUpdateUI) await originalUpdateUI();
    await loadPortfolio();
};
