// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import { Polyline } from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

//const app = document.querySelector<HTMLDivElement>("#app")!;

const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

// Player variables
const initialPlayerLocation = leaflet.latLng(
  36.98949379578401,
  -122.06277128548504,
);
const playerLocation = leaflet.latLng(
  initialPlayerLocation.lat,
  initialPlayerLocation.lng,
);
const playerInventory: Coin[] = [];

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// --------------------------------- Interfaces ---------------------------------

// Cell coordinates
interface Cell {
  i: number;
  j: number;
}

// Coin data
interface Coin {
  cell: Cell;
  serial: number;
}

// Cache data
interface Cache {
  cell: Cell;
  coins: Coin[];
}

// --------------------------------- Game Logic ---------------------------------

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: playerLocation,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  closePopupOnClick: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(playerLocation);
playerMarker.bindTooltip("Your current location.");
playerMarker.addTo(map);

// Add a polyline to represent the player's movement history
const playerMovementHistory: Polyline = leaflet.polyline([]);
playerMovementHistory.addTo(map);

// Display the player's inventory using the status panel
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
//const defaultText = "No coins yet...";
const defaultText = "";

// Initialize cache maps
const caches = new Map<string, string>();
const cacheMarkers = new Map<string, leaflet.Rectangle>();

// Initialize the game
initGame();

// ------------------------------ Event Listeners ------------------------------

document.querySelector<HTMLButtonElement>("#north")!
  .addEventListener("click", () => {
    const newPos = {
      i: playerLocation.lat + TILE_DEGREES,
      j: playerLocation.lng,
    };
    movePlayer(newPos);
  });

document.querySelector<HTMLButtonElement>("#south")!
  .addEventListener("click", () => {
    const newPos = {
      i: playerLocation.lat - TILE_DEGREES,
      j: playerLocation.lng,
    };
    movePlayer(newPos);
  });

document.querySelector<HTMLButtonElement>("#west")!
  .addEventListener("click", () => {
    const newPos = {
      i: playerLocation.lat,
      j: playerLocation.lng - TILE_DEGREES,
    };
    movePlayer(newPos);
  });

document.querySelector<HTMLButtonElement>("#east")!
  .addEventListener("click", () => {
    const newPos = {
      i: playerLocation.lat,
      j: playerLocation.lng + TILE_DEGREES,
    };
    movePlayer(newPos);
  });

document.querySelector<HTMLButtonElement>("#sensor")!
  .addEventListener("click", () => {
    // Get the current location of the player
    navigator.geolocation.getCurrentPosition((position) => {
      const newPos = {
        i: position.coords.latitude,
        j: position.coords.longitude,
      };
      movePlayer(newPos);
    });
  });

document.querySelector<HTMLButtonElement>("#reset")!
  .addEventListener("click", () => {
    // Prompt the player to confirm the reset
    if (!confirm("Reset the game?")) return;

    // Clear the local storage
    localStorage.clear();
    // Return all coins to their home caches
    initGame();
  });

// --------------------------------- Functions ---------------------------------

// Initialize the game
function initGame() {
  // Create the map
  map.setView(initialPlayerLocation, GAMEPLAY_ZOOM_LEVEL);

  // Initialize player data
  initializeUI();

  // Clear the player's movement history
  resetPlayerState(initialPlayerLocation);

  // Initialize the cache maps
  resetCaches();

  // Load local storage data
  loadDataFromLocalStorage();

  updateCaches();
  displayInventory();
}

// Initialize player data
function initializeUI() {
  playerMarker.setLatLng(initialPlayerLocation);
  playerMarker.addTo(map);
  playerInventory.splice(0, playerInventory.length);
  playerLocation.lat = initialPlayerLocation.lat;
  playerLocation.lng = initialPlayerLocation.lng;
}

// Clear the player's movement history
function resetPlayerState(startLocation: leaflet.LatLng) {
  playerMovementHistory.setLatLngs([]);
  playerMovementHistory.addLatLng(startLocation);
}

// Initialize the cache maps
function resetCaches() {
  caches.clear();
  if (cacheMarkers.size > 0) {
    cacheMarkers.forEach((marker, _cellString) => {
      marker.remove();
    });
  }
  cacheMarkers.clear();
}

// Load local storage data
function loadDataFromLocalStorage() {
  loadLocalStorage();
  map.panTo(playerLocation);
}

// Local data storage functions

// Save cache data to local storage
function saveCaches() {
  localStorage.setItem("caches", JSON.stringify(Array.from(caches.entries())));
}

// Save inventory data to local storage
function saveInventory() {
  localStorage.setItem("inventory", JSON.stringify(playerInventory));
}

// Save player location to local storage
function savePlayerLocation() {
  localStorage.setItem(
    "playerLocation",
    JSON.stringify(playerMovementHistory.getLatLngs()),
  );
}

// Load data from local storage
function loadLocalStorage() {
  // Load caches from local storage
  const cacheData = localStorage.getItem("caches");
  if (cacheData) {
    const cacheArray = JSON.parse(cacheData);
    cacheArray.forEach((cache: [string, string]) => {
      caches.set(cache[0], cache[1]);
    });
  }

  // Load inventory from local storage
  const inventoryData = localStorage.getItem("inventory");
  if (inventoryData) {
    const inventoryArray = JSON.parse(inventoryData);
    inventoryArray.forEach((coin: Coin) => {
      playerInventory.push(coin);
    });
  }

  // Load player location from local storage
  const playerLocationData = localStorage.getItem("playerLocation");
  if (playerLocationData) {
    const playerLocationArray = JSON.parse(playerLocationData);
    playerMovementHistory.setLatLngs(playerLocationArray);
    playerLocation.lat =
      playerLocationArray[playerLocationArray.length - 1].lat;
    playerLocation.lng =
      playerLocationArray[playerLocationArray.length - 1].lng;
    playerMarker.setLatLng(playerLocation);
  }
}

// Move the player to a new location
function movePlayer(newPos: { i: number; j: number }) {
  // Update the player's location
  playerLocation.lat = newPos.i;
  playerLocation.lng = newPos.j;
  playerMarker.setLatLng(playerLocation);

  // Update the player's movement history
  const newLatLng = leaflet.latLng(newPos.i, newPos.j);
  playerMovementHistory.addLatLng(newLatLng);
  savePlayerLocation();

  // Update the map view
  map.panTo(playerLocation);

  updateCaches();
}

// String representation of a cell
function cellToString(cell: Cell): string {
  return [cell.i, cell.j].toString();
}

// Save the state of a cache
function toMomento(cache: Cache): string {
  return JSON.stringify(cache);
}

// Restore the state of a cache
function fromMomento(momento: string): Cache {
  return JSON.parse(momento);
}

// Get the surrounding cells of a given coordinate
function getVisibleCells(coord: { lat: number; lng: number }): Cell[] {
  const visibleCells: Cell[] = [];
  const offset = {
    i: Math.floor(coord.lat / TILE_DEGREES),
    j: Math.floor(coord.lng / TILE_DEGREES),
  };
  for (
    let i = offset.i - NEIGHBORHOOD_SIZE;
    i < offset.i + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = offset.j - NEIGHBORHOOD_SIZE;
      j < offset.j + NEIGHBORHOOD_SIZE;
      j++
    ) {
      visibleCells.push({ i, j });
    }
  }
  return visibleCells;
}

// Update the caches on the map
function updateCaches() {
  const visibleCellsSet = new Set<string>();
  const newCells: Cell[] = [];

  // Convert visible cells to a hashable string for comparison
  const visibleCells = getVisibleCells(playerLocation);
  visibleCells.forEach((cell) => visibleCellsSet.add(cellToString(cell)));

  // Iterate through the current markers to find which should be despawned
  cacheMarkers.forEach((marker, cellString) => {
    if (!visibleCellsSet.has(cellString)) {
      marker.remove();
      cacheMarkers.delete(cellString);
    }
  });

  // Determine which cells are new and should have caches spawned
  visibleCells.forEach((cell) => {
    if (
      !cacheMarkers.has(cellToString(cell)) &&
      luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY
    ) {
      newCells.push(cell);
    }
  });

  // Spawn new caches
  for (const cell of newCells) {
    spawnCache(cell);
  }
}

// Add caches to the map by cell numbers
function spawnCache(cell: Cell) {
  // Generate the cache if it doesn't exist
  const cellString = cellToString(cell);
  let cache: Cache;
  if (!caches.get(cellString)) {
    cache = { cell, coins: [] };
    generateCoins(cell, cache!);
    caches.set(cellString, toMomento(cache));
  } else {
    cache = fromMomento(caches.get(cellString)!);
  }

  // Convert cell numbers into lat/lng bounds
  const offset = {
    i: cell.i * TILE_DEGREES,
    j: cell.j * TILE_DEGREES,
  };
  const bounds = leaflet.latLngBounds([
    [offset.i, offset.j],
    [offset.i + TILE_DEGREES, offset.j + TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Handle interactions with the cache
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    return updateCachePopup(popupDiv, cache!);
  }, { keepInView: true });

  // Save the caches to local storage
  saveCaches();

  // Save the cache marker
  cacheMarkers.set(cellToString(cell), rect);
}

// Generate coins for a cache
function generateCoins(cell: Cell, cache: Cache) {
  const numCoins = Math.floor(
    luck([cell.i, cell.j, "numCoins"].toString()) * 3 + 1,
  );

  // Add each coin to the cache
  for (let k = 0; k < numCoins; k++) {
    cache.coins.push({ cell, serial: k });
  }
}

// Collect a coin from a cache
function collect(coin: Coin, cache: Cache) {
  playerInventory.push(coin);
  const index = cache.coins.indexOf(coin);
  if (index > -1) cache.coins.splice(index, 1);
  caches.set(cellToString(cache.cell), toMomento(cache));
  // Save the caches to local storage
  saveCaches();
  displayInventory();
}

// Deposit all coins from the player's inventory into a cache
function deposit(cache: Cache) {
  while (playerInventory.length > 0) {
    const coin = playerInventory.pop();
    cache.coins.push(coin!);
  }
  caches.set(cellToString(cache.cell), toMomento(cache));
  // Save the caches to local storage
  saveCaches();
  displayInventory();
}

// Update the status panel with the player's inventory
function displayInventory() {
  const inventoryDiv = document.createElement("div");

  if (playerInventory.length > 0) {
    // Display the player's inventory in status panel
    for (const coin of playerInventory) {
      inventoryDiv.innerHTML = `
                <ul><li>${coin.cell.i}:${coin.cell.j}#${coin.serial}</li></ul>`;

      const centerButton = document.createElement("button");
      centerButton.textContent = "Center to Home Cache";
      centerButton.addEventListener("click", () => {
        // Open the cache popup
        const cache = fromMomento(caches.get(cellToString(coin.cell))!);
        const popupDiv = document.createElement("div");
        updateCachePopup(popupDiv, cache);

        // Create the cache marker if it's been despawned
        const cacheMarker = cacheMarkers.get(cellToString(coin.cell));
        if (!cacheMarker) spawnCache(coin.cell);
        cacheMarkers.get(cellToString(coin.cell))!.openPopup();

        map.panTo(
          leaflet.latLng(
            coin.cell.i * TILE_DEGREES,
            coin.cell.j * TILE_DEGREES,
          ),
        );
      });

      inventoryDiv.appendChild(centerButton);
      statusPanel.appendChild(inventoryDiv);
    }
  } else statusPanel.innerHTML = defaultText;

  // Save the inventory to local storage
  saveInventory();
}

// Update the cache popup with the current cache contents
function updateCachePopup(popupDiv: HTMLElement, cache: Cache) {
  popupDiv.innerHTML = `<div>Cache ${cache.cell.i}:${cache.cell.j}<br><br>
                          Inventory:<br></div>`;

  popupDiv.appendChild(updateCacheCoinDisplay(popupDiv, cache));

  // Add a deposit button
  const depositButton = document.createElement("button");
  depositButton.textContent = "Deposit Coins";
  depositButton.addEventListener("click", () => {
    deposit(cache);
    updateCachePopup(popupDiv, cache);
  });
  popupDiv.appendChild(depositButton);
  return popupDiv;
}

// Display the coins in the cache
function updateCacheCoinDisplay(popupDiv: HTMLElement, cache: Cache) {
  const cacheDiv = document.createElement("div");

  for (const coin of cache.coins) {
    const coinDiv = document.createElement("span");
    coinDiv.innerHTML = `
                <ul><li><span>${coin.cell.i}:${coin.cell.j}#${coin.serial}<span>
                <button id="poke">Collect Coin</button></li></ul>`;
    coinDiv
      .querySelector<HTMLButtonElement>("#poke")!
      .addEventListener("click", () => {
        collect(coin, cache);
        // Disable the button after collecting
        coinDiv.querySelector<HTMLButtonElement>("#poke")!.textContent =
          "Collected";
        coinDiv.querySelector<HTMLButtonElement>("#poke")!.disabled = true;
        updateCachePopup(popupDiv, cache);
      });
    cacheDiv.appendChild(coinDiv);
  }
  return cacheDiv;
}
