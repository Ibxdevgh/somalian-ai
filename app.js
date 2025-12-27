import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ CONFIG ============
// UPDATE THIS when you launch on pump.fun!
const TOKEN_MINT = null; // e.g., "YourTokenMintAddressHere"
const TOKEN_DECIMALS = 6;

// Pose files - add your GLBs here
// Total supply: 1B, Dev: 50M, Max tier: 5M
const POSES = {
    default: { file: 'hood_toly_1.glb', cost: 0, name: 'Default', icon: '🧍' },
    zesty: { file: 'toly_zesty.glb', cost: 50000, name: 'ZESTY', icon: '😏' },
    pump: { file: 'toly_up.glb', cost: 100000, name: 'PUMP THE SOL', icon: '📈' },
    dancing: { file: 'toly_dancing.glb', cost: 250000, name: 'J WALKING', icon: '🕺' },
    boxing: { file: 'toly_boxing.glb', cost: 500000, name: 'JAKE', icon: '🥊' },
    strong: { file: 'toly_strong.glb', cost: 1000000, name: 'ARNOLD', icon: '💪' },
    backflip: { file: 'toly_backflip.glb', cost: 5000000, name: 'SPEED', icon: '⚡' },
    naked: { file: null, cost: 50000000, name: 'NAKED', icon: '😳', forbidden: true },
};
// ================================

// Global state
let scene, camera, renderer, controls;
let avatar, mixer;
let clock = new THREE.Clock();
let currentPose = 'default';

// Wallet state
let walletConnected = false;
let walletAddress = null;
let tokenBalance = 0;

// Initialize the scene
function init() {
    const canvas = document.getElementById('avatar-canvas');

    // Scene
    scene = new THREE.Scene();
    
    // Camera - full screen
    camera = new THREE.PerspectiveCamera(
        30,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.4, 5);

    // Renderer - full screen
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true // Required for screenshots
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    // Green rim light from below
    const rimLight = new THREE.PointLight(0x00ff88, 0.8, 10);
    rimLight.position.set(0, 0, 2);
    scene.add(rimLight);

    // Purple accent light
    const accentLight = new THREE.PointLight(0x9945ff, 0.4, 10);
    accentLight.position.set(-3, 2, -2);
    scene.add(accentLight);

    // Ground plane with grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x00ff88, 0x1a1a1a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minAzimuthAngle = -Math.PI / 8;
    controls.maxAzimuthAngle = Math.PI / 8;
    controls.target.set(0, 1, 0);
    controls.update();

    // Load default avatar
    loadAvatar(POSES.default.file);

    // Handle resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

// Load the GLB avatar
function loadAvatar(filename, onComplete) {
    const loader = new GLTFLoader();
    
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">LOADING...</div>
    `;
    document.body.appendChild(loadingDiv);

    // Remove existing avatar
    if (avatar) {
        scene.remove(avatar);
        avatar = null;
        mixer = null;
    }

    loader.load(
        filename,
        (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(1, 1, 1);
            avatar.position.set(0, 0, 0);
            
            avatar.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            scene.add(avatar);

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(avatar);
                const idleAction = mixer.clipAction(gltf.animations[0]);
                idleAction.play();
            } else {
                addIdleAnimation();
            }

            loadingDiv.remove();
            if (onComplete) onComplete();
        },
        (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            loadingDiv.querySelector('.loading-text').textContent = 
                `LOADING... ${Math.round(percent)}%`;
        },
        (error) => {
            console.error('Error loading avatar:', error);
            loadingDiv.querySelector('.loading-text').textContent = 'LOAD FAILED';
            setTimeout(() => loadingDiv.remove(), 2000);
        }
    );
}

function addIdleAnimation() {
    if (!avatar) return;
    window.idleAnimation = () => {
        const time = clock.getElapsedTime();
        avatar.position.y = Math.sin(time * 1.5) * 0.015;
        avatar.rotation.y = Math.sin(time * 0.5) * 0.03;
    };
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    if (window.idleAnimation) window.idleAnimation();
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============ WALLET ============
async function connectWallet() {
    const walletBtn = document.getElementById('wallet-btn');
    
    try {
        // Check if Phantom is installed
        const provider = window.solana;
        if (!provider?.isPhantom) {
            window.open('https://phantom.app/', '_blank');
            return;
        }

        // Connect
        const response = await provider.connect();
        walletAddress = response.publicKey.toString();
        walletConnected = true;

        // Save to localStorage
        localStorage.setItem('hoodtoly_wallet', walletAddress);

        // Update UI
        const shortAddr = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
        walletBtn.querySelector('.wallet-text').textContent = shortAddr;
        walletBtn.classList.add('connected');

        // Fetch token balance
        await fetchTokenBalance();
        updatePosesUI();

        console.log('Wallet connected:', walletAddress);

    } catch (err) {
        console.error('Wallet connection failed:', err);
    }
}

async function fetchTokenBalance() {
    if (!walletAddress || !TOKEN_MINT) {
        tokenBalance = 0;
        updateBalanceDisplay();
        return;
    }

    try {
        // Fetch token accounts from Solana RPC
        const response = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenAccountsByOwner',
                params: [
                    walletAddress,
                    { mint: TOKEN_MINT },
                    { encoding: 'jsonParsed' }
                ]
            })
        });

        const data = await response.json();
        
        if (data.result?.value?.length > 0) {
            const amount = data.result.value[0].account.data.parsed.info.tokenAmount;
            tokenBalance = parseFloat(amount.uiAmount) || 0;
        } else {
            tokenBalance = 0;
        }
    } catch (err) {
        console.error('Failed to fetch token balance:', err);
        tokenBalance = 0;
    }

    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const balanceEl = document.getElementById('token-balance');
    if (balanceEl) {
        balanceEl.textContent = `${tokenBalance.toLocaleString()} $HOODTOLY`;
    }
}

// ============ POSES ============
function setupPoses() {
    const poseButtons = document.querySelectorAll('.pose-btn');
    
    poseButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const poseId = btn.dataset.pose;
            const cost = parseInt(btn.dataset.cost);
            const pose = POSES[poseId];
            const tolyMessage = document.getElementById('toly-message');
            
            // Check if it's the forbidden pose (NAKED)
            if (pose?.forbidden) {
                const funnyMessages = [
                    "nah bro you wildin, keep it PG 😭",
                    "ayo?? this a family friendly blockchain fam",
                    "you really thought... nah we don't do that here",
                    "50M tokens and you still can't see me naked, that's tough",
                    "bruh even with all the $HOODTOLY in the world... no",
                    "my lawyer said no",
                    "sir this is a blockchain"
                ];
                tolyMessage.textContent = funnyMessages[Math.floor(Math.random() * funnyMessages.length)];
                return;
            }
            
            // Check if unlocked
            if (cost > 0 && tokenBalance < cost) {
                tolyMessage.textContent = `you need ${cost.toLocaleString()} $HOODTOLY to unlock this pose fam`;
                return;
            }
            
            // Switch pose
            switchPose(poseId);
        });
    });
}

function switchPose(poseId) {
    if (currentPose === poseId) return;
    if (!POSES[poseId]) return;

    currentPose = poseId;
    
    // Update UI
    document.querySelectorAll('.pose-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.pose === poseId) {
            btn.classList.add('active');
        }
    });

    // Load new model
    loadAvatar(POSES[poseId].file);
}

function updatePosesUI() {
    document.querySelectorAll('.pose-btn').forEach(btn => {
        const poseId = btn.dataset.pose;
        const cost = parseInt(btn.dataset.cost);
        const pose = POSES[poseId];
        
        if (cost === 0 || tokenBalance >= cost) {
            btn.classList.remove('locked');
            btn.querySelector('.pose-icon').textContent = pose?.icon || '🧍';
        } else {
            btn.classList.add('locked');
            btn.querySelector('.pose-icon').textContent = '🔒';
        }
    });
}

// ============ CHAT ============
const sessionId = 'session_' + Math.random().toString(36).substr(2, 9);

function setupChat() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const speechBubble = document.getElementById('speech-bubble');
    const tolyMessage = document.getElementById('toly-message');
    let isLoading = false;

    const sendMessage = async () => {
        const message = input.value.trim();
        if (!message || isLoading) return;

        isLoading = true;
        sendBtn.disabled = true;
        sendBtn.textContent = '...';
        input.value = '';

        // Show thinking state
        tolyMessage.textContent = 'hmm let me think...';
        speechBubble.classList.add('thinking');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId })
            });
            
            const data = await response.json();
            const reply = data.error ? "yo something broke, try again fam" : data.response;
            
            tolyMessage.textContent = reply;
            speechBubble.classList.remove('thinking');

        } catch (error) {
            tolyMessage.textContent = "my bad fam the connection dropped, run it back";
            speechBubble.classList.remove('thinking');
        }

        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'SEND';
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ============ AUDIO ============
function setupAudio() {
    const audioBtn = document.getElementById('audio-toggle');
    const music = document.getElementById('bg-music');
    let audioEnabled = true;
    
    music.volume = 0.25;
    
    const startMusic = () => {
        if (audioEnabled) {
            music.play().catch(() => {});
        }
        document.removeEventListener('click', startMusic);
        document.removeEventListener('keypress', startMusic);
    };
    
    music.play().catch(() => {
        document.addEventListener('click', startMusic);
        document.addEventListener('keypress', startMusic);
    });
    
    audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audioEnabled = !audioEnabled;
        audioBtn.querySelector('span').textContent = audioEnabled ? '🔊' : '🔇';
        if (audioEnabled) {
            music.play();
        } else {
            music.pause();
        }
    });
}

// ============ WALLET BUTTON ============
function setupWalletButton() {
    const walletBtn = document.getElementById('wallet-btn');
    
    walletBtn.addEventListener('click', () => {
        if (walletConnected) {
            // Disconnect wallet
            disconnectWallet();
        } else {
            // Connect wallet
            connectWallet();
        }
    });

    // Check if we have a saved wallet address
    const savedWallet = localStorage.getItem('hoodtoly_wallet');
    
    if (savedWallet && window.solana?.isPhantom) {
        // Try to reconnect to the saved wallet
        window.solana.connect({ onlyIfTrusted: true })
            .then(response => {
                const connectedAddr = response.publicKey.toString();
                // Verify it's the same wallet
                if (connectedAddr === savedWallet) {
                    walletAddress = connectedAddr;
                    walletConnected = true;
                    const shortAddr = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
                    walletBtn.querySelector('.wallet-text').textContent = shortAddr;
                    walletBtn.classList.add('connected');
                    fetchTokenBalance().then(updatePosesUI);
                    console.log('Reconnected to saved wallet:', shortAddr);
                } else {
                    // Different wallet, clear saved
                    localStorage.removeItem('hoodtoly_wallet');
                }
            })
            .catch(() => {
                // Can't auto-connect, but we remember the wallet
                // Show as "click to reconnect"
                console.log('Saved wallet found but needs manual reconnect');
            });
    }
}

async function disconnectWallet() {
    const walletBtn = document.getElementById('wallet-btn');
    
    try {
        // Disconnect from Phantom
        if (window.solana?.isPhantom) {
            await window.solana.disconnect();
        }
    } catch (err) {
        console.error('Disconnect error:', err);
    }
    
    // Clear from localStorage
    localStorage.removeItem('hoodtoly_wallet');
    
    // Reset state
    walletConnected = false;
    walletAddress = null;
    tokenBalance = 0;
    
    // Reset UI
    walletBtn.querySelector('.wallet-text').textContent = 'CONNECT';
    walletBtn.classList.remove('connected');
    updateBalanceDisplay();
    updatePosesUI();
    
    // Reset to default pose
    if (currentPose !== 'default') {
        switchPose('default');
    }
    
    console.log('Wallet disconnected');
}

// ============ SHARE ============
function setupShare() {
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const shareClose = document.getElementById('share-close');
    const shareTwitter = document.getElementById('share-twitter');
    const shareDownload = document.getElementById('share-download');
    const shareCanvas = document.getElementById('share-canvas');
    const bgOptions = document.querySelectorAll('.bg-option');
    
    let capturedImage = null;
    let selectedBg = 'gta';

    // Background selector
    bgOptions.forEach(btn => {
        btn.addEventListener('click', () => {
            bgOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedBg = btn.dataset.bg;
            captureScene();
        });
    });

    // Open modal and capture
    shareBtn.addEventListener('click', () => {
        captureScene();
        shareModal.classList.add('active');
    });

    // Close modal
    shareClose.addEventListener('click', () => {
        shareModal.classList.remove('active');
    });

    shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) {
            shareModal.classList.remove('active');
        }
    });

    // Capture the 3D scene
    function captureScene() {
        // Force a render
        renderer.render(scene, camera);
        
        // Get the 3D canvas
        const avatarCanvas = document.getElementById('avatar-canvas');
        
        // Create a new canvas for the share image
        const ctx = shareCanvas.getContext('2d');
        const width = 600;
        const height = 750;
        shareCanvas.width = width;
        shareCanvas.height = height;

        // Draw background based on selection
        drawBackground(ctx, width, height, selectedBg);

        // Draw the 3D avatar - full view, no cropping
        const aspectRatio = avatarCanvas.width / avatarCanvas.height;
        const destHeight = height - 150;
        const destWidth = destHeight * aspectRatio;
        const destX = (width - destWidth) / 2;
        const destY = 0;
        
        ctx.drawImage(avatarCanvas, destX, destY, destWidth, destHeight);

        // Bottom bar with branding
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, height - 120, width, 120);

        // Add branding
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 44px "Permanent Marker", cursive';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.fillText('HOOD TOLY', width / 2, height - 60);
        ctx.shadowBlur = 0;

        // Add subtitle
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Space Mono", monospace';
        ctx.fillText('@HOODTOLY  •  $HOODTOLY', width / 2, height - 25);

        // Current pose name
        const pose = POSES[currentPose];
        if (pose && currentPose !== 'default') {
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 11px "Space Mono", monospace';
            ctx.fillText(`✦ ${pose.name} ✦`, width / 2, height - 8);
        }

        // Store as data URL
        capturedImage = shareCanvas.toDataURL('image/png');
    }

    // Draw different backgrounds
    function drawBackground(ctx, width, height, bgType) {
        switch(bgType) {
            case 'gta':
                drawGTABackground(ctx, width, height);
                break;
            case 'night':
                drawNightBackground(ctx, width, height);
                break;
            case 'miami':
                drawMiamiBackground(ctx, width, height);
                break;
            case 'gold':
                drawGoldBackground(ctx, width, height);
                break;
            default:
                drawGTABackground(ctx, width, height);
        }
    }

    // GTA San Andreas sunset
    function drawGTABackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#1a0a2e');
        gradient.addColorStop(0.25, '#4a1942');
        gradient.addColorStop(0.5, '#c94b4b');
        gradient.addColorStop(0.75, '#f4a460');
        gradient.addColorStop(1, '#ffb347');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Sun
        const sunGradient = ctx.createRadialGradient(width/2, height*0.5, 0, width/2, height*0.5, 100);
        sunGradient.addColorStop(0, 'rgba(255, 247, 220, 0.8)');
        sunGradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.4)');
        sunGradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
        ctx.fillStyle = sunGradient;
        ctx.fillRect(0, 0, width, height);

        // Palm trees
        ctx.fillStyle = '#1a0a1a';
        drawPalmTree(ctx, 30, height * 0.7, 0.6);
        drawPalmTree(ctx, width - 50, height * 0.65, 0.8);
    }

    // Night city
    function drawNightBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.5, '#1a1a3a');
        gradient.addColorStop(1, '#0f0f2f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * (height * 0.6);
            const size = Math.random() * 2;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // City silhouette
        ctx.fillStyle = '#0a0a15';
        for (let i = 0; i < 15; i++) {
            const x = i * 45;
            const h = 80 + Math.random() * 150;
            const w = 30 + Math.random() * 20;
            ctx.fillRect(x, height - 120 - h, w, h);
            
            // Windows
            ctx.fillStyle = 'rgba(255, 200, 50, 0.6)';
            for (let j = 0; j < 5; j++) {
                for (let k = 0; k < 3; k++) {
                    if (Math.random() > 0.3) {
                        ctx.fillRect(x + 5 + k * 8, height - 140 - h + 20 + j * 25, 5, 8);
                    }
                }
            }
            ctx.fillStyle = '#0a0a15';
        }

        // Neon glow
        const neonGradient = ctx.createRadialGradient(width/2, height, 0, width/2, height, 300);
        neonGradient.addColorStop(0, 'rgba(255, 0, 100, 0.2)');
        neonGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = neonGradient;
        ctx.fillRect(0, 0, width, height);
    }

    // Miami Vice
    function drawMiamiBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#ff6b9d');
        gradient.addColorStop(0.3, '#c44569');
        gradient.addColorStop(0.6, '#6a0572');
        gradient.addColorStop(1, '#0f0c29');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Sun
        ctx.fillStyle = '#ff9a56';
        ctx.beginPath();
        ctx.arc(width/2, height * 0.55, 80, 0, Math.PI * 2);
        ctx.fill();

        // Sun stripes
        ctx.fillStyle = '#c44569';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(width/2 - 80, height * 0.5 + i * 20, 160, 6);
        }

        // Grid floor
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(0, height * 0.75 + i * 15);
            ctx.lineTo(width, height * 0.75 + i * 15);
            ctx.stroke();
        }

        // Palm silhouettes
        ctx.fillStyle = '#1a0a2a';
        drawPalmTree(ctx, 50, height * 0.75, 0.7);
        drawPalmTree(ctx, width - 70, height * 0.72, 0.9);
    }

    // Gold/Bling
    function drawGoldBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#1a1a1a');
        gradient.addColorStop(0.5, '#2a2a2a');
        gradient.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Gold rays
        ctx.save();
        ctx.translate(width/2, height/2);
        for (let i = 0; i < 12; i++) {
            ctx.rotate(Math.PI / 6);
            const rayGradient = ctx.createLinearGradient(0, 0, 0, -height);
            rayGradient.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            rayGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = rayGradient;
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(0, -height);
            ctx.lineTo(30, 0);
            ctx.fill();
        }
        ctx.restore();

        // Sparkles
        ctx.fillStyle = '#ffd700';
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 4 + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Helper function to draw palm tree silhouette
    function drawPalmTree(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        
        // Trunk
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-5, -120);
        ctx.lineTo(5, -120);
        ctx.lineTo(8, 0);
        ctx.fill();
        
        // Leaves
        const leaves = [
            { angle: -60, length: 80 },
            { angle: -30, length: 90 },
            { angle: 0, length: 70 },
            { angle: 30, length: 90 },
            { angle: 60, length: 80 },
            { angle: -80, length: 60 },
            { angle: 80, length: 60 },
        ];
        
        leaves.forEach(leaf => {
            ctx.save();
            ctx.translate(0, -120);
            ctx.rotate(leaf.angle * Math.PI / 180);
            ctx.beginPath();
            ctx.ellipse(0, -leaf.length/2, 8, leaf.length/2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        
        ctx.restore();
    }

    // Share to Twitter/X
    shareTwitter.addEventListener('click', async () => {
        // First copy image to clipboard
        try {
            const blob = await new Promise(resolve => {
                shareCanvas.toBlob(resolve, 'image/png');
            });
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            
            // Show feedback
            shareTwitter.innerHTML = '<span>✓</span> IMAGE COPIED!';
            
            // Open Twitter after short delay
            setTimeout(() => {
                const text = `check out my Hood Toly! 🔥\n\n$HOODTOLY @hoodtoly`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                window.open(twitterUrl, '_blank');
                
                // Reset button
                shareTwitter.innerHTML = '<span>𝕏</span> POST TO X';
            }, 800);
            
        } catch (err) {
            // Fallback - just open Twitter
            const text = `check out my Hood Toly! 🔥\n\n$HOODTOLY @hoodtoly`;
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(twitterUrl, '_blank');
        }
    });

    // Download image
    shareDownload.addEventListener('click', () => {
        if (!capturedImage) return;
        
        const link = document.createElement('a');
        link.download = `hood-toly-${currentPose}.png`;
        link.href = capturedImage;
        link.click();
    });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupChat();
    setupAudio();
    setupPoses();
    setupWalletButton();
    setupShare();
});
