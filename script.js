// DOM Elements
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

// === Custom Toolbar Icons (Enchantment) ===
const icons = Quill.import('ui/icons');
icons['code'] = '<span style="font-family: SGA; font-size: 1.2rem;">E</span>';

// Initialize Quill Rich Text Editor
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

// State
let entries = JSON.parse(localStorage.getItem('mcJournals')) || [];
let currentId = null;
let saveTimeout;

// Audio System 
const clickSound = new Audio('sounds/click.mp3');
const pageSound = new Audio('sounds/page.mp3');
const levelUpSound = new Audio('sounds/levelup.mp3');

function playSound(sound) {
    sound.currentTime = 0; 
    sound.play().catch(e => console.log("Sound skipped"));
}

// Boot up
function init() {
    renderList();
    if (entries.length > 0) {
        loadEntry(entries[0].id);
    } else {
        createNewEntry();
    }
}

// Render the sidebar list with Search & Delete X
function renderList(searchTerm = "") {
    listEl.innerHTML = '';
    
    const filteredEntries = entries.filter(e => {
        const title = (e.title || "Untitled Book").toLowerCase();
        return title.includes(searchTerm.toLowerCase());
    });

    filteredEntries.sort((a, b) => b.date - a.date).forEach(entry => {
        const li = document.createElement('li');
        li.className = `entry-item ${entry.id === currentId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'entry-text';
        titleSpan.textContent = entry.title || "Untitled Book";
        
        const deleteSpan = document.createElement('span');
        deleteSpan.className = 'delete-x';
        deleteSpan.title = 'Drop Book';
        deleteSpan.textContent = 'X';
        
        deleteSpan.onclick = (e) => {
            e.stopPropagation(); 
            playSound(clickSound);
            if (confirm("Are you sure you want to drop this book into the lava? This cannot be undone!")) {
                entries = entries.filter(e => e.id !== entry.id);
                localStorage.setItem('mcJournals', JSON.stringify(entries));
                
                if (currentId === entry.id) {
                    searchInput.value = ''; 
                    if (entries.length > 0) {
                        loadEntry(entries[0].id);
                    } else {
                        createNewEntry();
                    }
                } else {
                    renderList(searchInput.value); 
                }
            }
        };

        li.onclick = () => {
            playSound(clickSound);
            loadEntry(entry.id);
            // NEW: Close the mobile menu if it's currently open
            if (sidebar.classList.contains('open')) {
                toggleMobileMenu();
            }
        };
        
        li.appendChild(titleSpan);
        li.appendChild(deleteSpan);
        listEl.appendChild(li);
    });
}

function triggerAnimation() {
    bookGui.classList.remove('book-animate');
    void bookGui.offsetWidth;
    bookGui.classList.add('book-animate');
}

// Load an entry
function loadEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (entry) {
        if (currentId !== id) {
            triggerAnimation();
            playSound(pageSound);
        }
        currentId = id;
        titleInput.value = entry.title;
        quill.root.innerHTML = entry.content; 
        saveStatus.innerText = "Loaded";
        applyDimension(entry.dimension || 'overworld');
        renderList(searchInput.value);
    }
}

// Create a new entry
function createNewEntry() {
    playSound(pageSound);
    const newEntry = {
        id: Date.now().toString(),
        title: "",
        content: "",
        date: Date.now(),
        dimension: "overworld"
    };
    entries.push(newEntry);
    loadEntry(newEntry.id);
    titleInput.focus();
}

// Auto-save function & XP Bar Calculator
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
            checkStreak(); 
        }

        const text = quill.getText().trim(); 
        const wordCount = text.length > 0 ? text.split(/\s+/).length : 0;
        
        xpLevel.innerText = wordCount; 
        const progress = (wordCount % 50) / 50 * 100; 
        xpFill.style.width = `${progress}%`;

    }, 500);
}

// === Export / Import ===
function exportData() {
    playSound(clickSound);
    const dataStr = JSON.stringify(entries);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `mc_journal_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
            } else {
                alert("Invalid backup file format.");
            }
        } catch (error) {
            alert("Error reading backup file.");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// Check Streak Advancement
function checkStreak() {
    if (entries.length === 0) return;

    const daysWritten = [...new Set(entries.map(e => {
        const d = new Date(e.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }))];

    daysWritten.sort((a, b) => new Date(b) - new Date(a)); 

    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0,0,0,0);

    for (let i = 0; i < daysWritten.length; i++) {
        const writeDate = new Date(daysWritten[i]);
        if (writeDate.getTime() === checkDate.getTime()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1); 
        } else if (i === 0 && Math.abs(new Date() - writeDate) < 172800000) {
            checkDate.setDate(checkDate.getDate() - 1);
            i--; 
        } else {
            break; 
        }
    }

    const milestones = [3, 7, 14, 30, 64, 100]; 
    if (milestones.includes(streak) && new Date(daysWritten[0]).getDate() === new Date().getDate()) {
        const lastMilestone = localStorage.getItem('lastMilestone');
        if (lastMilestone !== streak.toString()) {
            showAdvancement(`Consistent Crafter: ${streak} Day Streak!`);
            localStorage.setItem('lastMilestone', streak.toString());
        }
    }
}

function showAdvancement(message) {
    const toast = document.getElementById('advancement-toast');
    const desc = document.getElementById('toast-desc');
    desc.innerText = message;
    playSound(levelUpSound);
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 6000);
}

// === Dimension & Weather Logic ===
const dimBtns = document.querySelectorAll('.dim-btn');
const zenBtn = document.getElementById('zen-btn');
let isZenMode = false;

dimBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        playSound(clickSound);
        const selectedDim = e.target.closest('.dim-btn').dataset.dim;
        const entryIndex = entries.findIndex(e => e.id === currentId);
        if (entryIndex !== -1) {
            entries[entryIndex].dimension = selectedDim;
            triggerSave();
        }
        applyDimension(selectedDim);
    });
});

// === Dimension & Dynamic Weather Logic ===
let weatherTimer; // NEW: A variable to hold our weather clock

function applyDimension(dim) {
    dimBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-dim="${dim}"]`).classList.add('active');
    
    document.body.className = ''; 
    document.body.classList.remove('weather-rain', 'weather-snow');
    if (rainAudio) rainAudio.pause(); 
    
    // Stop the weather clock if we change dimensions
    clearInterval(weatherTimer); 
    
    if (dim !== 'overworld') {
        document.body.classList.add(`theme-${dim}`);
    } else if (!isZenMode) {
        // Roll the weather immediately, then check again every 3 minutes
        rollWeather(); 
        weatherTimer = setInterval(rollWeather, 180000); // 180,000ms = 3 minutes
    }
    
    if (isZenMode) document.body.classList.add('zen-mode');
    
    if (typeof updateMusicDimension === 'function') {
        updateMusicDimension(dim);
    }
}

// NEW: The function that actually changes the weather
function rollWeather() {
    // Clear out the old weather first
    document.body.classList.remove('weather-rain', 'weather-snow');
    
    const chance = Math.random(); 
    if (chance < 0.25) { 
        // 25% Chance of Rain
        document.body.classList.add('weather-rain');
        if (isMusicPlaying) rainAudio.play().catch(e => console.log("Rain blocked"));
    } 
    else if (chance < 0.50) { 
        // 25% Chance of Snow
        document.body.classList.add('weather-snow');
        if (rainAudio) rainAudio.pause(); // Snow is quiet!
    } else {
        // 50% Chance of Sunny/Clear
        if (rainAudio) rainAudio.pause();
    }
}

// === Jukebox & Music Logic ===
const playPauseBtn = document.getElementById('play-pause-btn');
const volumeSlider = document.getElementById('volume-slider');
const nowPlayingText = document.getElementById('now-playing');

const musicTracks = {
    overworld: new Audio('sounds/music-ow.mp3'),
    nether: new Audio('sounds/music-nt.mp3'),
    end: new Audio('sounds/music-en.mp3')
};
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

// === YouTube API Setup (For Campfire Mode) ===
let ytPlayer;
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '1', 
        width: '1',
        videoId: 'FqnAV6tkwzA', 
        playerVars: {
            'autoplay': 0, 'controls': 0, 'loop': 1, 'playlist': 'FqnAV6tkwzA' 
        }
    });
}

// === NEW: Campfire (Zen) Logic & Spark Generator ===
const exitZenBtn = document.getElementById('exit-zen-btn');
const sparksContainer = document.getElementById('sparks-container');

// Load your 30-minute campfire audio
const campfireAudio = new Audio('sounds/campfire.mp3');
campfireAudio.loop = true;

let sparkInterval;

function createSpark() {
    const spark = document.createElement('div');
    spark.classList.add('spark');
    
    // Randomize where the spark starts horizontally
    spark.style.left = Math.random() * 100 + 'vw';
    
    // Randomize how fast it floats up (between 2 and 6 seconds)
    const duration = Math.random() * 4 + 2; 
    spark.style.animationDuration = duration + 's';
    
    // Randomize how much it drifts to the left or right as it rises
    spark.style.setProperty('--drift', (Math.random() * 200 - 100) + 'px');
    
    sparksContainer.appendChild(spark);
    
    // Remove the spark from the code once it floats off screen
    setTimeout(() => {
        spark.remove();
    }, duration * 1000);
}

function toggleZenMode() {
    isZenMode = !isZenMode;
    playSound(clickSound);
    
    if (isZenMode) {
        document.body.classList.add('zen-mode');
        campfireAudio.play().catch(e => console.log("Campfire audio blocked"));
        
        // Start generating sparks every 150 milliseconds
        sparkInterval = setInterval(createSpark, 150);
    } else {
        document.body.classList.remove('zen-mode');
        campfireAudio.pause();
        
        // Stop generating sparks and clear the screen
        clearInterval(sparkInterval);
        sparksContainer.innerHTML = ''; 
    }
}

// Attach the toggle to both buttons
zenBtn.addEventListener('click', toggleZenMode);
exitZenBtn.addEventListener('click', toggleZenMode);

// Event Listeners
searchInput.addEventListener('input', (e) => renderList(e.target.value));
newBtn.addEventListener('click', createNewEntry);
titleInput.addEventListener('input', triggerSave);
quill.on('text-change', triggerSave); 
exportBtn.addEventListener('click', exportData);
importFile.addEventListener('change', importData);

// === NEW: Mobile Menu Logic ===
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

// Start the app
init();