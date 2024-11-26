export function initListenersFilters(searchInput, resultContainer, dataFilters, filters, updateData) {
    searchInput.addEventListener("focus", () => {
        resultContainer.classList.remove("hidden");
        updateResults(searchInput.value.toLowerCase(), dataFilters, filters, resultContainer, updateData);
    });
    
    searchInput.addEventListener("input", (e) => {
        updateResults(e.target.value.toLowerCase(), dataFilters, filters, resultContainer, updateData);
    });
    
    // Masquer le conteneur des résultats lorsqu'on clique à l'extérieur
    document.addEventListener("click", (e) => {
        if (!e.target.closest("#searchInput") && !e.target.closest("#resultContainer")) {
            resultContainer.classList.add("hidden");
        }
    });
}

export function initFilters(dataFilters, filters, dataConsumption, dataProduction) {
    filters['country'] = [];
    filters['meat'] = [];
    const filtersCountries = dataProduction.map(d => d.country).sort();
    dataFilters['country'] = filtersCountries.filter((d, index) => filtersCountries.indexOf(d) == index);
    const filtersTypeMeat = dataConsumption.map(d => d.type_meat).sort();
    dataFilters['meat'] = filtersTypeMeat.filter((d, index) => filtersTypeMeat.indexOf(d) == index);
}

function updateResults(query, dataFilters, filters, resultContainer, updateData) {
    resultContainer.innerHTML = ""; // Vider le conteneur de résultats

    for (const [category, items] of Object.entries(dataFilters)) {
        // Filtrer les items par la recherche
        const filteredItems = items.filter(item => item.toLowerCase().includes(query));

        if (filteredItems.length) {
            // Ajouter un séparateur de catégorie si plusieurs catégories
            if (Object.keys(dataFilters).length >= 2) {
                const categoryDiv = document.createElement("div");
                categoryDiv.classList.add("px-3", "py-2", "bg-gray-200", "text-gray-600", "font-semibold", "capitalize");
                categoryDiv.textContent = category;
                resultContainer.appendChild(categoryDiv);
            }

            // Ajouter les items de la catégorie
            filteredItems.forEach((item, index) => {
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `${category}-${index}`;
                checkbox.value = item;
                checkbox.classList.add("mr-2");

                // Cocher les cases des éléments déjà sélectionnés
                if (filters[category].includes(item)) checkbox.checked = true;

                const label = document.createElement("label");
                label.classList.add("capitalize", "w-full");
                label.htmlFor = `${category}-${index}`;
                label.textContent = item;

                const itemDiv = document.createElement("div");
                itemDiv.classList.add("px-3", "py-2", "hover:bg-gray-100", "flex", "items-center");
                itemDiv.appendChild(checkbox);
                itemDiv.appendChild(label);
                itemDiv.addEventListener("click", () => {
                    if (checkbox.checked) {
                        addFilterItem(filters, category, item, updateData);
                    } else {
                        removeFilterItem(filters, category, item, updateData);
                    }
                });

                resultContainer.appendChild(itemDiv);
            });
        }
    }
}

// Fonction pour ajouter un élément sélectionné à la liste
function addFilterItem(filters, category, item, updateData) {
    const listFilters = filters[category];
    if (!listFilters.includes(item)) {
        listFilters.push(item);
        // Relance l'affichage des graphiques
        updateData();
    }
}

// Fonction pour retirer un élément sélectionné de la liste
function removeFilterItem(filters, category, item,  updateData) {
    const listFilters = filters[category];
    const index = listFilters.indexOf(item);
    if (index > -1) {
        listFilters.splice(index, 1);
        // Relance l'affichage des graphiques
        updateData();
    }
}
