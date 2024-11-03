import {initListenersFilters} from './filters.js'

const COLOR_PRODUCTION = "#e7a30c",
    COLOR_CONSUMPTION = "#ae13bb",
    COLOR_PRICE = "#45b707";

document.addEventListener("DOMContentLoaded", () => {
    let dataConsumption, dataProduction, dataPrice, dataFilters = {}, filters = {}, mode = "PRODUCTION", year = 1961, color = COLOR_PRODUCTION;
    // Dimensions des graphique
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

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
            data = dataPrice;
        } else {
            data = dataConsumption;
        }        

        const svg = d3.select("#graph-map")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height + 200);
    
        const projection = d3.geoMercator()
            .scale(150)
            .translate([width / 1.54, height / 1]);
        
        // Configuration du tooltip
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
        
        // Configuration du zoom
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                svg.selectAll("path").attr("transform", event.transform);
            });
        
        d3.select("#resetZoom").on("click", () => {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        });
        
        const path = d3.geoPath().projection(projection);
        svg.call(zoom);
        
        // Chargement des données géographiques
        d3.json("./../countries.geo.json").then((geoData) => {
            const countries = svg.selectAll("path")
                .data(geoData.features)
                .enter()
                .append("path")
                .attr("d", path)
                .attr("fill", "#ccc") // Couleur par défaut
                .attr("stroke", "#333") // Couleur de la bordure
                .attr("stroke-width", 0.5)
                .on("mouseover", handleMouseOver)
                .on("mousemove", handleMouseMove)
                .on("mouseout", handleMouseOut);
        });
        
        // Fonction de gestion de la souris sur le pays
        function handleMouseOver(event, d) {
            if (d.id !== "BMU") {
                const productionData = dataProduction.find(dp => dp.code === d.id && dp.year == year);
                const consumptionData = dataConsumption.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                const avgConsumption = consumptionData.length > 0 
                    ? d3.mean(consumptionData, dp => dp.value) 
                    : "Donnée indisponible";
        
                d3.select(this).attr("fill", "#003366");
                tooltip.style("opacity", 1)
                    .html(`<strong>${d.properties.name}</strong>
                        <br>Production : ${productionData ? productionData.value.toLocaleString() + " tonnes" : "Donnée indisponible"}
                        <br>Consommation : ${avgConsumption !== "Donnée indisponible" ? avgConsumption.toLocaleString() + " tonnes" : avgConsumption}`);
            }
        }
        
        // Fonction de gestion du mouvement de la souris pour le tooltip
        function handleMouseMove(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        }
        
        // Fonction de gestion de la sortie de la souris
        function handleMouseOut() {
            d3.select(this).attr("fill", "#ccc");
            tooltip.style("opacity", 0);
        }
    
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
        initListenersFilters(
            document.getElementById("searchInput"),
            document.getElementById("resultContainer"),
            dataFilters,
            filters,
            updateData
        );
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