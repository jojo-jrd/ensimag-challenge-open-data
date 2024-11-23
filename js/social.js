import {initListenersFilters, initFilters} from './filters.js'

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

    let colorScale;
    let valueAccessor;
    function chartMap() {
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
        
        const tooltip = d3.select("body")
            .append("div")
            .style("position", "absolute")
            .style("background-color", "white")
            .style("padding", "5px 10px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0);
    
        const path = d3.geoPath().projection(projection);
        
        d3.json("./../countries.geo.json").then((geoData) => {
            valueAccessor = (d) => {
                if (mode == "PRODUCTION") {
                    const productionData = data.find(dp => dp.code === d.id && dp.year == year);
                    return productionData ? productionData.value : 0;
                } else if (mode == "CONSUMPTION") {
                    const consumptionData = data.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                    return consumptionData.length > 0 ? d3.mean(consumptionData, dp => dp.value) : 0;
                } else if (mode == "PRICE") {
                    const priceData = data.find(dp => dp.code === d.id && dp.year == year);
                    return priceData ? priceData.value : 0;
                }
                return 0;
            };

            colorScale = d3.scaleSequential(d3.interpolateRgb("#005f73", "#0a9396"))
                .domain([0.2, d3.max(geoData.features, (d) => valueAccessor(d))]);

            svg.selectAll("path")
                .data(geoData.features)
                .enter()
                .append("path")
                .attr("d", path)
                .attr("fill", "#ccc")
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5)
                .on("mouseover", handleMouseOver)
                .on("mousemove", handleMouseMove)
                .on("mouseout", handleMouseOut);

            addColorLegend(svg, colorScale);
        });

        function addColorLegend(svg, colorScale) {
            const legendWidth = 200;
            const legendHeight = 20;

            const legendGroup = svg.append("g")
                .attr("transform", `translate(${width - legendWidth + 100}, ${height + 150})`);
            
            const gradient = svg.append("defs")
                .append("linearGradient")
                .attr("id", "blue-gradient")
                .attr("x1", "0%")
                .attr("x2", "100%")
                .attr("y1", "0%")
                .attr("y2", "0%");
        
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", "#0a9396");
        
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", "#005f73"); 
     
            legendGroup.append("rect")
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .style("fill", "url(#blue-gradient)");
        
            legendGroup.append("text")
                .attr("x", 0)
                .attr("y", legendHeight + 5)
                .attr("text-anchor", "start")
                .style("font-size", "12px")
                .text(d3.format(".0f")(0));
        
            legendGroup.append("text")
                .attr("x", legendWidth)
                .attr("y", legendHeight + 5)
                .attr("text-anchor", "end")
                .style("font-size", "12px")
                .text(d3.format(",.0f")(d3.max(svg.selectAll("path").data(), (d) => valueAccessor(d)))
                    .replace(/,/g, ' '));
        }        
        
        function handleMouseOver(event, d) {
            if (d.id !== "BMU") {
                let infoHTML = `<strong>${d.properties.name}</strong>`;
            
                if (mode == "PRODUCTION") {
                    const productionData = data.find(dp => dp.code === d.id && dp.year == year);
                    infoHTML += `<br>Production : ${productionData ? productionData.value.toLocaleString() + " tonnes" : "Donnée indisponible"}`;
                }
  
                if (mode == "CONSUMPTION") {
                    const consumptionData = data.filter(dp => dp.location === d.id && dp.year == year && dp.measure === "THND_TONNE");
                    const avgConsumption = consumptionData.length > 0 
                        ? d3.mean(consumptionData, dp => dp.value) 
                        : "Donnée indisponible";
                    infoHTML += `<br>Consommation : ${avgConsumption !== "Donnée indisponible" ? avgConsumption.toLocaleString() + " tonnes" : avgConsumption}`;
                }
            
                if (mode == "PRICE") {
                    const priceData = data.find(dp => dp.code === d.id && dp.year == year);
                    infoHTML += `<br>Prix : ${priceData ? priceData.value.toLocaleString() + " €/tonne" : "Donnée indisponible"}`;
                }
            
                tooltip.style("opacity", 1)
                    .html(infoHTML);
            
                d3.select(this).attr("fill", (d) => colorScale(valueAccessor(d)) || "#003366");
            }
        }
        
        function handleMouseMove(event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        }
        
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

    

    async function initPage() {
        await loadData();
        initFilters(dataFilters, filters, dataConsumption, dataProduction);
        initListeners();
        updateData();
    }

    initPage();
});