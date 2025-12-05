const addBox = document.querySelector(".add-box"),
modalOverlay = document.getElementById("modal-overlay"),
modalContainer = document.getElementById("modal-container"),
modalCloseBtn = document.getElementById("modal-close-btn"),
titleTag = document.getElementById("note-title"),
descTag = document.getElementById("note-description"),
prevBtn = document.getElementById("prev-btn"),
nextBtn = document.getElementById("next-btn"),
submitBtn = document.getElementById("submit-btn"),
clearBtn = document.getElementById("clear-btn"),
formStats = document.getElementById("form-stats");

const months = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"];
const notes = JSON.parse(localStorage.getItem("notes") || "[]");
let isUpdate = false, updateId;
let draggedNote = null;
let autoSaveTimer = null;
let draftData = { title: "", description: "" };
let currentStep = 1;
let totalSteps = 1;

addBox.addEventListener("click", () => {
    openModal();
});

function openModal(noteToEdit = null) {
    currentStep = 1;
    updateStepDisplay();

    modalOverlay.classList.add("show");
    document.body.style.overflow = "hidden";

    // Load draft if exists
    loadDraft();

    // Initialize form enhancements
    initializeForm();

    if(window.innerWidth > 660) titleTag.focus();

    // If editing a note, populate the form
    if (noteToEdit) {
        populateFormForEdit(noteToEdit);
    }
}

function closeModal() {
    modalOverlay.classList.remove("show");
    document.body.style.overflow = "auto";

    // Clear any pending auto-save
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }

    // Reset form after a short delay
    setTimeout(() => {
        resetForm();
    }, 300);
}

modalCloseBtn.addEventListener("click", () => {
    closeModal();
});

// Keyboard shortcuts for modal
document.addEventListener('keydown', function(e) {
    if (modalOverlay.classList.contains('show')) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (currentStep === totalSteps) {
                submitBtn.click();
            } else {
                goToNextStep();
            }
        }
    }
});

function showNotes(filter = 'all') {
    if(!notes) return;
    document.querySelectorAll(".note").forEach(li => li.remove());

    let filteredNotes = notes;
    if (filter === 'pinned') {
        filteredNotes = notes.filter(note => note.pinned);
    } else if (filter === 'archived') {
        filteredNotes = notes.filter(note => note.archived);
    }

    filteredNotes.forEach((note, id) => {
        let filterDesc = note.description.replaceAll("\n", '<br/>');
        const originalId = notes.indexOf(note);

        // Determine note classes and styles
        const noteClasses = ['note'];
        if (note.pinned) noteClasses.push('pinned');
        if (note.archived) noteClasses.push('archived');
        if (note.priority) noteClasses.push(`priority-${note.priority}`);

        // Random rotation for sticky note effect (-3 to 3 degrees)
        const rotation = (Math.random() - 0.5) * 6;

        const noteStyle = `
            --note-color: ${getColorValue(note.color || 'yellow')};
            --rotation: ${rotation};
        `;

        // Priority indicator
        const priorityIcon = note.priority === 'high' ? 'uil-arrow-up' :
                           note.priority === 'low' ? 'uil-arrow-down' : 'uil-minus';

        // Category icon
        const categoryIcon = getCategoryIcon(note.category || 'personal');

        let liTag = `<li class="${noteClasses.join(' ')}" draggable="true" data-id="${originalId}" style="${noteStyle}">
                        <div class="note-header">
                            <div class="note-badges">
                                ${note.pinned ? '<span class="badge pinned-badge"><i class="uil uil-star"></i></span>' : ''}
                                <span class="badge category-badge">
                                    <i class="uil ${categoryIcon}"></i>
                                    ${note.category || 'personal'}
                                </span>
                                ${note.priority && note.priority !== 'medium' ?
                                    `<span class="badge priority-badge priority-${note.priority}">
                                        <i class="uil ${priorityIcon}"></i>
                                    </span>` : ''}
                            </div>
                            <div class="drag-handle">
                                <i class="uil uil-grip-horizontal-line"></i>
                            </div>
                        </div>

                        <div class="details">
                            <p>${note.title}</p>
                            <span>${filterDesc}</span>
                        </div>

                        <div class="bottom-content">
                            <span class="note-date">${note.date}</span>
                            <div class="note-actions">
                                ${!note.archived ? `<button class="action-btn archive-btn" onclick="toggleArchive(${originalId})" title="Archive">
                                    <i class="uil uil-archive"></i>
                                </button>` : ''}
                                <button class="action-btn pin-btn ${note.pinned ? 'active' : ''}" onclick="togglePin(${originalId})" title="${note.pinned ? 'Unpin' : 'Pin'}">
                                    <i class="uil uil-star"></i>
                                </button>
                                <div class="settings">
                                    <i onclick="showMenu(this)" class="uil uil-ellipsis-h"></i>
                                    <ul class="menu">
                                        <li onclick="updateNote(${originalId}, '${note.title}', '${filterDesc}')"><i class="uil uil-pen"></i>Edit</li>
                                        <li onclick="duplicateNote(${originalId})"><i class="uil uil-copy"></i>Duplicate</li>
                                        <li onclick="deleteNote(${originalId})"><i class="uil uil-trash"></i>Delete</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </li>`;
        addBox.insertAdjacentHTML("afterend", liTag);
    });

    // Update stats
    updateStats();

    // Add drag and drop event listeners
    const noteElements = document.querySelectorAll('.note');
    noteElements.forEach(note => {
        note.addEventListener('dragstart', handleDragStart);
        note.addEventListener('dragover', handleDragOver);
        note.addEventListener('drop', handleDrop);
        note.addEventListener('dragend', handleDragEnd);

        // Add keyboard accessibility
        note.addEventListener('keydown', handleKeyDown);
        note.setAttribute('tabindex', '0');

        // Add touch support for mobile
        note.addEventListener('touchstart', handleTouchStart, { passive: false });
        note.addEventListener('touchmove', handleTouchMove, { passive: false });
        note.addEventListener('touchend', handleTouchEnd, { passive: false });
    });
}
showNotes();

function showMenu(elem) {
    elem.parentElement.classList.add("show");
    document.addEventListener("click", e => {
        if(e.target.tagName != "I" || e.target != elem) {
            elem.parentElement.classList.remove("show");
        }
    });
}

function deleteNote(noteId) {
    let confirmDel = confirm("Are you sure you want to delete this note?");
    if(!confirmDel) return;
    notes.splice(noteId, 1);
    localStorage.setItem("notes", JSON.stringify(notes));
    showNotes();
}

function updateNote(noteId, title, filterDesc) {
    let description = filterDesc.replaceAll('<br/>', '\r\n');
    updateId = noteId;
    isUpdate = true;

    // Get the note data
    const note = notes[noteId];
    if (note) {
        openModal(note);
    }
}

function populateFormForEdit(note) {
    // Populate basic fields
    titleTag.value = note.title || '';
    descTag.value = note.description || '';
    updateCounters();

    // Populate dropdowns
    document.getElementById('note-category').value = note.category || 'personal';
    document.getElementById('note-priority').value = note.priority || 'medium';
    document.getElementById('note-color').value = note.color || 'yellow';

    // Update modal title
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) modalTitle.textContent = 'Edit Note';
}

// Enhanced Form Functions
function initializeForm() {
    // Add event listeners for real-time updates
    titleTag.addEventListener('input', handleInputChange);
    descTag.addEventListener('input', handleInputChange);

    // Add keyboard shortcuts
    titleTag.addEventListener('keydown', handleKeyboardShortcuts);
    descTag.addEventListener('keydown', handleKeyboardShortcuts);

    // Clear button functionality
    clearBtn.addEventListener('click', clearForm);

    // Update counters initially
    updateCounters();
}

function handleInputChange() {
    updateCounters();
    autoSaveDraft();
    validateField(this);
}

function updateCounters() {
    // Title counter
    const titleCount = titleTag.value.length;
    const titleCounter = titleTag.parentElement.querySelector('.char-count .current');
    if (titleCounter) {
        titleCounter.textContent = titleCount;
        titleCounter.style.color = titleCount > 80 ? '#e74c3c' : 'var(--primary-color)';
    }

    // Description counter and word count
    const descCount = descTag.value.length;
    const wordCount = descTag.value.trim() === '' ? 0 : descTag.value.trim().split(/\s+/).length;

    const descCounter = descTag.parentElement.querySelector('.char-count .current');
    const wordCounter = descTag.parentElement.querySelector('.word-count');

    if (descCounter) {
        descCounter.textContent = descCount;
        descCounter.style.color = descCount > 800 ? '#e74c3c' : 'var(--primary-color)';
    }

    if (wordCounter) {
        wordCounter.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    }
}

function autoSaveDraft() {
    const currentData = {
        title: titleTag.value,
        description: descTag.value,
        timestamp: Date.now()
    };

    // Only save if there's actual content
    if (currentData.title.trim() || currentData.description.trim()) {
        localStorage.setItem('noteDraft', JSON.stringify(currentData));

        // Show draft saved indicator
        const draftStatus = titleTag.parentElement.querySelector('.draft-status');
        if (draftStatus) {
            draftStatus.classList.add('visible');
            setTimeout(() => draftStatus.classList.remove('visible'), 2000);
        }

        // Clear previous timer
        if (autoSaveTimer) clearTimeout(autoSaveTimer);

        // Set new timer to clear old drafts after 24 hours
        autoSaveTimer = setTimeout(() => {
            const draft = JSON.parse(localStorage.getItem('noteDraft') || '{}');
            if (draft.timestamp && Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('noteDraft');
            }
        }, 1000);
    }
}

function loadDraft() {
    const draft = JSON.parse(localStorage.getItem('noteDraft') || '{}');
    if (draft.title || draft.description) {
        // Check if draft is less than 24 hours old
        if (!draft.timestamp || Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
            titleTag.value = draft.title || '';
            descTag.value = draft.description || '';
            updateCounters();
        } else {
            localStorage.removeItem('noteDraft');
        }
    }
}

function validateField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required') || field.id === 'note-title' || field.id === 'note-description';
    const errorMessage = field.parentElement.querySelector('.error-message');

    // Remove previous error styling
    field.classList.remove('field-error');
    if (errorMessage) errorMessage.classList.remove('visible');

    // Validation rules
    if (isRequired && !value) {
        field.classList.add('field-error');
        if (errorMessage) {
            errorMessage.textContent = 'This field is required';
            errorMessage.classList.add('visible');
        }
        return false;
    }

    if (field.id === 'note-title' && value.length > 100) {
        field.classList.add('field-error');
        if (errorMessage) {
            errorMessage.textContent = 'Title must be 100 characters or less';
            errorMessage.classList.add('visible');
        }
        return false;
    }

    if (field.id === 'note-description' && value.length > 1000) {
        field.classList.add('field-error');
        if (errorMessage) {
            errorMessage.textContent = 'Description must be 1000 characters or less';
            errorMessage.classList.add('visible');
        }
        return false;
    }

    return true;
}

function validateForm() {
    let isValid = true;
    isValid &= validateField(titleTag);
    isValid &= validateField(descTag);
    return isValid;
}

function handleKeyboardShortcuts(e) {
    // Ctrl+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitBtn.click();
    }

    // Escape to close
    if (e.key === 'Escape') {
        closeModal();
    }
}

function clearForm() {
    if (confirm('Are you sure you want to clear the form? This will delete your draft.')) {
        resetForm();
        localStorage.removeItem('noteDraft');
        titleTag.focus();
    }
}

function resetForm() {
    titleTag.value = '';
    descTag.value = '';
    updateCounters();

    // Reset dropdowns to defaults
    document.getElementById('note-category').value = 'personal';
    document.getElementById('note-priority').value = 'medium';
    document.getElementById('note-color').value = 'yellow';

    // Clear errors
    document.querySelectorAll('.field-error').forEach(error => error.classList.remove('visible'));
    document.querySelectorAll('.field-error').forEach(error => error.textContent = '');

    // Clear draft status
    const draftStatus = document.getElementById('draft-indicator');
    if (draftStatus) draftStatus.classList.remove('visible');

    currentStep = 1;
    updateStepDisplay();
}

// Step Navigation Functions
function updateStepDisplay() {
    // Update progress indicators
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 === currentStep);
    });

    // Update form steps
    document.querySelectorAll('.form-step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 === currentStep);
    });

    // Update stats
    formStats.textContent = 'Ready to create';

    // Scroll to top of modal content
    const modalContent = document.getElementById('modal-content');
    modalContent.scrollTop = 0;
}


function showFieldError(errorId, message) {
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('visible');

        // Shake animation
        const field = errorElement.previousElementSibling;
        if (field) {
            field.style.animation = 'shake 0.4s ease';
            setTimeout(() => field.style.animation = '', 400);
        }
    }
}

function handleFormSubmission(e) {
    e.preventDefault();

    // Validate entire form
    if (!validateForm()) {
        // Shake animation for invalid form
        modalContainer.classList.add('shake');
        setTimeout(() => modalContainer.classList.remove('shake'), 500);
        return;
    }

    // Show loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="uil uil-plus"></i> Creating...';
    submitBtn.classList.add('btn-loading');

    let title = titleTag.value.trim(),
    description = descTag.value.trim();

    if(title || description) {
        let currentDate = new Date(),
        month = months[currentDate.getMonth()],
        day = currentDate.getDate(),
        year = currentDate.getFullYear();

        // Get form data from dropdowns
        const category = document.getElementById('note-category').value || 'personal';
        const priority = document.getElementById('note-priority').value || 'medium';
        const color = document.getElementById('note-color').value || 'yellow';

        let noteInfo = {
            title,
            description,
            date: `${month} ${day}, ${year}`,
            category,
            priority,
            color,
            pinned: false, // Always false since we removed pin from form
            archived: false
        };

        if(!isUpdate) {
            notes.push(noteInfo);
        } else {
            isUpdate = false;
            notes[updateId] = noteInfo;
        }
        localStorage.setItem("notes", JSON.stringify(notes));

        // Clear draft after successful save
        localStorage.removeItem('noteDraft');

        // Simulate loading delay for better UX
        setTimeout(() => {
            showNotes();
            closeModal();

            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.classList.remove('btn-loading');
        }, 500);
    } else {
        // Reset button if no content
        submitBtn.innerHTML = originalText;
        submitBtn.classList.remove('btn-loading');
    }
}


// Initialize UI Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Modal event listeners
    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Form submission
    submitBtn.addEventListener('click', handleFormSubmission);

    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    searchInput.addEventListener('input', function() {
        searchNotes(this.value);
    });

    searchBtn.addEventListener('click', function() {
        searchNotes(searchInput.value);
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            showNotes(this.dataset.filter);
        });
    });

    // Export/Import buttons
    document.getElementById('export-btn').addEventListener('click', exportNotes);

    const importBtn = document.getElementById('import-btn');
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.style.display = 'none';
    importInput.addEventListener('change', importNotes);
    document.body.appendChild(importInput);

    importBtn.addEventListener('click', function() {
        importInput.click();
    });

    // Form selectors
    document.querySelectorAll('.category-btn, .option-card').forEach(btn => {
        btn.addEventListener('click', function() {
            const siblings = this.parentElement.querySelectorAll('.category-btn, .option-card');
            siblings.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.querySelectorAll('.priority-btn, .priority-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const siblings = this.parentElement.querySelectorAll('.priority-btn, .priority-option');
            siblings.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.querySelectorAll('.color-btn, .color-option').forEach(btn => {
        btn.addEventListener('click', function() {
            const siblings = this.parentElement.querySelectorAll('.color-btn, .color-option');
            siblings.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Drag and Drop Functions
function handleDragStart(e) {
    draggedNote = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Add visual feedback
    if (this !== draggedNote) {
        this.classList.add('drag-over');
    }

    return false;
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draggedNote !== this) {
        const draggedIndex = parseInt(draggedNote.dataset.id);
        const targetIndex = parseInt(this.dataset.id);

        // Reorder the notes array
        const draggedNoteData = notes[draggedIndex];
        notes.splice(draggedIndex, 1);
        notes.splice(targetIndex, 0, draggedNoteData);

        // Save to localStorage
        localStorage.setItem("notes", JSON.stringify(notes));

        // Re-render notes
        showNotes();
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    // Remove drag-over class from all notes
    document.querySelectorAll('.note').forEach(note => {
        note.classList.remove('drag-over');
    });
    draggedNote = null;
}

// Keyboard Accessibility
function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startKeyboardDrag(this);
    }
}

function startKeyboardDrag(note) {
    const notes = Array.from(document.querySelectorAll('.note'));
    const currentIndex = notes.indexOf(note);

    // Add visual indication
    note.classList.add('dragging');
    note.style.outline = '2px solid var(--primary-color)';

    // Listen for arrow keys to move
    const handleKeyMove = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const direction = e.key === 'ArrowUp' ? -1 : 1;
            const newIndex = Math.max(0, Math.min(notes.length - 1, currentIndex + direction));

            if (newIndex !== currentIndex) {
                // Reorder in DOM
                const parent = note.parentNode;
                if (direction > 0) {
                    parent.insertBefore(note, notes[newIndex + 1]);
                } else {
                    parent.insertBefore(note, notes[newIndex]);
                }

                // Update notes array
                const noteData = notes.splice(currentIndex, 1)[0];
                notes.splice(newIndex, 0, noteData);

                // Update data-ids
                notes.forEach((n, i) => n.dataset.id = i);
            }
        } else if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            endKeyboardDrag(note, notes);
        }
    };

    document.addEventListener('keydown', handleKeyMove);

    function endKeyboardDrag(note, notes) {
        document.removeEventListener('keydown', handleKeyMove);
        note.classList.remove('dragging');
        note.style.outline = '';

        // Save new order
        const reorderedNotes = notes.map(note => {
            const id = parseInt(note.dataset.id);
            return notes[id];
        });

        localStorage.setItem("notes", JSON.stringify(reorderedNotes));
        showNotes();
    }
}

// Touch Support for Mobile
let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = false;
}

function handleTouchMove(e) {
    if (!touchStartX || !touchStartY) return;

    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Only start dragging if moved more than threshold
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        if (!isDragging) {
            isDragging = true;
            this.classList.add('dragging');
            draggedNote = this;
        }
    }

    if (isDragging) {
        e.preventDefault();
        // Find the element under the touch
        const elementAtPoint = document.elementFromPoint(touchEndX, touchEndY);
        if (elementAtPoint && elementAtPoint.classList.contains('note') && elementAtPoint !== this) {
            elementAtPoint.classList.add('drag-over');
        }
    }
}

function handleTouchEnd(e) {
    if (isDragging && draggedNote) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const elementAtPoint = document.elementFromPoint(touchEndX, touchEndY);

        if (elementAtPoint && elementAtPoint.classList.contains('note') && elementAtPoint !== draggedNote) {
            const draggedIndex = parseInt(draggedNote.dataset.id);
            const targetIndex = parseInt(elementAtPoint.dataset.id);

            // Reorder the notes array
            const draggedNoteData = notes[draggedIndex];
            notes.splice(draggedIndex, 1);
            notes.splice(targetIndex, 0, draggedNoteData);

            // Save to localStorage
            localStorage.setItem("notes", JSON.stringify(notes));

            // Re-render notes
            showNotes();
        }

        draggedNote.classList.remove('dragging');
        document.querySelectorAll('.note').forEach(note => {
            note.classList.remove('drag-over');
        });
    }

    touchStartX = 0;
    touchStartY = 0;
    isDragging = false;
    draggedNote = null;
}

// Helper Functions for New Features
function getColorValue(color) {
    const colors = {
        yellow: '#fef3c7',
        blue: '#dbeafe',
        green: '#d1fae5',
        pink: '#fce7f3',
        purple: '#e9d5ff',
        orange: '#fed7aa'
    };
    return colors[color] || colors.yellow;
}

function getCategoryIcon(category) {
    const icons = {
        personal: 'uil-user',
        work: 'uil-briefcase',
        ideas: 'uil-lightbulb-alt',
        reminders: 'uil-bell'
    };
    return icons[category] || icons.personal;
}

function updateStats() {
    const totalNotes = notes.length;
    const pinnedNotes = notes.filter(note => note.pinned).length;
    const archivedNotes = notes.filter(note => note.archived).length;

    document.getElementById('total-notes').textContent = `${totalNotes} notes`;
}

function togglePin(noteId) {
    notes[noteId].pinned = !notes[noteId].pinned;
    localStorage.setItem("notes", JSON.stringify(notes));
    showNotes();
}

function toggleArchive(noteId) {
    notes[noteId].archived = !notes[noteId].archived;
    localStorage.setItem("notes", JSON.stringify(notes));
    showNotes();
}

function duplicateNote(noteId) {
    const originalNote = notes[noteId];
    const duplicatedNote = {
        ...originalNote,
        title: originalNote.title + ' (Copy)',
        date: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })
    };

    notes.splice(noteId + 1, 0, duplicatedNote);
    localStorage.setItem("notes", JSON.stringify(notes));
    showNotes();
}

// Search functionality
function searchNotes(query) {
    if (!query.trim()) {
        showNotes();
        return;
    }

    document.querySelectorAll(".note").forEach(li => li.remove());

    const filteredNotes = notes.filter(note =>
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.description.toLowerCase().includes(query.toLowerCase()) ||
        (note.category && note.category.toLowerCase().includes(query.toLowerCase()))
    );

    filteredNotes.forEach((note, id) => {
        let filterDesc = note.description.replaceAll("\n", '<br/>');
        const originalId = notes.indexOf(note);

        const noteClasses = ['note'];
        if (note.pinned) noteClasses.push('pinned');
        if (note.archived) noteClasses.push('archived');
        if (note.priority) noteClasses.push(`priority-${note.priority}`);

        const noteStyle = note.color ? `--note-color: ${getColorValue(note.color)}` : '';
        const categoryIcon = getCategoryIcon(note.category || 'personal');

        let liTag = `<li class="${noteClasses.join(' ')}" draggable="true" data-id="${originalId}" style="${noteStyle}">
                        <div class="note-header">
                            <div class="note-badges">
                                ${note.pinned ? '<span class="badge pinned-badge"><i class="uil uil-star"></i></span>' : ''}
                                <span class="badge category-badge">
                                    <i class="uil ${categoryIcon}"></i>
                                    ${note.category || 'personal'}
                                </span>
                            </div>
                            <div class="drag-handle">
                                <i class="uil uil-grip-horizontal-line"></i>
                            </div>
                        </div>
                        <div class="details">
                            <p>${note.title}</p>
                            <span>${filterDesc}</span>
                        </div>
                        <div class="bottom-content">
                            <span class="note-date">${note.date}</span>
                            <div class="note-actions">
                                <button class="action-btn pin-btn ${note.pinned ? 'active' : ''}" onclick="togglePin(${originalId})">
                                    <i class="uil uil-star"></i>
                                </button>
                                <div class="settings">
                                    <i onclick="showMenu(this)" class="uil uil-ellipsis-h"></i>
                                    <ul class="menu">
                                        <li onclick="updateNote(${originalId}, '${note.title}', '${filterDesc}')"><i class="uil uil-pen"></i>Edit</li>
                                        <li onclick="duplicateNote(${originalId})"><i class="uil uil-copy"></i>Duplicate</li>
                                        <li onclick="deleteNote(${originalId})"><i class="uil uil-trash"></i>Delete</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </li>`;
        addBox.insertAdjacentHTML("afterend", liTag);
    });
}

// Export/Import functionality
function exportNotes() {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `yonote-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importNotes(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedNotes = JSON.parse(e.target.result);
            if (Array.isArray(importedNotes)) {
                const confirmImport = confirm(`Import ${importedNotes.length} notes? This will merge with your existing notes.`);
                if (confirmImport) {
                    notes = [...notes, ...importedNotes];
                    localStorage.setItem("notes", JSON.stringify(notes));
                    showNotes();
                    alert('Notes imported successfully!');
                }
            } else {
                alert('Invalid file format. Please select a valid YoNote backup file.');
            }
        } catch (error) {
            alert('Error reading file. Please select a valid JSON file.');
        }
    };
    reader.readAsText(file);
}