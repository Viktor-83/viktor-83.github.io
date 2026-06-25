// main.js

// --- VARIABLES GLOBALES ---
// État de l'interface et du chemin actuel
let currentTheme = 'light';
let currentFloorFilter = 0; 
let pathLine = null;
let arrowGroup = new THREE.Group(); 
let activePathCurve = null; 

// Optimisation : on limite le calcul de visibilité des étiquettes à toutes les 200ms
let lastOcclusionCheck = 0;
const OCCLUSION_INTERVAL = 200; 

// Paramètres de la caméra (pour le décalage quand le menu est ouvert)
let targetViewOffset = 0;   
let currentViewOffset = 0;  
const MENU_OFFSET_VALUE = 170;

// Outils Three.js (Raycaster pour la souris, etc.)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredRoom = null; 
let activeStartRoom = null;
let activeEndRoom = null;

// Matériau semi-transparent pour les salles non actives (Mode Ghost)
const ghostMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false 
});

// Setup Scène de base
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const worldGroup = new THREE.Group();
let controls; 

// Fonction pour mettre à jour le décalage caméra depuis l'HTML
window.updateCameraOffset = function(isMenuOpen) {
    targetViewOffset = isMenuOpen ? MENU_OFFSET_VALUE : 0;
};

// --- INITIALISATION THREE.JS ---
// Configure le rendu, la lumière et la caméra
function setupThreeJs() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById("canvas-container").appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;

    scene.background = new THREE.Color(0xf0f0f0); 

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 30, 20);
    scene.add(dirLight);

    scene.add(worldGroup);
    scene.add(arrowGroup);

    window.addEventListener('mousemove', onMouseMove, false);
    
    // Initialisation avec le menu ouvert
    targetViewOffset = MENU_OFFSET_VALUE; 
    currentViewOffset = MENU_OFFSET_VALUE;
    camera.setViewOffset(window.innerWidth, window.innerHeight, currentViewOffset, 0, window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// --- CONSTRUCTION 3D ---
// Dessine les sols (Corridors)
function renderCorridors() {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.white });

    corridorSystem.definitions.forEach((c) => {
        if (c.type === 'stairs') return; 

        const geo = new THREE.PlaneGeometry(c.w * TILE_SIZE, c.h * TILE_SIZE);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        
        const yPos = (c.level * FLOOR_HEIGHT) + 0.02; 
        mesh.position.set(
            c.x * TILE_SIZE + (c.w * TILE_SIZE) / 2 - 0.5,
            yPos,
            c.y * TILE_SIZE + (c.h * TILE_SIZE) / 2 - 0.5
        );
        mesh.name = `Corridor_L${c.level}_X${c.x}_Y${c.y}`;
        worldGroup.add(mesh);
    });
}

// Dessine toute la géométrie (Sols noirs, Grilles, Salles)
function renderGeometry() {
    const planeGeo = new THREE.PlaneGeometry(GRID_W * TILE_SIZE, GRID_H * TILE_SIZE);
    
    // Création des plans de sol sombres
    const matBase0 = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide });
    const plane0 = new THREE.Mesh(planeGeo, matBase0);
    plane0.rotation.x = -Math.PI / 2;
    plane0.position.set((GRID_W * TILE_SIZE) / 2 - 0.5, 0, (GRID_H * TILE_SIZE) / 2 - 0.5);
    plane0.name = 'Plane0';
    worldGroup.add(plane0);

    const matBase1 = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide, transparent: true, opacity: 0.1 });
    const plane1 = new THREE.Mesh(planeGeo, matBase1);
    plane1.rotation.x = -Math.PI / 2;
    plane1.position.set((GRID_W * TILE_SIZE) / 2 - 0.5, FLOOR_HEIGHT, (GRID_H * TILE_SIZE) / 2 - 0.5);
    plane1.name = 'Plane1';
    worldGroup.add(plane1);

    // Ajout des grilles (lignes)
    const gridHelper0 = new THREE.GridHelper(GRID_W * TILE_SIZE, GRID_W, 0x444444, 0x222222);
    gridHelper0.position.set((GRID_W * TILE_SIZE) / 2 - 0.5, 0.05, (GRID_H * TILE_SIZE) / 2 - 0.5);
    gridHelper0.name = 'GridHelper0';
    scene.add(gridHelper0);

    const gridHelper1 = new THREE.GridHelper(GRID_W * TILE_SIZE, GRID_W, 0x555555, 0x222222);
    gridHelper1.position.set((GRID_W * TILE_SIZE) / 2 - 0.5, FLOOR_HEIGHT + 0.05, (GRID_H * TILE_SIZE) / 2 - 0.5);
    gridHelper1.name = 'GridHelper1';
    scene.add(gridHelper1);

    renderCorridors();

    // Création des objets Salles/Portes/Escaliers
    roomDefinitions.forEach((r) => {
        if (r.isDoor) return; // Les portes sont gérées spécifiquement ci-dessous

        r.originalMaterial = new THREE.MeshLambertMaterial({ color: r.color });

        let xCenter = r.x * TILE_SIZE + (r.w * TILE_SIZE) / 2 - 0.5;
        let yCenter = r.y * TILE_SIZE + (r.h * TILE_SIZE) / 2 - 0.5;
        const yBase = r.level * FLOOR_HEIGHT;
        let height = r.isWall ? 1 : 1.5; 

        // Géométrie de base (Cube)
        let geometry = new THREE.BoxGeometry(r.w * TILE_SIZE, height, r.h * TILE_SIZE);

        // Si c'est une porte, on l'aplatit selon son axe pour faire un panneau fin
        if (r.isDoor) {
            const thickness = 0.1;
            if (r.axis === 'z') {
                geometry = new THREE.BoxGeometry(thickness, height, r.h * TILE_SIZE);
            } else {
                geometry = new THREE.BoxGeometry(r.w * TILE_SIZE, height, thickness);
            }
        }

        const mesh = new THREE.Mesh(geometry, r.originalMaterial);
        mesh.position.set(xCenter, yBase + height / 2, yCenter); 
        
        // Ajout des bordures noires
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1, opacity: 0.3, transparent: true }));
        mesh.add(line);
        worldGroup.add(mesh);

        r.centerPos = mesh.position.clone();
        r.centerPos.y += 1.0;
        
        r.mesh = mesh; 
        r.mesh.userData = { room: r }; 
        r._isOccluded = false; 

        updateObjectVisibility(mesh, r.level);
    });
    
    camera.position.set(GRID_W / 2, 25, GRID_H + 15);
    if (controls) {
        controls.target.set(GRID_W / 2, FLOOR_HEIGHT/2, GRID_H / 2);
        controls.update();
    }
}

// --- GESTION DE L'INTERFACE ET VISIBILITÉ ---
function updateObjectVisibility(mesh, level) {
    if (currentFloorFilter === 2) {
        mesh.visible = true; // Tous
    } else {
        mesh.visible = (level === currentFloorFilter);
    }
}

function updateFloorPlanesVisibility() {
    // Affiche/Masque les sols selon l'étage sélectionné
    const plane0 = worldGroup.getObjectByName('Plane0');
    const plane1 = worldGroup.getObjectByName('Plane1');
    const gridHelper0 = scene.getObjectByName('GridHelper0');
    const gridHelper1 = scene.getObjectByName('GridHelper1');

    if (plane0) plane0.visible = (currentFloorFilter === 0 || currentFloorFilter === 2);
    if (plane1) plane1.visible = (currentFloorFilter === 1 || currentFloorFilter === 2);
    if (gridHelper0) gridHelper0.visible = (currentFloorFilter === 0 || currentFloorFilter === 2);
    if (gridHelper1) gridHelper1.visible = (currentFloorFilter === 1 || currentFloorFilter === 2);
    
    worldGroup.children.forEach(child => {
        if (child.name.startsWith('Corridor_L0')) {
            child.visible = (currentFloorFilter === 0 || currentFloorFilter === 2);
        } else if (child.name.startsWith('Corridor_L1')) {
            child.visible = (currentFloorFilter === 1 || currentFloorFilter === 2);
        }
    });
}

window.setFloorVisibility = function(level) {
    currentFloorFilter = parseInt(level, 10);
    
    // Met à jour la transparence des salles (Ghost Mode)
    if (pathLine) {
        updateNavigationVisibility(activeStartRoom, activeEndRoom, null); 
    } else {
        roomDefinitions.forEach(r => {
            if(r.mesh) {
                r.mesh.material = r.originalMaterial;
                updateObjectVisibility(r.mesh, r.level);
            }
        });
    }

    if (!pathLine) arrowGroup.clear();
    updateFloorPlanesVisibility();
    
    // Centre la caméra sur l'étage actif
    if (controls) {
        if (currentFloorFilter === 0) controls.target.set(GRID_W / 2, 2, GRID_H / 2);
        else if (currentFloorFilter === 1) controls.target.set(GRID_W / 2, FLOOR_HEIGHT + 2, GRID_H / 2);
        else controls.target.set(GRID_W / 2, FLOOR_HEIGHT / 2, GRID_H / 2);
        controls.update();
    }
    filterList('start');
    filterList('end');
}

// --- LOGIQUE DES LISTES DÉROULANTES ---
// Gère l'affichage, le filtrage et la sélection dans les menus HTML
window.toggleDropdown = function(type, forceClose = false) {
    const listContainer = document.getElementById(type + '-list-container');
    const filterInput = document.getElementById(type + '-filter-input');
    
    if (forceClose) {
        listContainer.classList.add('hidden');
        if (filterInput) filterInput.value = '';
        populateList(type);
        return;
    }

    const otherType = type === 'start' ? 'end' : 'start';
    const otherList = document.getElementById(otherType + '-list-container');
    if (otherList && !otherList.classList.contains('hidden')) toggleDropdown(otherType, true);

    listContainer.classList.toggle('hidden');
    if (!listContainer.classList.contains('hidden') && filterInput) {
        filterInput.focus();
        populateList(type); 
    }
}

function populateList(type, filterText = '') {
    const ul = document.getElementById(type + '-list');
    if (!ul) return;
    ul.innerHTML = '';
    const lowerFilter = filterText.toLowerCase();
    
    navPoints.forEach((r, idx) => {
        const floorMatch = (currentFloorFilter === 2 || r.level === currentFloorFilter);
        const etageLabel = r.level === 0 ? " (RDC)" : " (1er)";
        const fullLabel = r.name + etageLabel;
        
        if (fullLabel.toLowerCase().includes(lowerFilter) && floorMatch) {
            const li = document.createElement('li');
            li.textContent = fullLabel;
            li.dataset.index = idx;
            li.addEventListener('click', (e) => {
                e.stopPropagation(); 
                selectRoom(type, idx, fullLabel);
            }); 
            ul.appendChild(li);
        }
    });
}

function filterList(type) {
    const filterInput = document.getElementById(type + '-filter-input');
    populateList(type, filterInput ? filterInput.value : '');
}

function selectRoom(type, index) {
    const hiddenInput = document.getElementById(type + 'Point'); 
    if (hiddenInput) hiddenInput.value = index;
    updateDisplayedSelection(type, index);
    toggleDropdown(type, true);
}

function updateDisplayedSelection(type, index) {
    const displayInput = document.getElementById(type + '-search-display');
    const room = navPoints[index];
    if (displayInput && room) {
        const etageLabel = room.level === 0 ? " (RDC)" : " (1er)";
        displayInput.value = room.name + etageLabel;
    }
}

function setupCustomSelects() {
    // Initialise les événements des listes
    document.getElementById('start-filter-input').addEventListener('input', () => filterList('start'));
    document.getElementById('end-filter-input').addEventListener('input', () => filterList('end'));

    document.addEventListener('click', (event) => {
        const cS = document.getElementById('start-dropdown-container');
        const cE = document.getElementById('end-dropdown-container');
        if (cS && !cS.contains(event.target)) toggleDropdown('start', true);
        if (cE && !cE.contains(event.target)) toggleDropdown('end', true);
    });

    populateList('start');
    populateList('end');

    // Reset forcé des valeurs au chargement
    const startInput = document.getElementById('startPoint');
    const endInput = document.getElementById('endPoint');
    if (startInput) startInput.value = 0;
    if (endInput) endInput.value = 1;
    updateDisplayedSelection('start', 0);
    updateDisplayedSelection('end', 1);

    const radioRDC = document.querySelector('input[name="floor_filter"][value="0"]');
    if (radioRDC) radioRDC.checked = true;
    setFloorVisibility(0);
}

// --- ALGORITHME DE NAVIGATION (A*) ---
function findDoorForRoom(room) {
    // Trouve la porte associée à une salle (même niveau, adjacente)
    const candidates = roomDefinitions.filter(d => {
        if (!d.isDoor || d.level !== room.level) return false;
        const isCloseX = (d.x >= room.x - 1) && (d.x <= room.x + room.w);
        const isCloseY = (d.y >= room.y - 1) && (d.y <= room.y + room.h);
        return isCloseX && isCloseY;
    });
    if (candidates.length === 0) return null;
    return { x: candidates[0].x, y: candidates[0].y, z: candidates[0].level };
}

function findPath(startRoom, endRoom) {
    // Helper : trouve une case vide si la porte n'est pas trouvée
    function getNearest(gx, gy, gz) {
        for (let r = 0; r < 5; r++) { 
            for (let i = -r; i <= r; i++) {
                for (let j = -r; j <= r; j++) {
                    let nx = gx + i, ny = gy + j;
                    if (gz >= 0 && gz < GRID_LEVELS && nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
                        if(grids[gz][ny][nx] > 0) return { x: nx, y: ny, z: gz };
                    }
                }
            }
        }
        return null;
    }

    let startNode = findDoorForRoom(startRoom);
    let endNode = findDoorForRoom(endRoom);

    if (!startNode) startNode = getNearest(Math.floor(startRoom.x), Math.floor(startRoom.y), startRoom.level);
    if (!endNode) endNode = getNearest(Math.floor(endRoom.x), Math.floor(endRoom.y), endRoom.level);
    if (!startNode || !endNode) return null;

    const isSameFloorTrip = (startNode.z === endNode.z);
    
    // Vérification du mode PMR
    const accessibilityMode = document.getElementById('accessibility-check').checked;

    // Initialisation A*
    let openList = [];
    let closedSet = new Set();
    openList.push({ x: startNode.x, y: startNode.y, z: startNode.z, g: 0, f: 0, parent: null });

    while (openList.length > 0) {
        // Trouve le nœud avec le coût le plus faible
        let lowIdx = 0;
        for (let i = 1; i < openList.length; i++) {
            if (openList[i].f < openList[lowIdx].f) lowIdx = i;
        }
        let curr = openList[lowIdx];
        openList.splice(lowIdx, 1);

        // Si on est arrivé
        if (curr.x === endNode.x && curr.y === endNode.y && curr.z === endNode.z) {
            let path = [];
            let temp = curr;
            while (temp) { path.push(temp); temp = temp.parent; }
            return path.reverse();
        }

        closedSet.add(`${curr.x},${curr.y},${curr.z}`);

        let neighbors = [];
        const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
        dirs.forEach(d => neighbors.push({ x: curr.x + d[0], y: curr.y + d[1], z: curr.z }));

        // --- GESTION DES CHANGEMENTS D'ÉTAGES ---
        if (!isSameFloorTrip) {
            const currentCellVal = grids[curr.z][curr.y][curr.x];
            const isStair = (currentCellVal === 2);
            const isElevator = (currentCellVal === 3);

            const canTakeStairs = !accessibilityMode && isStair;
            const canTakeElevator = isElevator; 

            // Escaliers : nécessitent superposition exacte
            if (canTakeStairs) {
                if (curr.z < GRID_LEVELS - 1 && grids[curr.z+1][curr.y][curr.x] === 2) {
                     neighbors.push({ x: curr.x, y: curr.y, z: curr.z + 1 });
                }
                if (curr.z > 0 && grids[curr.z-1][curr.y][curr.x] === 2) {
                     neighbors.push({ x: curr.x, y: curr.y, z: curr.z - 1 });
                }
            }

            // Ascenseurs : connexion logique (téléportation vers l'ascenseur de l'étage cible)
            if (canTakeElevator) {
                if (curr.z < GRID_LEVELS - 1) {
                    const targets = roomDefinitions.filter(r => r.isElevator && r.level === curr.z + 1);
                    targets.forEach(t => { neighbors.push({ x: t.x, y: t.y, z: t.level }); });
                }
                if (curr.z > 0) {
                    const targets = roomDefinitions.filter(r => r.isElevator && r.level === curr.z - 1);
                    targets.forEach(t => { neighbors.push({ x: t.x, y: t.y, z: t.level }); });
                }
            }
        }

        // --- VALIDATION DES VOISINS ---
        for (let n of neighbors) {
            if (n.z < 0 || n.z >= GRID_LEVELS || n.x < 0 || n.x >= GRID_W || n.y < 0 || n.y >= GRID_H) continue;
            
            const cellValue = grids[n.z][n.y][n.x];
            if (cellValue === 0) continue; // Mur
            
            // Si PMR activé, on interdit strictement de marcher sur l'escalier (valeur 2)
            if (accessibilityMode && cellValue === 2) continue;

            // Si on ne change pas d'étage, on évite de marcher sur les connecteurs
            const isConnector = (cellValue === 2 || cellValue === 3);
            if (isSameFloorTrip && isConnector) {
                if (!(n.x === endNode.x && n.y === endNode.y)) continue;
            }

            if (closedSet.has(`${n.x},${n.y},${n.z}`)) continue;

            let g = curr.g + 1; 
            let h = Math.abs(n.x - endNode.x) + Math.abs(n.y - endNode.y) + Math.abs(n.z - endNode.z) * 10;
            let f = g + h;

            let existing = openList.find((o) => o.x === n.x && o.y === n.y && o.z === n.z);
            if (!existing) {
                openList.push({ x: n.x, y: n.y, z: n.z, g: g, f: f, parent: curr });
            } else if (g < existing.g) {
                existing.g = g;
                existing.f = f;
                existing.parent = curr;
            }
        }
    }
    return null;
}

// --- VISIBILITÉ DURANT LA NAVIGATION ---
// Met en évidence le chemin et cache le reste
function updateNavigationVisibility(startRoom, endRoom, pathNodesCoordinates) {
    const levelsInPath = new Set([startRoom.level, endRoom.level]);
    if (levelsInPath.has(0)) worldGroup.children.forEach(c => { if (c.name.startsWith('Corridor_L0')) c.visible = true; });
    if (levelsInPath.has(1)) worldGroup.children.forEach(c => { if (c.name.startsWith('Corridor_L1')) c.visible = true; });
    
    ['Plane0', 'Plane1'].forEach(name => {
        const obj = worldGroup.getObjectByName(name);
        if(obj) obj.visible = true;
    });

    roomDefinitions.forEach(r => {
        if (!r.mesh) return;
        const isVisibleFloor = (currentFloorFilter === 2 || r.level === currentFloorFilter);
        if (!isVisibleFloor) { r.mesh.visible = false; return; }

        if (r === startRoom || r === endRoom || r.isWall) {
            r.mesh.material = r.originalMaterial;
            r.mesh.visible = true;
        } else {
            r.mesh.material = ghostMaterial;
            r.mesh.visible = true;
        }
    });

    // Affiche les escaliers/ascenseurs s'ils font partie du chemin
    if (pathNodesCoordinates) {
        roomDefinitions.forEach(r => {
            if ((r.isStair || r.isElevator) && r.mesh) {
                if (pathNodesCoordinates.has(`${r.x},${r.y},${r.level}`)) {
                    r.mesh.material = r.originalMaterial;
                    r.mesh.visible = true;
                }
            }
        });
    }
}

function resetView() {
    if (pathLine) { scene.remove(pathLine); pathLine = null; }
    arrowGroup.clear(); 
    activePathCurve = null; 
    activeStartRoom = null;
    activeEndRoom = null;
    roomDefinitions.forEach(r => { if (r.mesh) r.mesh.material = r.originalMaterial; });
    setFloorVisibility(currentFloorFilter);
}

function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById("theme-toggle-btn");
    if (currentTheme === 'light') {
        body.classList.add('dark');
        btn.innerHTML = 'Mode Clair';
        scene.background = new THREE.Color(0x0d1222); 
        currentTheme = 'dark';
    } else {
        body.classList.remove('dark');
        btn.innerHTML = 'Mode Sombre';
        scene.background = new THREE.Color(0xf0f0f0); 
        currentTheme = 'light';
    }
}

// Fonction principale : Calcule et dessine l'itinéraire
window.calculateRoute = function() {
    resetView();

    const startValue = document.getElementById('startPoint').value;
    const endValue = document.getElementById('endPoint').value;
    const r1 = navPoints[startValue];
    const r2 = navPoints[endValue];
    if (!r1 || !r2) return; 

    activeStartRoom = r1;
    activeEndRoom = r2;

    // Force la vue sur "Tous les étages" si le trajet change de niveau
    if (r1.level !== r2.level) {
        setFloorVisibility(2); 
        document.querySelector('input[name="floor_filter"][value="2"]').checked = true;
    } else {
        setFloorVisibility(r1.level);
        document.querySelector(`input[name="floor_filter"][value="${r1.level}"]`).checked = true;
    }
    
    const nodes = findPath(r1, r2);
    if (!nodes) { console.error("Aucun chemin trouvé."); return; }
    
    const pathNodesCoordinates = new Set();
    nodes.forEach(n => pathNodesCoordinates.add(`${n.x},${n.y},${n.z}`));
    updateNavigationVisibility(r1, r2, pathNodesCoordinates);

    // Construction de la ligne 3D
    const points = [];
    points.push(new THREE.Vector3((r1.x + r1.w/2 - 0.5)*TILE_SIZE, (r1.level*FLOOR_HEIGHT)+0.5, (r1.y + r1.h/2 - 0.5)*TILE_SIZE));
    nodes.forEach((n) => points.push(new THREE.Vector3((n.x+0.5)*TILE_SIZE-0.5, (n.z*FLOOR_HEIGHT)+0.5, (n.y+0.5)*TILE_SIZE-0.5)));
    points.push(new THREE.Vector3((r2.x + r2.w/2 - 0.5)*TILE_SIZE, (r2.level*FLOOR_HEIGHT)+0.5, (r2.y + r2.h/2 - 0.5)*TILE_SIZE));

    const curve = new THREE.CatmullRomCurve3(points);
    activePathCurve = curve; 

    // Dessin du Tube (Chemin)
    const tubeGeo = new THREE.TubeGeometry(curve, points.length * 5, 0.15, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ 
        color: 0x3b82f6, 
        transparent: true, 
        opacity: 0.9 
    });
    pathLine = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(pathLine);

    // Dessin des Flèches (Animation)
    const ARROW_SPACING = 3.0; 
    const numberOfArrows = Math.floor(curve.getLength() / ARROW_SPACING);
    const coneGeo = new THREE.ConeGeometry(0.4, 1.2, 12);
    coneGeo.rotateX(Math.PI / 2); 
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 }); 

    for (let i = 0; i < numberOfArrows; i++) {
        const initialT = i / numberOfArrows;
        const arrow = new THREE.Mesh(coneGeo, coneMat);
        arrow.userData.initialFraction = initialT; 
        
        const pos = curve.getPointAt(initialT);
        arrow.position.copy(pos);
        arrow.lookAt(pos.clone().add(curve.getTangentAt(initialT)));
        arrowGroup.add(arrow);
    }
}

// --- BOUCLE D'ANIMATION PRINCIPALE ---
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    
    // Animation fluide du décalage caméra (Offset)
    currentViewOffset += (targetViewOffset - currentViewOffset) * 0.1;
    if (Math.abs(targetViewOffset - currentViewOffset) > 0.5) {
        camera.setViewOffset(window.innerWidth, window.innerHeight, currentViewOffset, 0, window.innerWidth, window.innerHeight);
    } else if (targetViewOffset === 0 && currentViewOffset < 1) {
        camera.clearViewOffset();
    }

    // Animation des flèches le long du chemin
    if (activePathCurve && arrowGroup.children.length > 0) {
        const time = performance.now() / 1000; 
        const speed = 0.15; 
        arrowGroup.children.forEach((arrow) => {
            let t = (arrow.userData.initialFraction + time * speed) % 1;
            const pos = activePathCurve.getPointAt(t);
            arrow.position.copy(pos);
            arrow.lookAt(pos.clone().add(activePathCurve.getTangentAt(t)));
        });
    }

    // Raycasting pour détecter le survol des salles
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(worldGroup.children, true);
    hoveredRoom = null;
    if (intersects.length > 0) {
        for(let i=0; i<intersects.length; i++) {
             if (intersects[i].object.userData && intersects[i].object.userData.room) {
                 hoveredRoom = intersects[i].object.userData.room;
                 break;
             }
        }
    }
    
    renderer.render(scene, camera);

    // Gestion des étiquettes (Noms des salles)
    const container = document.getElementById("labels-container");
    container.innerHTML = "";
    
    // Optimisation : On ne lance le calcul lourd de visibilité (occlusion) que toutes les 200ms
    const now = performance.now();
    const updateOcclusion = (now - lastOcclusionCheck > OCCLUSION_INTERVAL);
    if (updateOcclusion) lastOcclusionCheck = now;

    roomDefinitions.forEach((r) => {
        if (r.isWall || r.isDoor || !r.mesh || !r.mesh.visible) return;

        let shouldShowLabel = true;
        if (pathLine) shouldShowLabel = (r === activeStartRoom || r === activeEndRoom || r === hoveredRoom);
        if (!shouldShowLabel) return;

        // Test d'occlusion (Est-ce que la salle est cachée par un mur ?)
        if (updateOcclusion) {
            const dir = new THREE.Vector3().subVectors(r.centerPos, camera.position);
            const dist = dir.length();
            dir.normalize();
            raycaster.set(camera.position, dir);
            const hits = raycaster.intersectObjects(worldGroup.children, true);
            let isOccluded = false;
            for (let i = 0; i < hits.length; i++) {
                if (hits[i].distance >= dist) break;
                if (hits[i].object === r.mesh || hits[i].object.parent === r.mesh) continue;
                if ((hits[i].object.name === 'Plane1' && hits[i].object.visible) || 
                    (hits[i].object.userData.room && hits[i].object.visible && hits[i].object.material === hits[i].object.userData.room.originalMaterial)) {
                    isOccluded = true;
                    break;
                }
            }
            r._isOccluded = isOccluded; 
        }

        if (r._isOccluded) return; 

        // Projection 2D pour placer le texte HTML
        const vector = r.centerPos.clone();
        vector.project(camera);
        if (vector.z > 1) return;

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        const label = document.createElement('div');
        label.className = 'label';
        let txt = r.name;
        if (r.isStair) { txt = 'Escalier'; label.style.backgroundColor = 'rgba(255, 215, 0, 0.95)'; label.style.color = '#333'; }
        if (r.isElevator) { txt = 'Ascenseur'; label.style.backgroundColor = 'rgba(155, 89, 182, 0.95)'; }
        
        label.textContent = txt;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.display = 'block'; 
        container.appendChild(label);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

function initialize() {
    setupThreeJs();
    renderGeometry();
    setupCustomSelects(); 
    animate();
}

window.onload = initialize;