const listEl = document.getElementById('entry-list');
const newBtn = document.getElementById('new-btn');
const titleInput = document.getElementById('title-input');
const saveStatus = document.getElementById('save-status');
const bookGui = document.getElementById('book-gui');
const exportBtn = document.getElementById('export-btn');
const importFile = document.getElementById('import-file');
const searchInput = document.getElementById('search-input');
const xpFill = document.getElementById('xp-bar-fill');
const xpLevel = document.getElementById('xp-level');

const icons = Quill.import('ui/icons');
icons['code'] = '<span style="font-family: SGA; font-size: 1.2rem;">E</span>';

const quill = new Quill('#quill-editor', {
    theme: 'snow',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['image', 'code', 'clean'] 
        ]
    }
});

let entries = [];
try { entries = JSON.parse(localStorage.getItem('mcJournals')) || []; } 
catch (e) { entries = []; }

let currentId = null;
let saveTimeout;

const clickSound = new Audio('sounds/click.mp3');
const pageSound = new Audio('sounds/page.mp3');
const levelUpSound = new Audio('sounds/levelup.mp3');

function playSound(sound) {
    sound.currentTime = 0; 
    sound.play().catch(e => console.log("Sound skipped"));
}

// === Permanent Advancements System ===
let unlockedAdvs = JSON.parse(localStorage.getItem('mcAdvs')) || [];

function unlockAdvancement(id, title) {
    if (!unlockedAdvs.includes(id)) {
        unlockedAdvs.push(id);
        localStorage.setItem('mcAdvs', JSON.stringify(unlockedAdvs));
        showAdvancement(title);
        updateAdvancementsUI();
    }
}

function updateAdvancementsUI() {
    document.querySelectorAll('.adv-node').forEach(node => {
        const img = node.querySelector('img');
        if (unlockedAdvs.includes(node.id)) {
            node.classList.remove('locked');
            node.classList.add('unlocked');
            if(img) { img.style.filter = 'grayscale(0%)'; img.style.opacity = '1'; }
        } else {
            node.classList.add('locked');
            node.classList.remove('unlocked');
            if(img) { img.style.filter = 'grayscale(100%)'; img.style.opacity = '0.5'; }
        }
    });
}

function init() {
    updateAdvancementsUI(); 
    renderList();
    if (entries.length > 0) {
        loadEntry(entries[0].id);
    } else {
        createNewEntry();
    }
}

function renderList(searchTerm = "") {
    listEl.innerHTML = '';
    const filteredEntries = entries.filter(e => {
        if (!e) return false; 
        const title = (e.title || "Untitled Book").toLowerCase();
        return title.includes(searchTerm.toLowerCase());
    });

    filteredEntries.sort((a, b) => (b.date || 0) - (a.date || 0)).forEach(entry => {
        const slot = document.createElement('div');
        slot.className = `inv-slot ${entry.id === currentId ? 'active' : ''}`;
        
        const icon = document.createElement('img');
        icon.src = 'favicon-32x32.png'; 
        slot.appendChild(icon);

        const titleText = document.createElement('span');
        titleText.className = 'inv-title-text';
        titleText.innerText = entry.title || "Untitled Book";
        slot.appendChild(titleText);

        slot.onclick = () => {
            playSound(clickSound);
            loadEntry(entry.id);
            if (sidebar.classList.contains('open')) toggleMobileMenu();
        };
        listEl.appendChild(slot);
    });
}

function triggerAnimation() {
    bookGui.classList.remove('book-animate');
    void bookGui.offsetWidth;
    bookGui.classList.add('book-animate');
}

function loadEntry(id) {
    const entry = entries.find(e => e && e.id === id);
    if (entry) {
        if (currentId !== id) { triggerAnimation(); playSound(pageSound); }
        currentId = id;
        titleInput.value = entry.title || "";
        quill.root.innerHTML = entry.content || ""; 
        saveStatus.innerText = "Loaded";
        applyDimension(entry.dimension || 'overworld');
        renderList(searchInput.value);
    }
}

function createNewEntry() {
    playSound(pageSound);
    const newEntry = { id: Date.now().toString(), title: "", content: "", date: Date.now(), dimension: "overworld" };
    entries.push(newEntry);
    loadEntry(newEntry.id);
    titleInput.focus();
    unlockAdvancement('adv-authors', "Author's Journey");
}

const deleteBtn = document.getElementById('delete-btn');
deleteBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to throw this book in the lava? This cannot be undone!")) {
        playSound(clickSound);
        entries = entries.filter(e => e.id !== currentId);
        localStorage.setItem('mcJournals', JSON.stringify(entries));
        unlockAdvancement('adv-delete', 'Playing with Fire'); // Lava Bucket Adv!
        
        if(entries.length > 0) { loadEntry(entries[0].id); } 
        else { createNewEntry(); }
    }
});

// === Helper logic to calculate streaks for both saving and progress viewing ===
function calculateCurrentStreak() {
    if (entries.length === 0) return 0;
    const daysWritten = [...new Set(entries.map(e => {
        const d = new Date(e.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }))].sort((a, b) => new Date(b) - new Date(a)); 

    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0,0,0,0);

    for (let i = 0; i < daysWritten.length; i++) {
        const writeDate = new Date(daysWritten[i]);
        if (writeDate.getTime() === checkDate.getTime()) {
            streak++; checkDate.setDate(checkDate.getDate() - 1); 
        } else if (i === 0 && Math.abs(new Date() - writeDate) < 172800000) {
            checkDate.setDate(checkDate.getDate() - 1); i--; 
        } else { break; }
    }
    return streak;
}

function triggerSave() {
    saveStatus.innerText = "Saving...";
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const entryIndex = entries.findIndex(e => e.id === currentId);
        if (entryIndex !== -1) {
            entries[entryIndex].title = titleInput.value;
            entries[entryIndex].content = quill.root.innerHTML; 
            entries[entryIndex].date = Date.now();
            localStorage.setItem('mcJournals', JSON.stringify(entries));
            saveStatus.innerText = "Saved!";
            renderList(searchInput.value); 
        }

        // --- Core Stats ---
        let totalWordsAllBooks = 0;
        entries.forEach(e => {
            const textOnly = (e.content || "").replace(/<[^>]*>?/gm, '');
            totalWordsAllBooks += textOnly.trim().length > 0 ? textOnly.trim().split(/\s+/).length : 0;
        });
        const currentText = quill.getText().trim();
        const currentWordCount = currentText.length > 0 ? currentText.split(/\s+/).length : 0;
        
        xpLevel.innerText = currentWordCount; 
        xpFill.style.width = `${(currentWordCount % 50) / 50 * 100}%`;
        
        // --- Advancement Checks ---
        if(totalWordsAllBooks >= 10000) unlockAdvancement('adv-10k', 'Librarian');
        
        const streak = calculateCurrentStreak();
        if(streak >= 3) unlockAdvancement('adv-streak-3', 'Getting Wood');
        if(streak >= 7) unlockAdvancement('adv-streak-7', 'Time to Mine!');
        if(streak >= 30) unlockAdvancement('adv-streak-30', 'Diamonds!');
        if(streak >= 64) unlockAdvancement('adv-streak-64', 'A Full Stack');

        // Editor Formatting Detectors
        const html = quill.root.innerHTML;
        if (html.includes('<img')) unlockAdvancement('adv-img', 'Masterpiece');
        if (html.includes('SGA') || html.includes('ql-code-block-container')) unlockAdvancement('adv-code', 'Enchanter');
        if (html.includes('<li>')) unlockAdvancement('adv-bullet', 'Organized Mind');
        if (html.includes('color:') || html.includes('background-color:')) unlockAdvancement('adv-color', 'Colorful Personality');

        // Time Checkers
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) unlockAdvancement('adv-night', 'Night Owl');
        if (hour >= 5 && hour < 8) unlockAdvancement('adv-early', 'Early Bird');
        
        // Weather Checker
        if (document.body.classList.contains('weather-rain') || document.body.classList.contains('weather-snow')) {
            if(document.querySelector('.dim-btn.active').dataset.dim === 'overworld') {
                unlockAdvancement('adv-storm', 'Shelter from the Storm');
            }
        }

    }, 500);
}

function exportData() {
    playSound(clickSound);
    const dataStr = JSON.stringify(entries);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `mc_journal_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    unlockAdvancement('adv-storage', 'Safe Storage');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                entries = importedData;
                localStorage.setItem('mcJournals', JSON.stringify(entries));
                playSound(pageSound);
                init();
                alert("Journal successfully restored from chest!");
            } else { alert("Invalid backup file format."); }
        } catch (error) { alert("Error reading backup file."); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

function showAdvancement(message) {
    const toast = document.getElementById('advancement-toast');
    const desc = document.getElementById('toast-desc');
    desc.innerText = message;
    playSound(levelUpSound);
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 6000);
}

const dimBtns = document.querySelectorAll('.dim-btn');
const zenBtn = document.getElementById('zen-btn');
let isZenMode = false;
let weatherTimer; 

dimBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSound(clickSound);
        const selectedDim = e.target.closest('.dim-btn').dataset.dim;
        const entryIndex = entries.findIndex(e => e.id === currentId);
        if (entryIndex !== -1) { entries[entryIndex].dimension = selectedDim; triggerSave(); }
        applyDimension(selectedDim);
    });
});

function applyDimension(dim) {
    dimBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-dim="${dim}"]`).classList.add('active');
    
    document.body.className = ''; 
    document.body.classList.remove('weather-rain', 'weather-snow');
    if (rainAudio) rainAudio.pause(); 
    clearInterval(weatherTimer); 
    
    if (dim !== 'overworld') {
        document.body.classList.add(`theme-${dim}`);
        if(dim === 'nether') unlockAdvancement('adv-nether', 'We Need to Go Deeper');
        if(dim === 'end') unlockAdvancement('adv-end', 'The End?');
    } else if (!isZenMode) {
        rollWeather(); 
        checkTimeOfDay(); 
        weatherTimer = setInterval(() => { rollWeather(); checkTimeOfDay(); }, 180000); 
    }
    
    if (isZenMode) document.body.classList.add('zen-mode');
    if (typeof updateMusicDimension === 'function') updateMusicDimension(dim);
}

function checkTimeOfDay() {
    const hour = new Date().getHours();
    document.body.classList.remove('time-sunset', 'time-night');
    if (document.querySelector('.dim-btn.active').dataset.dim === 'overworld' && !isZenMode) {
        if (hour >= 18 && hour < 20) { document.body.classList.add('time-sunset'); } 
        else if (hour >= 20 || hour < 6) { document.body.classList.add('time-night'); }
    }
}

function rollWeather() {
    document.body.classList.remove('weather-rain', 'weather-snow');
    const chance = Math.random(); 
    if (chance < 0.25) { 
        document.body.classList.add('weather-rain');
        if (isMusicPlaying) rainAudio.play().catch(e => console.log("Rain blocked"));
    } 
    else if (chance < 0.50) { document.body.classList.add('weather-snow'); if (rainAudio) rainAudio.pause(); } 
    else { if (rainAudio) rainAudio.pause(); }
}

const playPauseBtn = document.getElementById('play-pause-btn');
const volumeSlider = document.getElementById('volume-slider');
const nowPlayingText = document.getElementById('now-playing');
const musicTracks = { overworld: new Audio('sounds/music-ow.mp3'), nether: new Audio('sounds/music-nt.mp3'), end: new Audio('sounds/music-en.mp3') };
const rainAudio = new Audio('sounds/rain.mp3');
rainAudio.loop = true;
Object.values(musicTracks).forEach(track => track.loop = true);

let currentMusic = musicTracks.overworld; 
let isMusicPlaying = false;

playPauseBtn.addEventListener('click', () => {
    playSound(clickSound);
    isMusicPlaying = !isMusicPlaying;
    const activeDim = document.querySelector('.dim-btn.active').dataset.dim || 'overworld';
    
    if (isMusicPlaying) {
        playPauseBtn.innerText = "⏸ Pause Music";
        currentMusic.volume = volumeSlider.value;
        currentMusic.play().catch(e => console.log("Music play blocked"));
        if (document.body.classList.contains('weather-rain')) rainAudio.play();
        nowPlayingText.innerText = `Playing: ${activeDim.charAt(0).toUpperCase() + activeDim.slice(1)}`;
        unlockAdvancement('adv-music', 'Music to my Ears'); // Music Adv!
    } else {
        playPauseBtn.innerText = "🎵 Play Music";
        currentMusic.pause();
        rainAudio.pause(); 
        nowPlayingText.innerText = "Music: Paused";
    }
});

volumeSlider.addEventListener('input', (e) => {
    if (currentMusic) currentMusic.volume = e.target.value;
    if (rainAudio) rainAudio.volume = e.target.value;
});

function updateMusicDimension(dim) {
    if (currentMusic !== musicTracks[dim]) {
        if (isMusicPlaying) currentMusic.pause(); 
        currentMusic = musicTracks[dim]; 
        currentMusic.volume = volumeSlider.value;
        if (isMusicPlaying) {
            currentMusic.play().catch(e => console.log("Music switch blocked"));
            nowPlayingText.innerText = `Playing: ${dim.charAt(0).toUpperCase() + dim.slice(1)}`;
        }
    }
}

const exitZenBtn = document.getElementById('exit-zen-btn');
const sparksContainer = document.getElementById('sparks-container');
const campfireAudio = new Audio('sounds/campfire.mp3');
campfireAudio.loop = true;
let sparkInterval;

function createSpark() {
    const spark = document.createElement('div');
    spark.classList.add('spark');
    spark.style.left = Math.random() * 100 + 'vw';
    const duration = Math.random() * 4 + 2; 
    spark.style.animationDuration = duration + 's';
    spark.style.setProperty('--drift', (Math.random() * 200 - 100) + 'px');
    sparksContainer.appendChild(spark);
    setTimeout(() => { spark.remove(); }, duration * 1000);
}

function toggleZenMode() {
    isZenMode = !isZenMode;
    playSound(clickSound);
    if (isZenMode) {
        document.body.classList.add('zen-mode');
        campfireAudio.play().catch(e => console.log("Campfire audio blocked"));
        sparkInterval = setInterval(createSpark, 150);
        unlockAdvancement('adv-zen', 'Zen Master');
    } else {
        document.body.classList.remove('zen-mode');
        campfireAudio.pause();
        clearInterval(sparkInterval);
        sparksContainer.innerHTML = ''; 
    }
}

zenBtn.addEventListener('click', toggleZenMode);
exitZenBtn.addEventListener('click', toggleZenMode);

searchInput.addEventListener('input', (e) => renderList(e.target.value));
newBtn.addEventListener('click', createNewEntry);
titleInput.addEventListener('input', triggerSave);
quill.on('text-change', triggerSave); 
exportBtn.addEventListener('click', exportData);
importFile.addEventListener('change', importData);

const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

function toggleMobileMenu() {
    playSound(clickSound);
    sidebar.classList.toggle('open');
    mobileOverlay.classList.toggle('open');
}

if (mobileMenuBtn && mobileOverlay) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    mobileOverlay.addEventListener('click', toggleMobileMenu);
}

const advScreen = document.getElementById('advancements-screen');
const closeAdvBtn = document.getElementById('close-adv-btn');

function toggleAdvancements() {
    playSound(clickSound);
    advScreen.classList.toggle('hidden');
}

closeAdvBtn.addEventListener('click', toggleAdvancements);
const advBtn = document.getElementById('adv-btn');
if(advBtn) advBtn.addEventListener('click', toggleAdvancements);

document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!target) return;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.classList && target.classList.contains('ql-editor'))) return;
    if (e.key === 'l' || e.key === 'L') toggleAdvancements();
});

// === NEW: Clickable Progress Tracker ===
document.querySelectorAll('.adv-node').forEach(node => {
    node.addEventListener('click', () => {
        playSound(clickSound);
        const progressDiv = node.querySelector('.adv-progress');
        const id = node.id;
        
        // Hide all other open progress bars first for cleanliness
        document.querySelectorAll('.adv-progress').forEach(p => p.classList.add('hidden'));
        
        // Show this specific progress bar
        progressDiv.classList.remove('hidden');
        
        // If it's already unlocked, just show "Completed"
        if (unlockedAdvs.includes(id)) {
            progressDiv.innerText = "Status: Completed!";
            return;
        }

        // Calculate progress based on the specific ID
        let streak = calculateCurrentStreak();
        let totalWordsAllBooks = 0;
        entries.forEach(e => {
            const textOnly = (e.content || "").replace(/<[^>]*>?/gm, '');
            totalWordsAllBooks += textOnly.trim().length > 0 ? textOnly.trim().split(/\s+/).length : 0;
        });

        if (id === 'adv-streak-3') progressDiv.innerText = `Progress: ${Math.min(streak, 3)} / 3 Days`;
        else if (id === 'adv-streak-7') progressDiv.innerText = `Progress: ${Math.min(streak, 7)} / 7 Days`;
        else if (id === 'adv-streak-30') progressDiv.innerText = `Progress: ${Math.min(streak, 30)} / 30 Days`;
        else if (id === 'adv-streak-64') progressDiv.innerText = `Progress: ${Math.min(streak, 64)} / 64 Days`;
        else if (id === 'adv-10k') progressDiv.innerText = `Progress: ${totalWordsAllBooks} / 10,000 Words`;
        else progressDiv.innerText = "Status: Locked. Keep playing to discover how to unlock!";
    });
});

init();