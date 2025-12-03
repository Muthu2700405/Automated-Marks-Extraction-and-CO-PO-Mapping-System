document.addEventListener('DOMContentLoaded', () => {
    // Apply theme preference
    applyThemeFromLocalStorage();

    // Page routing logic
    if (document.getElementById('extraction-form')) handleExtractionPage();
    else if (document.getElementById('subject-list')) handleDashboardPage();

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Clear data button
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all extracted data?')) {
                fetch('/clear_results', { method: 'POST' })
                    .then(r => r.json())
                    .then(res => {
                        alert(`✅ Cleared ${res.deleted} subject file(s).`);
                        location.reload();
                    })
                    .catch(() => alert('❌ Failed to clear data.'));
            }
        });
    }
});

// ---- THEME MANAGEMENT ----
function applyThemeFromLocalStorage() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}


// ---- DASHBOARD PAGE LOGIC ----
function handleDashboardPage() {
    const subjectList = document.getElementById('subject-list');
    const modal = document.getElementById('results-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('modal-close-btn');

    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // Load subject cards
    function loadSubjects() {
        subjectList.innerHTML = '<p class="text-center text-gray-500">Loading...</p>';
        fetch('/list_subjects')
            .then(r => r.json())
            .then(subjects => {
                subjectList.innerHTML = '';
                if (subjects.length === 0) {
                    subjectList.innerHTML = '<p class="text-center text-gray-500 mt-10">No subjects processed yet.</p>';
                    return;
                }

                subjects.forEach(subject => {
                    let badgeColor = "bg-green-100 text-green-800";
                    let badgeText = "Completed";
                    let description = "Click 'View Details' to see results";

                    if (subject.status === "Corrupted") {
                        badgeColor = "bg-red-100 text-red-800";
                        badgeText = "⚠️ Corrupted File";
                        description = "This file could not be opened. Please re-run extraction.";
                    }

                    subjectList.insertAdjacentHTML('beforeend', `
                        <div class="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
                            <h3 class="text-lg font-bold text-blue-800 dark:text-white">
                                ${subject.subjectCode} - ${subject.subjectTitle}
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">${description}</p>
                            <div class="flex justify-between items-center text-sm">
                                <span class="${badgeColor} font-medium px-3 py-1 rounded-full">${badgeText}</span>
                                <a href="#" class="view-details text-blue-600 hover:underline font-semibold"
                                    data-subject-name="${subject.fileName}">
                                    View Details
                                </a>
                            </div>
                        </div>
                    `);
                });
            })
            .catch(() => {
                subjectList.innerHTML = '<p class="text-red-500 text-center">❌ Failed to load subjects.</p>';
            });
    }

    loadSubjects();

    // Handle View Details modal
    subjectList.addEventListener('click', (e) => {
        if (!e.target.classList.contains('view-details')) return;
        e.preventDefault();

        const subjectName = e.target.dataset.subjectName;
        modalTitle.textContent = `Results for ${subjectName.replace(/_/g, ' ')}`;
        modalBody.innerHTML = '<p class="text-center">Loading...</p>';
        modal.classList.remove('hidden');

        fetch(`/results/${subjectName}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    modalBody.innerHTML = `<p class="text-red-500 text-center">${data.error}</p>`;
                    return;
                }

                if (!data || data.length === 0) {
                    modalBody.innerHTML = `<p class="text-gray-500 text-center">No records found.</p>`;
                    return;
                }

                const first = data[0];
                const metaHTML = `
                    <div class="mb-6">
                        <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">Exam Details</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <p><strong>Register Number:</strong> ${first["Register Number"] || "-"}</p>
                            <p><strong>Course Code:</strong> ${first["Course Code"] || "-"}</p>
                            <p><strong>Course Title:</strong> ${first["Course Title"] || "-"}</p>
                            <p><strong>Semester:</strong> ${first["Semester"] || "-"}</p>
                            <p><strong>Date:</strong> ${first["Exam Date"] || first["Date"] || "-"}</p>
                            <p><strong>Invigilator:</strong> ${first["Invigilator Name"] || "-"}</p>
                        </div>
                    </div>
                `;

                // Marks Table
                let tableHTML = `
                    <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">Marks Table</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border border-gray-300 dark:border-gray-600 rounded-lg">
                            <thead class="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th class="p-2">Q.No</th>
                                    <th class="p-2">CO</th>
                                    <th class="p-2">Marks Awarded</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                data.filter(row => !row["Summary Type"]).forEach(row => {
                    tableHTML += `
                        <tr class="border-b dark:border-gray-600">
                            <td class="p-2">${row["Q.No"] || "-"}</td>
                            <td class="p-2">${row["CO"] || "-"}</td>
                            <td class="p-2">${row["Marks Awarded"] || row["Marks"] || "-"}</td>
                        </tr>
                    `;
                });

                tableHTML += '</tbody></table></div>';

                // CO–PO Summary
                const summaryRows = data.filter(r => r["Summary Type"] === "CO-PO Attainment");
                let summaryHTML = "";
                if (summaryRows.length > 0) {
                    const summary = summaryRows[0];
                    summaryHTML = `
                        <div class="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">CO–PO Attainment Summary</h3>
                            <p><strong>CO Attainment:</strong> ${summary["CO Attainment (%)"]}</p>
                            <p><strong>PO Attainment:</strong> ${summary["PO Attainment (%)"]}</p>
                        </div>
                    `;
                }

                modalBody.innerHTML = metaHTML + tableHTML + summaryHTML;
            })
            .catch(err => {
                console.error(err);
                modalBody.innerHTML = `<p class="text-red-500 text-center">❌ Failed to fetch results.</p>`;
            });
    });
}


// ---- NEW EXTRACTION PAGE LOGIC ----
function handleExtractionPage() {
    const rubricUpload = document.getElementById('rubric-upload');
    const scriptsUpload = document.getElementById('scripts-upload');
    const rubricText = document.getElementById('rubric-text');
    const scriptsText = document.getElementById('scripts-text');
    const previewArea = document.getElementById('preview-area');
    const processBtn = document.getElementById('process-btn');
    const form = document.getElementById('extraction-form');

    let rubricFile = null;
    let scriptFiles = [];

    rubricUpload.addEventListener('change', (e) => {
        rubricFile = e.target.files[0];
        rubricText.textContent = rubricFile ? `File selected: ${rubricFile.name}` : 'Click to upload';
        validateForm();
    });

    scriptsUpload.addEventListener('change', (e) => {
        scriptFiles = Array.from(e.target.files);
        scriptsText.textContent = `${scriptFiles.length} script(s) selected.`;
        displayPreviews();
        validateForm();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        processFiles();
    });

    function validateForm() {
        processBtn.disabled = !(rubricFile && scriptFiles.length > 0);
    }

    function displayPreviews() {
        previewArea.innerHTML = '';
        scriptFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'relative p-2 border border-gray-200 rounded-lg';
                imgContainer.innerHTML = `<img src="${event.target.result}" class="w-full h-auto rounded-md">`;
                previewArea.appendChild(imgContainer);
            };
            reader.readAsDataURL(file);
        });
    }

    function processFiles() {
        processBtn.textContent = 'Processing...';
        processBtn.disabled = true;

        const formData = new FormData();
        formData.append('rubric', rubricFile);
        scriptFiles.forEach(file => formData.append('scripts', file));

        fetch('/process', {
            method: 'POST',
            body: formData,
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) alert(`❌ ${data.error}`);
                else {
                    alert(`✅ ${data.message}`);
                    window.location.href = "/";
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('❌ Upload failed. Check server logs.');
            })
            .finally(() => {
                processBtn.textContent = 'Process Scripts';
                validateForm();
            });
    }
}
