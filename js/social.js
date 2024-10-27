const COLOR_PRODUCTION = "#e7a30c",
    COLOR_CONSUMPTION = "#ae13bb",
    COLOR_PRICE = "#45b707";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, dataFilters = {}, filters = {}, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION;
    // Dimensions des graphique
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const searchInput = document.getElementById("searchInput");
    const resultContainer = document.getElementById("resultContainer");

    async function loadData() {
        // Chargement des données
        dataConsumption = await d3.csv("./../csv/consumption.csv", d => ({
            location : d["LOCATION"],
            type_meat : d["SUBJECT"].toLowerCase(),
            measure : d["MEASURE"], //.replace(/(_CAP|THND_TONNE)/g, ""),
            year : +d["TIME"],
            value : +d["Value"],
        }));

        dataProduction = await d3.csv("./../csv/production.csv", d => ({
            country : d["Country"],
            code : d["Code"],
            year : +d["Year"],
            value : +d["Meat, total | 00001765 || Production | 005510 || tonnes"],
        }));

        dataPrice = await d3.csv("./../csv/meat-prices.csv", d => ({
            month : d["Month"],
            beef_price : +d["Beef Price"],
            beef_price_percentage : d["Beef price % Change"] == "NaN" ? NaN : d["Beef price % Change"],
            chicken_price : +d["Chicken Price"],
            chicken_price_percentage : d["Chicken price % Change"] == "NaN" ? NaN : d["Chicken price % Change"],
            lamb_price : +d["Lamb price"],
            lamb_price_percentage : d["Lamb price % Change"] == "NaN" ? NaN : d["Lamb price % Change"],
            pork_price : +d["Pork Price"],
            pork_price_percentage : d["Pork price % Change"] == "NaN" ? NaN : d["Pork price % Change"],
            salmon_price : +d["Salmon Price"],
            salmon_price_percentage : d["Salmon price % Change"] == "NaN" ? NaN : d["Salmon price % Change"]
        }));
    }

    function chartMap() {
        // TODO gestion des données en fonction du mode, des filtres et de l'année
        let data;
        if (mode == "PRODUCTION") {
            data = dataProduction;
        } else if (mode == "PRICE") {
            data = dataProduction; // TODO change
        } else {
            data = dataConsumption;
        }        
        
        // TODO
    }

    function chart1() {
        // TODO gestion des données en fonction du mode, des filtres et de l'année
        let data;
        if (mode == "PRODUCTION") {
            data = dataProduction;
        } else if (mode == "PRICE") {
            data = dataProduction; // TODO change
        } else {
            data = dataConsumption;
        }

        const svg = d3.select("#graph1")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`)
 
        // TODO change that

        const dataGrouped = data.reduce((acc, current) => {
            const found = acc.find(item => item.year === current.year);
            if (found) {
            found.value += current.value; // Ajouter la valeur si l'année existe déjà
            } else {
            acc.push({ year: current.year, value: current.value }); // Ajouter une nouvelle entrée si l'année est nouvelle
            }
            return acc;
        }, [])
        
        // Création de l'axe des absisses 
        const x = d3.scalePoint()
            .domain(dataGrouped.map(elem => elem.year))
            .range([0, width]);
        
        // Création de l'axe des ordonnées
        const y = d3.scaleLinear()
            .domain([0, d3.max(dataGrouped, d => d.value)])
            .range([height, 0]);

        // Création et affichage des axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .call(d3.axisLeft(y));

        // Création de la ligne
        svg.append("path")
            .datum(dataGrouped)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2)
            .attr("d", d3.line()
              .x(d => x(d.year))
              .y(d => y(d.value))
            );

        
        // Création de la légende
        svg.append("text")
            .attr("x", width - 80)
            .attr("y", 20)
            .attr("fill", color)
            .text("TEST");
    }

    function chart2() {
        // TODO gestion des données en fonction du mode, des filtres et de l'année
        let data = dataPrice;
        // if (mode == "PRODUCTION") {
        //     data = dataProduction;
        // } else if (mode == "PRICE") {
        //     data = dataProduction; // TODO change
        // } else {
        //     data = dataConsumption;
        // }

        // Création du graphique
        const svg = d3.select("#graph2")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`)

        // Création de l'axe des absisses 
        const x = d3.scalePoint()
            .domain(data.map(d => d.month))
            .range([0, width]);

        // Création de l'axe des ordonnées
        // TODO: change that
        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => Math.max(d.beef_price, d.chicken_price, d.lamb_price, d.pork_price, d.salmon_price))])
            .range([height, 0]);

        // Création et affichage des axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x).tickFormat(d => d.slice(0, 3))); // Format mois abrégé
        svg.append("g")
            .call(d3.axisLeft(y));

        const meats = ["beef_price", "chicken_price", "lamb_price", "pork_price", "salmon_price"];
        // Récupération des couleurs
        const colors = d3.scaleOrdinal(d3.schemeCategory10).domain(meats);

        // Création des lignes pour chaque viande
        meats.forEach(meat => {
            svg.append("path")
                .datum(data.filter(d => !isNaN(d[meat])))
                .attr("fill", "none")
                .attr("stroke", colors(meat))
                .attr("stroke-width", 2)
                .attr("d", d3.line()
                    .x(d => x(d.month))
                    .y(d => y(d[meat]))
                );
        });

        // Création des légendes
        meats.forEach((meat, index) => {
            svg.append("text")
                .attr("x", width - 80)
                .attr("y", 20 + index * 20)
                .attr("fill", colors(meat))
                .text(meat.replace("_price", "").toUpperCase());
        });
    }

    function updateData() {
        // Supprime tous les graphiques précédents
        const allChart = document.querySelectorAll(".section svg");
        for (let chart of allChart) {
            chart.remove();
        }
        // TODO: gestion mode + date + noData

        // Gère les données et la couleur en fonction du mode
        if (mode == "PRODUCTION") {
            color = COLOR_PRODUCTION;
        } else if (mode == "PRICE") {
            color = COLOR_PRICE;
        } else {
            color = COLOR_CONSUMPTION;
        }

        // Mets à jour tous les graphiques
        chartMap();
        chart1();
        chart2();
        // TODO other charts
    }

    /*
        ==========================================
        PARTIE DES FILTRES
        ==========================================
    */
    
    // Fonction pour mettre à jour la liste de résultats en fonction de la recherche
    function updateResults(query) {
        resultContainer.innerHTML = ""; // Vider le conteneur de résultats

        for (const [category, items] of Object.entries(dataFilters)) {
            // Filtrer les items par la recherche
            const filteredItems = items.filter(item => item.toLowerCase().includes(query));

            if (filteredItems.length) {
                // Ajouter un séparateur de catégorie si plusieurs categories
                if (Object.keys(dataFilters).length >= 2) {
                    const categoryDiv = document.createElement("div");
                    categoryDiv.classList.add("px-3", "py-2", "bg-gray-200", "text-gray-600", "font-semibold");
                    categoryDiv.textContent = category.charAt(0).toUpperCase() + category.slice(1);
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

                    checkbox.addEventListener("change", (e) => {
                        if (e.target.checked) {
                            addFilterItem(category, item);
                        } else {
                            removeFilterItem(category, item);
                        }
                    });

                    const label = document.createElement("label");
                    label.htmlFor = `${category}-${index}`;
                    label.textContent = item;

                    const itemDiv = document.createElement("div");
                    itemDiv.classList.add("px-3", "py-2", "hover:bg-gray-100", "flex", "items-center");
                    itemDiv.appendChild(checkbox);
                    itemDiv.appendChild(label);

                    resultContainer.appendChild(itemDiv);
                });
            }
        }
    }

    // Fonction pour ajouter un élément sélectionné à la liste
    function addFilterItem(category, item) {
        const listFilters = filters[category];
        if (!listFilters.includes(item)) {
            listFilters.push(item);
            // Relance l'affichage des graphiques
            updateData();
        }
    }

    // Fonction pour retirer un élément sélectionné de la liste
    function removeFilterItem(category, item) {
        const listFilters = filters[category];
        const index = listFilters.indexOf(item);
        if (index > -1) {
            listFilters.splice(index, 1);
            // Relance l'affichage des graphiques
            updateData();
        }
    }

    /*
        ==========================================
        PARTIE DES FONCTIONS D'INITIALISATION
        ==========================================
    */

    function initListeners() {
        const dateInput = document.getElementById('dateInput');
        const selectedYearElem = document.getElementById('selectedYear');
        // Initialise avec la valeur courante
        dateInput.value = year;
        dateInput.addEventListener("input", function() {
            // Change l'année
            year = parseInt(this.value);
            selectedYearElem.textContent = year;
            // Recharge les données
            updateData();
        });

        // Ajoute des listeners sur les boutons
        for (let m of ['consumption', 'production', 'price']) {
            document.getElementById(`${m}Button`).addEventListener('click', () => {
                mode = m.toUpperCase();
                // Recharge les données
                updateData();
            })
        }

        // Filtre pour les recherches

        searchInput.addEventListener("focus", () => {
            resultContainer.classList.remove("hidden");
            updateResults(searchInput.value.toLowerCase());
        });
        
        searchInput.addEventListener("input", (e) => {
            updateResults(e.target.value.toLowerCase());
        });
        
        // Masquer le conteneur des résultats lorsqu'on clique à l'extérieur
        document.addEventListener("click", (e) => {
            if (!e.target.closest("#searchInput") && !e.target.closest("#resultContainer")) {
                resultContainer.classList.add("hidden");
            }
        });
    }

    function initFilters() {
        // TODO see for the others filters
        filters['country'] = [];
        const filtersCountries = dataProduction.map(d => d.country);
        dataFilters['country'] = filtersCountries.filter((d, index) => filtersCountries.indexOf(d) == index)

    }

    async function initPage() {
        await loadData();
        initFilters();
        initListeners();
        updateData();
    }

    initPage();
});