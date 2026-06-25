// config.js

// --- CONFIGURATION GÉNÉRALE ---
// Dimensions de la grille et paramètres visuels
const GRID_W = 18;
const GRID_H = 18;
const GRID_LEVELS = 2; // 0 = RDC, 1 = 1er Étage
const TILE_SIZE = 1;
const FLOOR_HEIGHT = 8; 

// Palette de couleurs pour les salles et éléments
const COLORS = {
    green: 0x77dd77,  // Salles de classe
    orange: 0xffb347, // Espaces de vie
    ltBlue: 0x5bc0de, // Salles techniques
    dkBlue: 0x00008b, // WC
    yellow: 0xffd700, // Escaliers
    purple: 0x9b59b6, // Ascenseurs
    pink: 0xffc0cb,   // Accueil
    gray: 0x808080,   // Murs
    white: 0xffffff,  // Couloirs
    red: 0xff0000,    // Portes
    floor: 0x222222,  // Sol sombre
};

// --- DÉFINITION DES ZONES DE MARCHE (COULOIRS) ---
// Seules les zones définies ici sont navigables par l'algorithme.
class CorridorSystem {
    constructor() {
        this.definitions = [
            // RDC (Level 0)
            { x: 0, y: 2, w: 8, h: 1, level: 0 },
            { x: 7, y: 3, w: 1, h: 4, level: 0 },
            { x: 7, y: 10, w: 1, h: 6, level: 0 },
            { x: 8, y: 3, w: 1, h: 2, level: 0 },
            { x: 8, y: 5, w: 2, h: 7, level: 0 },
            { x: 9, y: 4, w: 6, h: 1, level: 0 },
            { x: 14, y: 3, w: 1, h: 1, level: 0 },
            { x: 8, y: 13, w: 7, h: 1, level: 0 },
            { x: 14, y: 14, w: 1, h: 1, level: 0 },
            { x: 8, y: 15, w: 7, h: 1, level: 0 },
            { x: 0, y: 15, w: 7, h: 1, level: 0 },
            
            // Zones d'Escaliers RDC (Type 'stairs' = transition verticale)
            { x: 7, y: 7, w: 1, h: 3, level: 0, type: 'stairs' },
            { x: 14, y: 16, w: 1, h: 2, level: 0, type: 'stairs' },

            // 1er ÉTAGE (Level 1)
            { x: 0, y: 2, w: 9, h: 1, level: 1 },
            { x: 8, y: 3, w: 1, h: 13, level: 1 },
            { x: 0, y: 15, w: 16, h: 1, level: 1 },

            // Zones d'Escaliers 1er (Doivent se superposer à celles du RDC)
            { x: 7, y: 7, w: 1, h: 3, level: 1, type: 'stairs' },
            { x: 14, y: 16, w: 2, h: 2, level: 1, type: 'stairs' },
        ];
    }

    // Convertit ces définitions en grille numérique pour l'algorithme A*
    applyToGrids(grids) {
        this.definitions.forEach((c) => {
            const z = c.level;
            const val = c.type === 'stairs' ? 2 : 1; // 1 = Marche, 2 = Escalier
            
            for (let iy = c.y; iy < c.y + c.h; iy++) {
                for (let ix = c.x; ix < c.x + c.w; ix++) {
                    if (iy >= 0 && iy < GRID_H && ix >= 0 && ix < GRID_W) {
                        grids[z][iy][ix] = val;
                    }
                }
            }
        });
    }
}
const corridorSystem = new CorridorSystem();

// --- DÉFINITION DES SALLES, MURS ET PORTES ---
// C'est ici qu'on ajoute ou modifie les éléments du bâtiment.
const roomDefinitions = [
    // === RDC ===
    { name: "Hall d'entré", x: 10, y: 7, w: 1, h: 1, color: COLORS.green, level: 0 },
    // Porte : Doit être placée SUR le couloir, devant la salle. 'axis' définit son orientation visuelle.
    { name: "Porte Hall", x: 9, y: 7, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Hambourg", x: 0, y: 0, w: 3, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte Hambourg", x: 2, y: 2, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall1", x: 3, y: 0, w: 3, h: 1, color: COLORS.gray, isWall: true, level: 0 },

    { name: "Foyer", x: 6, y: 0, w: 2, h: 2, color: COLORS.orange, level: 0 },
    { name: "Porte Foyer", x: 7, y: 2, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall2", x: 8, y: 0, w: 1, h: 3, color: COLORS.gray, isWall: true, level: 0 },
    { name: "Wall3", x: 9, y: 0, w: 5, h: 1, color: COLORS.gray, isWall: true, level: 0 },
    
    { name: "Alexandrie", x: 9, y: 1, w: 5, h: 3, color: COLORS.green, level: 0 },
    { name: "Porte Alexandrie", x: 9, y: 4, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },
    
    { name: "Wall4", x: 14, y: 0, w: 1, h: 3, color: COLORS.gray, isWall: true, level: 0 },
    
    { name: "Cayenne", x: 15, y: 0, w: 3, h: 4, color: COLORS.green, level: 0 },
    { name: "Porte Cayenne", x: 15, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'z' },
    
    { name: "Wall5", x: 15, y: 4, w: 3, h: 1, color: COLORS.gray, isWall: true, level: 0 },
    
    { name: "St Petersbourg", x: 0, y: 3, w: 2, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte Peter", x: 1, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' }, 
    
    { name: "Cadix", x: 2, y: 3, w: 2, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte Cadix", x: 2, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },    

    { name: "Salle cyber", x: 4, y: 3, w: 2, h: 2, color: COLORS.ltBlue, level: 0 },
    { name: "Porte Cyber", x: 4, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "WC 1", x: 6, y: 3, w: 1, h: 2, color: COLORS.dkBlue, level: 0 },
    { name: "Porte WC", x: 7, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'z' },

    // Escalier : isStair est juste visuel ici, la logique de navigation est dans CorridorSystem
    { name: "Escalier RDC", x: 7, y: 7, w: 1, h: 3, color: COLORS.yellow, isStair: true, level: 0 },
    { name: "Porte E RDC", x: 7, y: 7, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },
    
    { name: "Québec", x: 0, y: 12, w: 3, h: 3, color: COLORS.green, level: 0 },
    { name: "Porte Québec", x: 2, y: 15, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall6", x: 3, y: 12, w: 3, h: 2, color: COLORS.gray, isWall: true, level: 0 },
    { name: "Wall7", x: 6, y: 14, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 0 },
    { name: "Wall7-2", x: 6, y: 12, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 0 },

    { name: "Accueil", x: 8, y: 12, w: 2, h: 1, color: COLORS.pink, level: 0 },
    { name: "Porte Acceuil", x: 9, y: 13, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    // Ascenseur : isElevator est essentiel pour la logique PMR
    { name: "Ascenseur", x: 6, y: 13, w: 1, h: 1, color: COLORS.purple, isElevator: true, level: 0 },
    { name: "Porte Ascenseur", x: 7, y: 13, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall8", x: 10, y: 12, w: 5, h: 1, color: COLORS.gray, isWall: true, level: 0 },
    { name: "Wall9", x: 15, y: 12, w: 3, h: 6, color: COLORS.gray, isWall: true, level: 0 },

    { name: "WC 2", x: 8, y: 14, w: 3, h: 1, color: COLORS.dkBlue, level: 0 },
    { name: "Porte WC", x: 9, y: 15, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall10", x: 11, y: 14, w: 3, h: 1, color: COLORS.gray, isWall: true, level: 0 },

    { name: "Los Angeles", x: 0, y: 16, w: 4, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte LA", x: 3, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Vancouver", x: 4, y: 16, w: 3, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte Vancouver", x: 4, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' }, 

    { name: "Salle de repos", x: 7, y: 16, w: 2, h: 2, color: COLORS.orange, level: 0 },
    { name: "Porte Repos", x: 8, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' }, 

    { name: "Panama", x: 9, y: 16, w: 2, h: 2, color: COLORS.green, level: 0 },
    { name: "Porte Panama", x: 9, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },

    { name: "Wall11", x: 11, y: 17, w: 3, h: 1, color: COLORS.gray, isWall: true, level: 0 },

    { name: "Escalier Sud", x: 14, y: 16, w: 1, h: 2, color: COLORS.yellow, isStair: true, level: 0 },
    { name: "Porte E Sud", x: 14, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 0, axis: 'x' },
    

    // === 1ER ÉTAGE ===
    { name: "Escalier RDC (1er)", x: 7, y: 7, w: 1, h: 3, color: COLORS.yellow, isStair: true, level: 1 },
    { name: "Porte RDC 1er", x: 8, y: 9, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'z' },

    { name: "Safi", x: 0, y: 0, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Safi", x: 2, y: 2, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Wall12", x: 3, y: 0, w: 3, h: 1, color: COLORS.gray, isWall: true, level: 1 },
    { name: "Wall13_1", x: 3, y: 1, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 1 },
    { name: "Wall13", x: 5, y: 1, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 1 },

    { name: "Darhan", x: 6, y: 0, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Darhan", x: 8, y: 2, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Magadishu", x: 0, y: 3, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Magadishu", x: 2, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Port Elizabeth", x: 3, y: 3, w: 2, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte PE", x: 4, y: 2, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' }, 

    { name: "Pointe Noire", x: 5, y: 3, w: 2, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte PN", x: 6, y: 3, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' }, 

    { name: "WC 3", x: 7, y: 3, w: 1, h: 2, color: COLORS.dkBlue, level: 1 },
    { name: "Porte WC", x: 8, y: 4, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'z' },

    { name: "Shangai", x: 0, y: 13, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Shangai", x: 2, y: 15, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Wall13", x: 3, y: 14, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 1 },
    { name: "Wall14", x: 3, y: 13, w: 4, h: 1, color: COLORS.gray, isWall: true, level: 1 },
    { name: "Wall15", x: 6, y: 14, w: 2, h: 1, color: COLORS.gray, isWall: true, level: 1 },
    { name: "Wall16", x: 9, y: 13, w: 1, h: 1, color: COLORS.gray, isWall: true, level: 1 },

    // ASCENSEUR 1ER ÉTAGE (Connecté logiquement à celui du RDC)
    { name: "Ascenseur", x: 7, y: 13, w: 1, h: 1, color: COLORS.purple, isElevator: true, level: 1 },
    { name: "Porte Ascenseur", x: 8, y: 13, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "WC 4", x: 9, y: 14, w: 1, h: 1, color: COLORS.dkBlue, level: 1 },
    { name: "Porte WC", x: 9, y: 14, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'z' },

    { name: "Bombay", x: 15, y: 13, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Bombay", x: 15, y: 15, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Madras", x: 10, y: 13, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Madras", x: 12, y: 15, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' }, 

    { name: "Wall17", x: 13, y: 13, w: 2, h: 2, color: COLORS.gray, isWall: true, level: 1 },

    { name: "Osaka", x: 0, y: 16, w: 4, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Osaka", x: 3, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Vladivostok", x: 4, y: 16, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Vladivostok", x: 5, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' }, 

    { name: "Singapour", x: 7, y: 16, w: 3, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Singapour", x: 7, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Djakarta", x: 10, y: 16, w: 4, h: 2, color: COLORS.green, level: 1 },
    { name: "Porte Djakarta", x: 10, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },

    { name: "Escalier Sud (1er)", x: 14, y: 16, w: 2, h: 2, color: COLORS.yellow, isStair: true, level: 1 },
    { name: "Porte E S 1er", x: 15, y: 16, w: 1, h: 1, color: COLORS.red, isDoor: true, level: 1, axis: 'x' },
];

// Filtre pour la liste déroulante : on garde seulement les destinations valides
const navPoints = roomDefinitions.filter((r) => !r.isWall && !r.isDoor && !r.isStair && !r.isElevator);

// --- GÉNÉRATION DE LA GRILLE TECHNIQUE ---
// Transforme les définitions d'objets en une matrice 3D (x, y, level) utilisable par l'algorithme.
function createGrids() {
    let grids = [];
    for(let z=0; z<GRID_LEVELS; z++) {
        let grid = [];
        for (let y = 0; y < GRID_H; y++) {
            let row = [];
            for (let x = 0; x < GRID_W; x++) {
                row.push(0); // 0 = vide (Mur)
            }
            grid.push(row);
        }
        grids.push(grid);
    }
    
    // 1. Applique les couloirs (marche possible)
    corridorSystem.applyToGrids(grids);
    
    // 2. Applique les éléments spéciaux sur la grille
    roomDefinitions.forEach(item => {
        // Ascenseurs = 3
        if (item.isElevator) {
             if (item.level >= 0 && item.level < GRID_LEVELS) {
                 grids[item.level][item.y][item.x] = 3; 
             }
        }
        // Portes = 1 (on s'assure qu'elles sont traversables)
        if (item.isDoor) {
            if (item.level >= 0 && item.level < GRID_LEVELS && 
                item.y >= 0 && item.y < GRID_H && 
                item.x >= 0 && item.x < GRID_W) {
                
                // On n'écrase pas un escalier (2) ou un ascenseur (3) existant
                if (grids[item.level][item.y][item.x] !== 2 && grids[item.level][item.y][item.x] !== 3) {
                    grids[item.level][item.y][item.x] = 1; 
                }
            }
        }
    });

    return grids;
}
const grids = createGrids();