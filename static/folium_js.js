let selectedRange = 'last_month';
let customStartDate = null;
let customEndDate = null;
let corridorLayers = {};
let map;
let corridors = []; // List of corridors
let corridor_list = [];

document.addEventListener("DOMContentLoaded", () => {
   const timeRangeDropdown = document.getElementById("range");
   const customRangeContainer = document.getElementById("custom-range-container");
   const startDateInput = document.getElementById("start-date");
   const endDateInput = document.getElementById("end-date");

   // Initialize Flatpickr for date inputs
   flatpickr(startDateInput, {
       dateFormat: "Y-m-d",
       onChange: (selectedDates) => {
           customStartDate = selectedDates[0];
       },
   });
   flatpickr(endDateInput, {
       dateFormat: "Y-m-d",
       onChange: (selectedDates) => {
           customEndDate = selectedDates[0];
       },
   });

   timeRangeDropdown.addEventListener("change", () => {
       if (timeRangeDropdown.value === "custom") {
           customRangeContainer.style.display = "block";
       } else {
           customRangeContainer.style.display = "none";
           selectedRange = timeRangeDropdown.value;
       }
   });

   document.getElementById("apply-date-range").addEventListener("click", () => {
       if (!customStartDate || !customEndDate) {
           alert("Please select both a start date and an end date.");
           return;
       }
       selectedRange = `custom_range:${customStartDate.toISOString().split("T")[0]},${customEndDate.toISOString().split("T")[0]}`;
       alert(`Custom range applied: ${customStartDate.toISOString().split("T")[0]} to ${customEndDate.toISOString().split("T")[0]}`);
   });
});

function setTimeRange(range) {
   selectedRange = range;
}

function passTimeRangeToMarker(markerUrl) {
   return markerUrl + `?time_range=${selectedRange}`;
}


// JS for the Corridor Button
const selectedLocations = [];

// Function to toggle selection of a location
function toggleSelection(lat, lng, name) {
    const location = { lat, lng, name };
    const index = selectedLocations.findIndex(loc => loc.lat === lat && loc.lng === lng);

    if (index === -1) {
        selectedLocations.push(location); // Add location
        alert(`${name} added to corridor.`);
    } else {
        selectedLocations.splice(index, 1); // Remove location
        alert(`${name} removed from corridor.`);
    }
}

// Function to save the selected locations
async function saveCorridor() {
    if (selectedLocations.length === 0) {
        alert("No locations selected.");
        return;
    }

    const response = await fetch('/add_corridor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: selectedLocations }),
    });

    if (response.ok) {
        alert("Corridor saved successfully.");
    } else {
        alert("Failed to save corridor.");
    }
}


function TravelTimeReport() {{
    const dropdown = document.getElementById('corridor-dropdown');
    const selectedCorridor = dropdown.value;
    console.log(selectedCorridor);
    if (selectedCorridor) {{
        // Redirect to the new page with the selected corridor ID
        url = `/travel_time_report?corridorId=${selectedCorridor}`;
        window.open(url, '_blank');
        //window.location.href = `/travel_time_report?corridorId=${selectedCorridor}`;
    }} else {{
        alert('Please select a corridor before proceeding to the Travel Time Report.');
    }}
}}



 // Function to update the dropdown with corridors
 async function orridorDropdown() {
    fetch('/get_corridors')
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch controller data');
        }
        return response.json(); // Parse JSON response
    })
    .then(data => {
        //console.log("Controller Data:", data);
        corridors = data.corridors;
        corridor_list = data.corridor_list;
        //const corridors = await response.json();
        console.log(corridors);

        const dropdown = document.getElementById("corridor-dropdown");
        dropdown.innerHTML = ""; // Clear existing options

        corridors.forEach(({ corridorId, corridorName }) => {
            const option = document.createElement("option");
            option.text = `${corridorId} (${corridorName} intersections)`;
            option.value = corridorId;
            dropdown.appendChild(option);
        });

        corridor_list.forEach(({ corridorId, corridorName, coordinates }) => {
            // Add LayerGroup for the corridor
            const layer = L.layerGroup([
                L.polyline(coordinates, {
                    color: "blue",
                    weight: 5,
                    opacity: 0.7,
                }),
            ]);

            corridorLayers[corridorId] = layer;
        });
        
    })
    .catch(error => {
        console.error('Error fetching controller data:', error);
    });

    // Add event listener to dropdown for selection change
    dropdown.addEventListener("change", (event) => {
        const selectedCorridorId = event.target.value;

        // Clear existing layers
        Object.values(corridorLayers).forEach((layer) => map.removeLayer(layer));

        // Add the selected corridor's layer
        if (selectedCorridorId && corridorLayers[selectedCorridorId]) {
            map.addLayer(corridorLayers[selectedCorridorId]);

            const bounds = L.latLngBounds(coordinates);
            map.fitBounds(bounds);
        }

    });
    
}




async function CorridorDropdown() {
    const response = await fetch('/get_corridors');
    if (!response.ok) {
        alert("Failed to fetch corridors.");
        return;
    }

    const corridors = await response.json(); // Expected format: [{ corridorId, corridorName, coordinates }]
    console.log(corridors);

    const dropdown = document.getElementById("corridor-dropdown");
    dropdown.innerHTML = ""; // Clear existing options

    corridors.forEach(({ corridorId, corridorName, coordinates }) => {
        // Add option to dropdown
        const option = document.createElement("option");
        option.text = `Corridor ${corridorId} - ${corridorName}`;
        option.value = corridorId;
        dropdown.appendChild(option);

        // Add LayerGroup for the corridor
        const layer = L.layerGroup([
            L.polyline(coordinates, {
                color: "blue",
                weight: 5,
                opacity: 0.7,
            }),
        ]);

        corridorLayers[corridorId] = layer;
    });

    // Add event listener to dropdown for selection change
    dropdown.addEventListener("change", (event) => {
        const selectedCorridorId = event.target.value;

        // Clear existing layers
        Object.values(corridorLayers).forEach((layer) => map.removeLayer(layer));

        // Add the selected corridor's layer
        if (selectedCorridorId && corridorLayers[selectedCorridorId]) {
            map.addLayer(corridorLayers[selectedCorridorId]);

            const bounds = L.latLngBounds(coordinates);
            map.fitBounds(bounds);
        }

    });
}



// Function to update the dropdown with corridors
async function updateCorridorDropdown() {
    try {
        const response = await fetch('/get_corridors');
        if (!response.ok) {
            throw new Error('Failed to fetch corridor data');
        }

        const data = await response.json();
        corridors = data.corridors; // Metadata (id, name)
        corridor_list = data.corridor_list; // Coordinates and metadata
        //console.log(corridors, corridor_list);

        const dropdown = document.getElementById("corridor-dropdown");
        dropdown.innerHTML = ""; // Clear existing options

        // Populate the dropdown
        corridors.forEach(({ corridorId, corridorName }) => {
            const option = document.createElement("option");
            option.text = `${corridorId} (${corridorName} intersections)`;
            option.value = corridorId;
            dropdown.appendChild(option);
        });


        const corridorCoordinates = {};

        // Accumulate coordinates for each corridor
        corridor_list.forEach(({ corridorId, coordinates }) => {
            // Initialize the array for this corridorId if it doesn't already exist
            if (!corridorCoordinates[corridorId]) {
                corridorCoordinates[corridorId] = [];
            }

            // Add the coordinates to the corresponding corridorId
            corridorCoordinates[corridorId].push(coordinates);
        });

        // Create layers for each corridor after accumulating coordinates
        Object.entries(corridorCoordinates).forEach(([corridorId, coordinates]) => {
            // Create a single Leaflet polyline for the accumulated coordinates
            const layer = L.polyline(coordinates, {
                color: "rgba(26, 134, 148, 0.85)",
                weight: 7,
            });

            // Add the polyline layer to the map
            //map.addLayer(layer);

            // Optionally, store the layer in the corridorLayers object
            if (!corridorLayers[corridorId]) {
                corridorLayers[corridorId] = [];
            }
            corridorLayers[corridorId].push(layer);
        });
        
    
        // Add event listener for corridor selection
        dropdown.addEventListener("change", (event) => {
            const selectedCorridorId = event.target.value;

            Object.entries(corridorLayers).forEach(corridor => {
                corridor.forEach(layer => {
                  if (typeof layer[0] === 'string') {
                    //console.log(layer[0]); 
                  }else{
                    map.removeLayer(layer[0])
                  }
                });
              });

            const selectedLayer = corridorLayers[selectedCorridorId];

            map.addLayer(selectedLayer[0]);

            // Fit the map to the bounds of the selected corridor
            const bounds = selectedLayer[0].getBounds();
            map.fitBounds(bounds);
            //}
        });
    } catch (error) {
        console.error('Error fetching corridor data:', error);
    }
}



// Wait for the DOM to load
document.addEventListener("DOMContentLoaded", () => {
    // Initialize the Leaflet map
    //map = map_6a2d9ada9a86324658e365b0456fc888
    map = map_ce9a1e3a2f3f145a77ebe170ecbf2fc8;

    // Add a tile layer (you can customize the tile layer URL)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Call the function to populate the dropdown
    updateCorridorDropdown();
});


//Quill.js - Notepad
let currentIntersectionId = null;
let quill = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Quill rich text editor
    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                ['link', 'image', 'table'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'color': [] }, { 'background': [] }], 
                [{ 'font': [] }]
            ]
        }
    });
});

async function openPanel(intersectionId, name) {
    if (name.length > 10){
        currentIntersectionId = name.split(' ')[0];
    }else{
        currentIntersectionId = name;
    }
    
    document.getElementById("side-panel").style.display = "block";
    document.getElementById("panel-title").innerText = `Notes for ${name}`;
    console.log(currentIntersectionId);

    // Fetch notes from the backend
    const response = await fetch(`/notes/${name}`);
    if (response.ok) {
        const { content } = await response.json();
        quill.root.innerHTML = content; // Load content into the editor
    } else {
        quill.root.innerHTML = ''; // Clear editor if no notes exist
    }
}

async function saveNote() {
    const content = quill.root.innerHTML; // Get content from the editor
    const response = await fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intersectionId: currentIntersectionId, content }),
    });

    if (response.ok) {
        alert('Note saved successfully!');
        closePanel();
    } else {
        alert('Failed to save note.');
    }
}

function closePanel() {
    document.getElementById("side-panel").style.display = "none";
}